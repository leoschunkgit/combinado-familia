-- 0073 - Ciclo de vida explicito do aviso "Terminei" enviado pelo filho.
--
-- Regras centrais:
-- - a solicitacao nasce PENDENTE;
-- - Fez/Nao fez resolve a solicitacao no banco;
-- - desfazer a ocorrencia NAO reabre a solicitacao;
-- - uma solicitacao resolvida, sozinha, nao bloqueia a exclusao da atribuicao;
-- - solicitacao/revisao pendente continua protegendo a atribuicao;
-- - editar uma atribuicao que possua historico do filho continua proibido para
--   nao mudar o significado de um aviso/revisao ja registrado.

alter table public.t_solicitacao_tarefa_filho
  add column if not exists status text;

alter table public.t_solicitacao_tarefa_filho
  add column if not exists resolvido_em timestamptz;

-- Solicitações que ainda possuem uma ocorrência oficial podem ser
-- classificadas com segurança pelo estado oficial atual.
with ocorrencias_atuais as (
  select
    s.id,
    (
      select oc.tipo
      from public.t_ocorrencia oc
      where oc.id_filho_tarefa = s.id_filho_tarefa
        and timezone('America/Sao_Paulo', oc.created_at)::date = s.data_referencia
      order by oc.created_at desc, oc.id desc
      limit 1
    ) as tipo
  from public.t_solicitacao_tarefa_filho s
  where s.status is null
)
update public.t_solicitacao_tarefa_filho s
set
  status = case atual.tipo
    when 'FEZ' then 'RESOLVIDA_FEZ'
    when 'NAO_FEZ' then 'RESOLVIDA_NAO_FEZ'
    else s.status
  end,
  resolvido_em = coalesce(s.resolvido_em, now())
from ocorrencias_atuais atual
where s.id = atual.id
  and atual.tipo in ('FEZ', 'NAO_FEZ');

-- Recupera com evidência objetiva o caso legado em que houve FEZ e depois
-- estorno/desfazer: o movimento de estrela preserva a prova mesmo após a
-- ocorrência ter sido removida. Não fazemos inferência para casos sem prova.
with resolvidas_fez_legado as (
  select
    s.id,
    min(m_fez.created_at) as resolvido_em
  from public.t_solicitacao_tarefa_filho s
  join public.t_filho_tarefa ft
    on ft.id = s.id_filho_tarefa
  join public.t_estrela_movimento m_fez
    on m_fez.id_filho = ft.id_filho
   and m_fez.id_tarefa = ft.id_tarefa
   and m_fez.id_vigencia = ft.id_vigencia
   and m_fez.data_referencia = s.data_referencia
   and m_fez.tipo = 'FEZ'
   and m_fez.quantidade > 0
   and m_fez.created_at >= s.created_at
  join public.t_estrela_movimento m_estorno
    on m_estorno.id_ocorrencia = m_fez.id_ocorrencia
   and m_estorno.tipo = 'ESTORNO_FEZ'
   and m_estorno.quantidade < 0
   and m_estorno.created_at >= m_fez.created_at
  where s.status is null
    and not exists (
      select 1
      from public.t_ocorrencia oc
      where oc.id_filho_tarefa = s.id_filho_tarefa
        and timezone('America/Sao_Paulo', oc.created_at)::date = s.data_referencia
    )
  group by s.id
)
update public.t_solicitacao_tarefa_filho s
set
  status = 'RESOLVIDA_FEZ',
  resolvido_em = coalesce(s.resolvido_em, legado.resolvido_em, now())
from resolvidas_fez_legado legado
where s.id = legado.id;

-- O que não possui evidência de resposta continua corretamente pendente.
update public.t_solicitacao_tarefa_filho
set
  status = 'PENDENTE',
  resolvido_em = null
where status is null;

alter table public.t_solicitacao_tarefa_filho
  alter column status set default 'PENDENTE';

alter table public.t_solicitacao_tarefa_filho
  alter column status set not null;

alter table public.t_solicitacao_tarefa_filho
  drop constraint if exists t_solicitacao_tarefa_filho_status_chk;

alter table public.t_solicitacao_tarefa_filho
  add constraint t_solicitacao_tarefa_filho_status_chk
  check (status in ('PENDENTE', 'RESOLVIDA_FEZ', 'RESOLVIDA_NAO_FEZ'));

alter table public.t_solicitacao_tarefa_filho
  drop constraint if exists t_solicitacao_tarefa_filho_resolucao_chk;

alter table public.t_solicitacao_tarefa_filho
  add constraint t_solicitacao_tarefa_filho_resolucao_chk
  check (
    (status = 'PENDENTE' and resolvido_em is null)
    or
    (status <> 'PENDENTE' and resolvido_em is not null)
  );

create index if not exists idx_solicitacao_tarefa_filho_pendente
  on public.t_solicitacao_tarefa_filho (id_filho_tarefa, data_referencia)
  where status = 'PENDENTE';

create index if not exists idx_revisao_tarefa_filho_pendente
  on public.t_revisao_tarefa_filho (id_filho_tarefa, data_referencia)
  where status = 'PENDENTE';

comment on column public.t_solicitacao_tarefa_filho.status is
  'Ciclo do aviso Terminei: PENDENTE, RESOLVIDA_FEZ ou RESOLVIDA_NAO_FEZ.';

comment on column public.t_solicitacao_tarefa_filho.resolvido_em is
  'Momento em que o responsavel respondeu ao aviso do filho. Desfazer a ocorrencia nao reabre o aviso.';

-- O conteúdo enviado pelo filho permanece imutável. Somente o ciclo interno
-- status/resolvido_em pode ser atualizado pelas regras centrais do banco.
create or replace function public.guard_solicitacao_tarefa_filho_imutavel()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.id is distinct from old.id
     or new.id_filho_tarefa is distinct from old.id_filho_tarefa
     or new.data_referencia is distinct from old.data_referencia
     or new.observacao is distinct from old.observacao
     or new.created_at is distinct from old.created_at then
    raise exception 'Conteudo da solicitacao do filho nao pode ser alterado';
  end if;

  if new.status not in ('PENDENTE', 'RESOLVIDA_FEZ', 'RESOLVIDA_NAO_FEZ') then
    raise exception 'Status da solicitacao do filho invalido';
  end if;

  if (new.status = 'PENDENTE' and new.resolvido_em is not null)
     or (new.status <> 'PENDENTE' and new.resolvido_em is null) then
    raise exception 'Estado de resolucao da solicitacao do filho invalido';
  end if;

  return new;
end;
$function$;

-- Fonte única de verdade para responder ao "Terminei".
-- INSERT/UPDATE de Fez/Nao fez fecha ou atualiza a resposta da solicitação.
-- DELETE da ocorrência não toca na solicitação, portanto ela não ressuscita.
create or replace function public.resolver_solicitacao_tarefa_ao_marcar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_data date;
  v_status text;
begin
  if new.tipo not in ('FEZ', 'NAO_FEZ') then
    return new;
  end if;

  v_data := timezone('America/Sao_Paulo', new.created_at)::date;
  v_status := case
    when new.tipo = 'FEZ' then 'RESOLVIDA_FEZ'
    else 'RESOLVIDA_NAO_FEZ'
  end;

  update public.t_solicitacao_tarefa_filho s
  set
    status = v_status,
    resolvido_em = case
      when s.status is distinct from v_status or s.resolvido_em is null
        then now()
      else s.resolvido_em
    end
  where s.id_filho_tarefa = new.id_filho_tarefa
    and s.data_referencia = v_data
    and (
      s.status is distinct from v_status
      or s.resolvido_em is null
    );

  return new;
end;
$function$;

revoke all on function public.resolver_solicitacao_tarefa_ao_marcar()
from public, anon, authenticated, service_role;

drop trigger if exists resolver_solicitacao_tarefa_ao_marcar
on public.t_ocorrencia;

create trigger resolver_solicitacao_tarefa_ao_marcar
after insert or update of tipo, id_filho_tarefa, created_at
on public.t_ocorrencia
for each row
execute function public.resolver_solicitacao_tarefa_ao_marcar();

create or replace function public.criar_solicitacao_tarefa_filho_interno(
  p_token text,
  p_id_filho_tarefa bigint,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_token_hash text;
  v_pai_id bigint;
  v_filho_id bigint;
  v_vigencia_id bigint;
  v_tarefa_id bigint;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_nome_filho text;
  v_nome_tarefa text;
  v_data date;
  v_observacao text;
  v_id bigint;
  v_status text;
  v_created_at timestamptz;
  v_resolvido_em timestamptz;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'codigo', 'SESSAO_INVALIDA');
  end if;

  if p_id_filho_tarefa is null or p_id_filho_tarefa <= 0 then
    return jsonb_build_object('ok', false, 'codigo', 'TAREFA_INVALIDA');
  end if;

  v_observacao := nullif(btrim(coalesce(p_observacao, '')), '');
  if v_observacao is not null and char_length(v_observacao) > 120 then
    return jsonb_build_object('ok', false, 'codigo', 'OBSERVACAO_INVALIDA');
  end if;

  v_token_hash := pg_catalog.encode(
    extensions.digest(lower(p_token), 'sha256'),
    'hex'
  );

  select a.id_usuario_pai, a.id_filho
    into v_pai_id, v_filho_id
  from public.t_filho_acesso_app a
  where a.token_hash = v_token_hash
    and a.ativo = true
  limit 1;

  if v_pai_id is null or v_filho_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SESSAO_INVALIDA');
  end if;

  select ft.id_vigencia, ft.id_tarefa
    into v_vigencia_id, v_tarefa_id
  from public.t_filho_tarefa ft
  where ft.id = p_id_filho_tarefa
    and ft.id_usuario_pai = v_pai_id
    and ft.id_filho = v_filho_id
  for key share;

  if v_vigencia_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'TAREFA_INVALIDA');
  end if;

  select v.data_inicio, v.data_fim
    into v_inicio, v_fim
  from public.t_vigencia v
  where v.id = v_vigencia_id
    and v.id_usuario_pai = v_pai_id
  for key share;

  if v_inicio is null or v_fim is null then
    return jsonb_build_object('ok', false, 'codigo', 'TAREFA_INVALIDA');
  end if;

  if now() < v_inicio or now() > v_fim then
    return jsonb_build_object('ok', false, 'codigo', 'VIGENCIA_INATIVA');
  end if;

  v_data := timezone('America/Sao_Paulo', now())::date;

  if v_data < timezone('America/Sao_Paulo', v_inicio)::date
     or v_data > timezone('America/Sao_Paulo', v_fim)::date then
    return jsonb_build_object('ok', false, 'codigo', 'VIGENCIA_INATIVA');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_id_filho_tarefa::text || ':' || v_data::text,
      0
    )
  );

  if exists (
    select 1
    from public.t_revisao_tarefa_filho r
    where r.id_filho_tarefa = p_id_filho_tarefa
      and r.data_referencia = v_data
  ) then
    return jsonb_build_object('ok', false, 'codigo', 'REVISAO_JA_SOLICITADA');
  end if;

  if exists (
    select 1
    from public.t_ocorrencia o
    where o.id_filho_tarefa = p_id_filho_tarefa
      and timezone('America/Sao_Paulo', o.created_at)::date = v_data
  ) then
    return jsonb_build_object('ok', false, 'codigo', 'JA_MARCADA');
  end if;

  select f.nome, t.nome
    into v_nome_filho, v_nome_tarefa
  from public.t_filho f
  join public.t_tarefa t
    on t.id = v_tarefa_id
   and t.id_usuario_pai = v_pai_id
  where f.id = v_filho_id
    and f.id_usuario_pai = v_pai_id;

  if v_nome_filho is null or v_nome_tarefa is null then
    return jsonb_build_object('ok', false, 'codigo', 'TAREFA_INVALIDA');
  end if;

  insert into public.t_solicitacao_tarefa_filho (
    id_filho_tarefa,
    data_referencia,
    observacao
  )
  values (
    p_id_filho_tarefa,
    v_data,
    v_observacao
  )
  on conflict (id_filho_tarefa, data_referencia) do nothing
  returning id, status, created_at, resolvido_em
    into v_id, v_status, v_created_at, v_resolvido_em;

  if v_id is null then
    select s.id, s.status, s.created_at, s.resolvido_em, s.observacao
      into v_id, v_status, v_created_at, v_resolvido_em, v_observacao
    from public.t_solicitacao_tarefa_filho s
    where s.id_filho_tarefa = p_id_filho_tarefa
      and s.data_referencia = v_data;

    return jsonb_build_object(
      'ok', true,
      'criada', false,
      'id_usuario_pai', v_pai_id,
      'id_filho', v_filho_id,
      'nome_filho', v_nome_filho,
      'nome_tarefa', v_nome_tarefa,
      'solicitacao', jsonb_build_object(
        'id', v_id,
        'id_filho_tarefa', p_id_filho_tarefa,
        'data_referencia', v_data,
        'observacao', v_observacao,
        'status', v_status,
        'created_at', v_created_at,
        'resolvido_em', v_resolvido_em
      )
    );
  end if;

  update public.t_filho_acesso_app
  set ultimo_acesso_em = now(),
      updated_at = now()
  where token_hash = v_token_hash
    and ativo = true;

  return jsonb_build_object(
    'ok', true,
    'criada', true,
    'id_usuario_pai', v_pai_id,
    'id_filho', v_filho_id,
    'nome_filho', v_nome_filho,
    'nome_tarefa', v_nome_tarefa,
    'solicitacao', jsonb_build_object(
      'id', v_id,
      'id_filho_tarefa', p_id_filho_tarefa,
      'data_referencia', v_data,
      'observacao', v_observacao,
      'status', v_status,
      'created_at', v_created_at,
      'resolvido_em', v_resolvido_em
    )
  );
end;
$function$;

revoke all on function public.criar_solicitacao_tarefa_filho_interno(text,bigint,text)
from public, anon, authenticated, service_role;
grant execute on function public.criar_solicitacao_tarefa_filho_interno(text,bigint,text)
to service_role;

create or replace function public.montar_painel_app_filho(
  p_id_usuario_pai bigint,
  p_id_filho bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_painel jsonb;
  v_estrelas jsonb;
  v_solicitacoes jsonb;
  v_revisoes jsonb;
  v_hoje date;
begin
  v_painel := public.montar_painel_filho(p_id_usuario_pai, p_id_filho);

  if v_painel is null then
    return null;
  end if;

  v_estrelas := public.resumo_estrelas_filho_interno(
    p_id_usuario_pai,
    p_id_filho
  );

  v_hoje := timezone('America/Sao_Paulo', now())::date;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'id_filho_tarefa', s.id_filho_tarefa,
        'data_referencia', s.data_referencia,
        'observacao', s.observacao,
        'status', s.status,
        'created_at', s.created_at,
        'resolvido_em', s.resolvido_em
      )
      order by s.created_at desc
    ),
    '[]'::jsonb
  )
  into v_solicitacoes
  from public.t_solicitacao_tarefa_filho s
  join public.t_filho_tarefa ft
    on ft.id = s.id_filho_tarefa
  where ft.id_usuario_pai = p_id_usuario_pai
    and ft.id_filho = p_id_filho
    and s.data_referencia = v_hoje;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'id_filho_tarefa', r.id_filho_tarefa,
        'data_referencia', r.data_referencia,
        'observacao', r.observacao,
        'status', r.status,
        'created_at', r.created_at,
        'resolvido_em', r.resolvido_em
      )
      order by r.created_at desc
    ),
    '[]'::jsonb
  )
  into v_revisoes
  from public.t_revisao_tarefa_filho r
  join public.t_filho_tarefa ft
    on ft.id = r.id_filho_tarefa
  where ft.id_usuario_pai = p_id_usuario_pai
    and ft.id_filho = p_id_filho
    and r.data_referencia = v_hoje;

  return v_painel || jsonb_build_object(
    'estrelas',
    coalesce(v_estrelas, jsonb_build_object(
      'hoje', 0,
      'vigencia_atual', 0,
      'saldo', 0,
      'total_conquistado', 0,
      'recompensas', '[]'::jsonb,
      'resgates', '[]'::jsonb
    )),
    'solicitacoes_hoje',
    coalesce(v_solicitacoes, '[]'::jsonb),
    'revisoes_hoje',
    coalesce(v_revisoes, '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.montar_painel_app_filho(bigint,bigint)
from public, anon, authenticated, service_role;

create or replace function public.guard_assignment_history()
returns trigger
language plpgsql
set search_path = 'public'
as $function$
declare
  v_parentes_existentes boolean;
  v_tem_ocorrencia boolean;
  v_tem_solicitacao boolean;
  v_tem_solicitacao_pendente boolean;
  v_tem_revisao boolean;
  v_tem_revisao_pendente boolean;
begin
  select exists (
    select 1
    from public.t_ocorrencia o
    where o.id_filho_tarefa = old.id
  ) into v_tem_ocorrencia;

  select
    exists (
      select 1
      from public.t_solicitacao_tarefa_filho s
      where s.id_filho_tarefa = old.id
    ),
    exists (
      select 1
      from public.t_solicitacao_tarefa_filho s
      where s.id_filho_tarefa = old.id
        and s.status = 'PENDENTE'
    )
  into v_tem_solicitacao, v_tem_solicitacao_pendente;

  select
    exists (
      select 1
      from public.t_revisao_tarefa_filho r
      where r.id_filho_tarefa = old.id
    ),
    exists (
      select 1
      from public.t_revisao_tarefa_filho r
      where r.id_filho_tarefa = old.id
        and r.status = 'PENDENTE'
    )
  into v_tem_revisao, v_tem_revisao_pendente;

  if tg_op = 'DELETE' then
    select
      exists (select 1 from public.t_filho f where f.id = old.id_filho)
      and exists (select 1 from public.t_tarefa t where t.id = old.id_tarefa)
      and exists (select 1 from public.t_vigencia v where v.id = old.id_vigencia)
    into v_parentes_existentes;

    if v_parentes_existentes
       and (v_tem_ocorrencia or v_tem_solicitacao_pendente or v_tem_revisao_pendente) then
      if v_tem_ocorrencia then
        raise exception 'Atribuicao com Fez/Nao fez nao pode ser excluida diretamente';
      end if;
      if v_tem_revisao_pendente then
        raise exception 'Atribuicao com revisao pendente do filho nao pode ser excluida diretamente';
      end if;
      raise exception 'Atribuicao com aviso pendente do filho nao pode ser excluida diretamente';
    end if;

    return old;
  end if;

  -- Edicao continua bloqueada por qualquer historico do filho, mesmo resolvido:
  -- alterar o vinculo mudaria retroativamente o significado do aviso/revisao.
  if v_tem_ocorrencia then
    raise exception 'Atribuicao com Fez/Nao fez nao pode ser editada';
  end if;
  if v_tem_revisao then
    raise exception 'Atribuicao com revisao do filho nao pode ser editada';
  end if;
  if v_tem_solicitacao then
    raise exception 'Atribuicao com aviso do filho nao pode ser editada';
  end if;

  return new;
end;
$function$;

create or replace function public.excluir_vigencia_com_regra(
  p_id_vigencia bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pai_id bigint;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_tem_atribuicoes boolean;
  v_tem_historico boolean;
begin
  select p.id
    into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  select v.data_inicio, v.data_fim
    into v_inicio, v_fim
  from public.t_vigencia v
  where v.id = p_id_vigencia
    and v.id_usuario_pai = v_pai_id;

  if v_inicio is null or v_fim is null then
    raise exception 'Vigência não encontrada';
  end if;

  perform 1
  from public.t_filho_tarefa ft
  where ft.id_vigencia = p_id_vigencia
    and ft.id_usuario_pai = v_pai_id
  for update;

  select exists (
    select 1
    from public.t_filho_tarefa ft
    where ft.id_vigencia = p_id_vigencia
      and ft.id_usuario_pai = v_pai_id
  ) into v_tem_atribuicoes;

  select
    exists (
      select 1
      from public.t_ocorrencia o
      join public.t_filho_tarefa ft
        on ft.id = o.id_filho_tarefa
       and ft.id_usuario_pai = o.id_usuario_pai
      where ft.id_vigencia = p_id_vigencia
        and ft.id_usuario_pai = v_pai_id
    )
    or exists (
      select 1
      from public.t_solicitacao_tarefa_filho s
      join public.t_filho_tarefa ft
        on ft.id = s.id_filho_tarefa
      where ft.id_vigencia = p_id_vigencia
        and ft.id_usuario_pai = v_pai_id
        and s.status = 'PENDENTE'
    )
    or exists (
      select 1
      from public.t_revisao_tarefa_filho r
      join public.t_filho_tarefa ft
        on ft.id = r.id_filho_tarefa
      where ft.id_vigencia = p_id_vigencia
        and ft.id_usuario_pai = v_pai_id
        and r.status = 'PENDENTE'
    )
  into v_tem_historico;

  if v_tem_historico then
    raise exception 'Vigência com Fez/Não fez ou pedido pendente do filho não pode ser excluída';
  end if;

  if now() >= v_inicio
     and now() <= v_fim
     and v_tem_atribuicoes then
    raise exception 'Vigência em andamento com atribuições não pode ser excluída';
  end if;

  delete from public.t_filho_tarefa ft
  where ft.id_vigencia = p_id_vigencia
    and ft.id_usuario_pai = v_pai_id;

  delete from public.t_vigencia v
  where v.id = p_id_vigencia
    and v.id_usuario_pai = v_pai_id;

  return true;
end;
$function$;

revoke all on function public.excluir_vigencia_com_regra(bigint)
from public, anon;
grant execute on function public.excluir_vigencia_com_regra(bigint)
to authenticated;
