
-- Fecha o núcleo central de Fez/Não fez:
-- revisão aponta para ocorrência exata; efeitos deixam triggers dispersos;
-- reconciliador passa a orquestrar consequência, revisão, solicitação, estrelas,
-- recompensas, contador vivo e auditoria.

alter table public.t_revisao_tarefa_filho
  add column if not exists id_ocorrencia bigint;

update public.t_revisao_tarefa_filho r
set id_ocorrencia = (
  select o.id
  from public.t_ocorrencia o
  where o.id_filho_tarefa = r.id_filho_tarefa
    and timezone('America/Sao_Paulo', o.created_at)::date = r.data_referencia
    and o.tipo = 'NAO_FEZ'
  order by o.created_at desc, o.id desc
  limit 1
)
where r.id_ocorrencia is null;

do $$
begin
  if exists (
    select 1
    from public.t_revisao_tarefa_filho
    where id_ocorrencia is null
  ) then
    raise exception 'Há revisão sem ocorrência exata; corrija os dados antes de prosseguir';
  end if;
end;
$$;

alter table public.t_revisao_tarefa_filho
  alter column id_ocorrencia set not null;

alter table public.t_revisao_tarefa_filho
  drop constraint if exists t_revisao_tarefa_filho_ocorrencia_chk;

alter table public.t_revisao_tarefa_filho
  add constraint t_revisao_tarefa_filho_ocorrencia_chk
  check (id_ocorrencia > 0);

create unique index if not exists t_revisao_tarefa_filho_ocorrencia_uniq
  on public.t_revisao_tarefa_filho (id_ocorrencia);

comment on column public.t_revisao_tarefa_filho.id_ocorrencia is
'Identificador histórico exato da ocorrência NAO_FEZ contestada. Intencionalmente sem FK para a revisão sobreviver ao desfazer da marcação.';

create or replace function public.sincronizar_estrela_ocorrencia_interno(
  p_id_usuario_pai bigint,
  p_id_ocorrencia bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo text;
  v_filho_id bigint;
  v_vigencia_id bigint;
  v_tarefa_id bigint;
  v_filho_tarefa_id bigint;
  v_tarefa_nome text;
  v_data date;
begin
  select
    o.tipo,
    ft.id_filho,
    ft.id_vigencia,
    ft.id_tarefa,
    ft.id,
    t.nome,
    timezone('America/Sao_Paulo', o.created_at)::date
  into
    v_tipo,
    v_filho_id,
    v_vigencia_id,
    v_tarefa_id,
    v_filho_tarefa_id,
    v_tarefa_nome,
    v_data
  from public.t_ocorrencia o
  join public.t_filho_tarefa ft
    on ft.id = o.id_filho_tarefa
   and ft.id_usuario_pai = o.id_usuario_pai
  join public.t_tarefa t
    on t.id = ft.id_tarefa
   and t.id_usuario_pai = ft.id_usuario_pai
  where o.id = p_id_ocorrencia
    and o.id_usuario_pai = p_id_usuario_pai;

  if v_tipo is null or v_tipo <> 'FEZ' then
    delete from public.t_estrela_concessao c
    where c.id_usuario_pai = p_id_usuario_pai
      and c.id_ocorrencia_origem = p_id_ocorrencia;
    return;
  end if;

  insert into public.t_estrela_concessao (
    id_usuario_pai,
    id_filho,
    id_vigencia,
    id_tarefa,
    id_filho_tarefa_origem,
    id_ocorrencia_origem,
    tarefa_nome_snapshot,
    data_referencia,
    created_at
  )
  values (
    p_id_usuario_pai,
    v_filho_id,
    v_vigencia_id,
    v_tarefa_id,
    v_filho_tarefa_id,
    p_id_ocorrencia,
    v_tarefa_nome,
    v_data,
    now()
  )
  on conflict do nothing;
end;
$$;

create or replace function public.reconciliar_recompensas_estrelas_filho_interno(
  p_id_usuario_pai bigint,
  p_id_filho bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_marco integer;
  v_ciclo record;
begin
  perform 1
  from public.t_filho f
  where f.id = p_id_filho
    and f.id_usuario_pai = p_id_usuario_pai
  for update;

  if not found then
    return;
  end if;

  v_total := public.estrelas_total_conquistado_interno(
    p_id_usuario_pai,
    p_id_filho
  );

  for v_ciclo in
    select
      rr.id,
      rr.id_recompensa,
      coalesce(rr.meta_estrelas_no_resgate, rr.estrelas_utilizadas) as meta
    from public.t_recompensa_resgate rr
    where rr.id_usuario_pai = p_id_usuario_pai
      and rr.id_filho = p_id_filho
      and rr.status = 'PENDENTE'
    order by rr.id
    for update
  loop
    v_marco := public.marco_recompensa_estrelas_interno(
      p_id_usuario_pai,
      p_id_filho,
      v_ciclo.id_recompensa
    );

    if greatest(v_total - v_marco, 0) < v_ciclo.meta then
      update public.t_recompensa_resgate
      set status = 'CANCELADO',
          cancelado_em = now(),
          entregue_em = null,
          confirmado_por = null,
          updated_at = now()
      where id = v_ciclo.id
        and status = 'PENDENTE';
    end if;
  end loop;

  perform public.garantir_conquista_recompensa_estrelas_interno(
    p_id_usuario_pai,
    p_id_filho,
    null
  );
end;
$$;

drop trigger if exists trg_concessao_estrela_ocorrencia on public.t_ocorrencia;
drop function if exists public.registrar_concessao_estrela_ocorrencia();

drop trigger if exists encerrar_revisao_ao_desfazer_marcacao on public.t_ocorrencia;
drop trigger if exists resolver_revisao_ao_marcar_fez on public.t_ocorrencia;
drop trigger if exists resolver_solicitacao_tarefa_ao_marcar on public.t_ocorrencia;

drop function if exists public.encerrar_revisao_ao_desfazer_marcacao();
drop function if exists public.resolver_revisao_ao_marcar_fez();
drop function if exists public.resolver_solicitacao_tarefa_ao_marcar();

create or replace function public.criar_revisao_tarefa_filho_interno(
  p_token text,
  p_id_filho_tarefa bigint,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
  v_ocorrencia_id bigint;
  v_ocorrencia_tipo text;
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

  select o.id, o.tipo
    into v_ocorrencia_id, v_ocorrencia_tipo
  from public.t_ocorrencia o
  where o.id_filho_tarefa = p_id_filho_tarefa
    and o.id_usuario_pai = v_pai_id
    and timezone('America/Sao_Paulo', o.created_at)::date = v_data
  limit 1
  for update;

  if v_ocorrencia_id is null or v_ocorrencia_tipo <> 'NAO_FEZ' then
    return jsonb_build_object('ok', false, 'codigo', 'REVISAO_INDISPONIVEL');
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

  insert into public.t_revisao_tarefa_filho (
    id_filho_tarefa,
    id_ocorrencia,
    data_referencia,
    observacao
  )
  values (
    p_id_filho_tarefa,
    v_ocorrencia_id,
    v_data,
    v_observacao
  )
  on conflict (id_filho_tarefa, data_referencia) do nothing
  returning id, status, created_at, resolvido_em
    into v_id, v_status, v_created_at, v_resolvido_em;

  if v_id is null then
    select r.id, r.status, r.created_at, r.resolvido_em, r.observacao, r.id_ocorrencia
      into v_id, v_status, v_created_at, v_resolvido_em, v_observacao, v_ocorrencia_id
    from public.t_revisao_tarefa_filho r
    where r.id_filho_tarefa = p_id_filho_tarefa
      and r.data_referencia = v_data;

    return jsonb_build_object(
      'ok', true,
      'criada', false,
      'id_usuario_pai', v_pai_id,
      'id_filho', v_filho_id,
      'nome_filho', v_nome_filho,
      'nome_tarefa', v_nome_tarefa,
      'revisao', jsonb_build_object(
        'id', v_id,
        'id_ocorrencia', v_ocorrencia_id,
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
    'revisao', jsonb_build_object(
      'id', v_id,
      'id_ocorrencia', v_ocorrencia_id,
      'id_filho_tarefa', p_id_filho_tarefa,
      'data_referencia', v_data,
      'observacao', v_observacao,
      'status', v_status,
      'created_at', v_created_at,
      'resolvido_em', v_resolvido_em
    )
  );
end;
$$;

create or replace function public.reconciliar_ocorrencia(
  p_acao text,
  p_id_ocorrencia bigint default null,
  p_id_filho_tarefa bigint default null,
  p_created_at timestamptz default null,
  p_novo_tipo text default null,
  p_consequencia_tipo text default null,
  p_desconto_valor numeric default null,
  p_penalidade_descricao text default null,
  p_bonificacao_tipo text default null,
  p_bonificacao_descricao text default null,
  p_bonificacao_valor numeric default null,
  p_id_revisao bigint default null,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pai_id bigint;
  v_id_ocorrencia bigint;
  v_id_filho_tarefa bigint;
  v_id_filho bigint;
  v_id_vigencia bigint;
  v_id_tarefa bigint;
  v_tem_mesada boolean;
  v_valor_mesada numeric;
  v_created_at timestamptz;
  v_created_at_original timestamptz;
  v_tipo_anterior text;
  v_estado_anterior jsonb;
  v_estado_novo jsonb;
  v_conseq_anterior jsonb;
  v_conseq_nova jsonb;
  v_contador integer;
  v_acao text;
  v_novo_tipo text;
  v_consequencia text;
  v_desconto_efetivo numeric;
  v_penalidade_efetiva text;
  v_bonus_comando text;
  v_bonus_tipo_efetivo text;
  v_bonus_descricao_efetiva text;
  v_bonus_valor_efetivo numeric;
  v_revisao_status text;
  v_revisao_occ bigint;
  v_revisao_ft bigint;
  v_revisao_data date;
  v_data date;
begin
  select p.id
    into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  v_acao := upper(btrim(coalesce(p_acao, '')));
  if v_acao not in ('SALVAR','DESFAZER','CUMPRIR_PENALIDADE','RESOLVER_REVISAO') then
    raise exception 'Ação de reconciliação inválida';
  end if;

  if p_id_ocorrencia is not null then
    select
      o.id,
      o.id_filho_tarefa,
      o.created_at,
      o.created_at,
      o.tipo,
      jsonb_build_object(
        'id', o.id,
        'id_filho_tarefa', o.id_filho_tarefa,
        'tipo', o.tipo,
        'created_at', o.created_at,
        'bonificacao_tipo', o.bonificacao_tipo,
        'bonificacao_descricao', o.bonificacao_descricao,
        'bonificacao_valor', o.bonificacao_valor
      )
    into
      v_id_ocorrencia,
      v_id_filho_tarefa,
      v_created_at,
      v_created_at_original,
      v_tipo_anterior,
      v_estado_anterior
    from public.t_ocorrencia o
    where o.id = p_id_ocorrencia
      and o.id_usuario_pai = v_pai_id
    for update;

    if v_id_ocorrencia is null then
      raise exception 'Ocorrência não encontrada';
    end if;
  else
    v_id_filho_tarefa := p_id_filho_tarefa;
    v_created_at := coalesce(p_created_at, now());
  end if;

  if p_id_filho_tarefa is not null
     and v_id_filho_tarefa is distinct from p_id_filho_tarefa then
    raise exception 'Não é permitido mover uma ocorrência para outra atribuição';
  end if;

  if v_id_filho_tarefa is null then
    raise exception 'Informe a atribuição';
  end if;

  if v_id_ocorrencia is not null
     and p_created_at is not null
     and timezone('America/Sao_Paulo', p_created_at)::date
         is distinct from timezone('America/Sao_Paulo', v_created_at_original)::date then
    raise exception 'Para mudar a data, desfaça a marcação e registre uma nova ocorrência';
  end if;

  if p_created_at is not null then
    v_created_at := p_created_at;
  end if;

  v_data := timezone('America/Sao_Paulo', v_created_at)::date;

  select
    ft.id_filho,
    ft.id_vigencia,
    ft.id_tarefa,
    coalesce(f.tem_mesada_opcional, false) and f.valor_mesada is not null,
    f.valor_mesada
  into
    v_id_filho,
    v_id_vigencia,
    v_id_tarefa,
    v_tem_mesada,
    v_valor_mesada
  from public.t_filho_tarefa ft
  join public.t_filho f
    on f.id = ft.id_filho
   and f.id_usuario_pai = ft.id_usuario_pai
  where ft.id = v_id_filho_tarefa
    and ft.id_usuario_pai = v_pai_id
  for key share of ft, f;

  if v_id_filho is null then
    raise exception 'Atribuição não encontrada para este responsável';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_id_filho_tarefa::text || ':' || v_data::text,
      0
    )
  );

  if v_id_ocorrencia is not null then
    select jsonb_build_object(
      'tipo', c.tipo,
      'desconto_valor', c.desconto_valor,
      'penalidade_descricao', c.penalidade_descricao,
      'status', c.status,
      'cumprida_em', c.cumprida_em,
      'cancelada_em', c.cancelada_em
    )
    into v_conseq_anterior
    from public.t_ocorrencia_consequencia c
    where c.id_ocorrencia = v_id_ocorrencia
      and c.id_usuario_pai = v_pai_id
    for update;
  end if;

  if v_acao = 'CUMPRIR_PENALIDADE' then
    if v_id_ocorrencia is null then
      raise exception 'Informe a ocorrência da penalidade';
    end if;

    update public.t_ocorrencia_consequencia
    set status = 'CUMPRIDA',
        cumprida_em = coalesce(cumprida_em, now()),
        cancelada_em = null,
        updated_at = now()
    where id_usuario_pai = v_pai_id
      and id_ocorrencia = v_id_ocorrencia
      and tipo = 'PENALIDADE'
      and status = 'PENDENTE';

    if not found then
      raise exception 'Penalidade pendente não encontrada';
    end if;

  elsif v_acao = 'DESFAZER' then
    if v_id_ocorrencia is null then
      raise exception 'Informe a ocorrência a desfazer';
    end if;

    update public.t_revisao_tarefa_filho
    set status = 'MARCACAO_DESFEITA',
        resolvido_em = now()
    where id_ocorrencia = v_id_ocorrencia
      and status = 'PENDENTE';

    delete from public.t_estrela_concessao
    where id_usuario_pai = v_pai_id
      and id_ocorrencia_origem = v_id_ocorrencia;

    delete from public.t_ocorrencia
    where id = v_id_ocorrencia
      and id_usuario_pai = v_pai_id;

    perform public.reconciliar_recompensas_estrelas_filho_interno(
      v_pai_id,
      v_id_filho
    );

    insert into public.t_ocorrencia_reconciliacao (
      id_usuario_pai, id_ocorrencia, id_filho_tarefa, acao, origem,
      id_revisao, estado_anterior, estado_novo, motivo
    ) values (
      v_pai_id, v_id_ocorrencia, v_id_filho_tarefa, 'DESFAZER',
      case when p_id_revisao is null then 'RESPONSAVEL' else 'REVISAO' end,
      p_id_revisao,
      v_estado_anterior || jsonb_build_object('consequencia', v_conseq_anterior),
      null,
      nullif(btrim(coalesce(p_motivo,'')), '')
    );

    v_contador := public.contar_nao_fez_filho_vigencia(
      v_id_filho,
      v_id_vigencia
    );

    return jsonb_build_object(
      'ok', true,
      'acao', 'DESFAZER',
      'id_ocorrencia', v_id_ocorrencia,
      'id_filho', v_id_filho,
      'id_vigencia', v_id_vigencia,
      'contador_nao_fez_vigencia', v_contador
    );

  else
    if v_acao = 'RESOLVER_REVISAO' then
      if p_id_revisao is null or v_id_ocorrencia is null then
        raise exception 'Informe a revisão e a ocorrência';
      end if;

      select r.status, r.id_ocorrencia, r.id_filho_tarefa, r.data_referencia
        into v_revisao_status, v_revisao_occ, v_revisao_ft, v_revisao_data
      from public.t_revisao_tarefa_filho r
      join public.t_filho_tarefa ft
        on ft.id = r.id_filho_tarefa
       and ft.id_usuario_pai = v_pai_id
      where r.id = p_id_revisao
      for update of r;

      if v_revisao_status is null then
        raise exception 'Revisão não encontrada';
      end if;

      if v_revisao_status <> 'PENDENTE' then
        raise exception 'Esta revisão já foi encerrada';
      end if;

      if v_revisao_occ <> v_id_ocorrencia
         or v_revisao_ft <> v_id_filho_tarefa
         or v_revisao_data <> v_data then
        raise exception 'A revisão não pertence a esta ocorrência';
      end if;

      if v_tipo_anterior <> 'NAO_FEZ' then
        raise exception 'A revisão não pertence mais a um Não fez';
      end if;
    end if;

    v_novo_tipo := upper(btrim(coalesce(p_novo_tipo, '')));
    if v_novo_tipo not in ('FEZ','NAO_FEZ') then
      raise exception 'Tipo de ocorrência inválido';
    end if;

    if v_novo_tipo = 'FEZ' then
      if p_consequencia_tipo is not null
         or p_desconto_valor is not null
         or nullif(btrim(coalesce(p_penalidade_descricao,'')), '') is not null then
        raise exception 'Fez não pode receber consequência de Não fez';
      end if;

      v_bonus_comando := case
        when p_bonificacao_tipo is null then null
        else upper(btrim(p_bonificacao_tipo))
      end;

      if v_bonus_comando is not null
         and v_bonus_comando not in ('NENHUMA','TEXTO','VALOR') then
        raise exception 'Tipo de bonificação inválido';
      end if;

      if v_id_ocorrencia is not null
         and v_tipo_anterior = 'FEZ'
         and v_bonus_comando is null then
        select o.bonificacao_tipo, o.bonificacao_descricao, o.bonificacao_valor
          into v_bonus_tipo_efetivo, v_bonus_descricao_efetiva, v_bonus_valor_efetivo
        from public.t_ocorrencia o
        where o.id = v_id_ocorrencia;
      elsif v_bonus_comando = 'TEXTO' then
        v_bonus_tipo_efetivo := 'TEXTO';
        v_bonus_descricao_efetiva := nullif(btrim(coalesce(p_bonificacao_descricao,'')), '');
        v_bonus_valor_efetivo := null;

        if v_bonus_descricao_efetiva is null then
          raise exception 'Informe a bonificação escrita';
        end if;
      elsif v_bonus_comando = 'VALOR' then
        if p_bonificacao_valor is null or p_bonificacao_valor < 0 then
          raise exception 'Informe um valor de bonificação válido';
        end if;

        v_bonus_tipo_efetivo := 'VALOR';
        v_bonus_descricao_efetiva := null;
        v_bonus_valor_efetivo := p_bonificacao_valor;
      else
        v_bonus_tipo_efetivo := null;
        v_bonus_descricao_efetiva := null;
        v_bonus_valor_efetivo := null;
      end if;

    else
      if p_bonificacao_tipo is not null
         or p_bonificacao_descricao is not null
         or p_bonificacao_valor is not null then
        raise exception 'Não fez não pode receber bonificação de Fez';
      end if;

      if p_consequencia_tipo is null
         and v_id_ocorrencia is not null
         and v_tipo_anterior = 'NAO_FEZ' then
        if v_conseq_anterior is null then
          v_consequencia := 'NENHUMA';
        else
          v_consequencia := upper(v_conseq_anterior->>'tipo');
          v_desconto_efetivo := nullif(v_conseq_anterior->>'desconto_valor','')::numeric;
          v_penalidade_efetiva := nullif(v_conseq_anterior->>'penalidade_descricao','');
        end if;
      else
        v_consequencia := upper(btrim(coalesce(p_consequencia_tipo, 'NENHUMA')));
        v_desconto_efetivo := p_desconto_valor;
        v_penalidade_efetiva := nullif(btrim(coalesce(p_penalidade_descricao,'')), '');
      end if;

      if v_consequencia not in ('NENHUMA','DESCONTO','PENALIDADE') then
        raise exception 'Consequência do Não fez inválida';
      end if;

      if v_consequencia = 'DESCONTO' then
        if not v_tem_mesada then
          raise exception 'Desconto de mesada só pode ser aplicado a filho com mesada cadastrada';
        end if;

        if v_desconto_efetivo is null or v_desconto_efetivo <= 0 then
          raise exception 'Informe um valor de desconto válido';
        end if;

        if v_desconto_efetivo > v_valor_mesada then
          raise exception 'O desconto desta ocorrência não pode ser maior que a mesada cadastrada';
        end if;

      elsif v_consequencia = 'PENALIDADE' then
        if v_penalidade_efetiva is null
           or char_length(v_penalidade_efetiva) not between 2 and 200 then
          raise exception 'Informe uma penalidade entre 2 e 200 caracteres';
        end if;
      end if;
    end if;

    if v_id_ocorrencia is null then
      insert into public.t_ocorrencia (
        id_usuario_pai,
        id_filho_tarefa,
        tipo,
        created_at,
        bonificacao_tipo,
        bonificacao_descricao,
        bonificacao_valor
      )
      values (
        v_pai_id,
        v_id_filho_tarefa,
        v_novo_tipo,
        v_created_at,
        case when v_novo_tipo='FEZ' then v_bonus_tipo_efetivo else null end,
        case when v_novo_tipo='FEZ' then v_bonus_descricao_efetiva else null end,
        case when v_novo_tipo='FEZ' then v_bonus_valor_efetivo else null end
      )
      returning id, created_at
        into v_id_ocorrencia, v_created_at;

      v_estado_anterior := null;
      v_tipo_anterior := null;
    else
      update public.t_ocorrencia
      set tipo = v_novo_tipo,
          created_at = v_created_at,
          bonificacao_tipo =
            case when v_novo_tipo='FEZ' then v_bonus_tipo_efetivo else null end,
          bonificacao_descricao =
            case when v_novo_tipo='FEZ' then v_bonus_descricao_efetiva else null end,
          bonificacao_valor =
            case when v_novo_tipo='FEZ' then v_bonus_valor_efetivo else null end
      where id = v_id_ocorrencia
        and id_usuario_pai = v_pai_id;
    end if;

    if v_novo_tipo = 'FEZ' then
      update public.t_ocorrencia_consequencia
      set status =
            case
              when tipo='DESCONTO' and status='APLICADO' then 'ESTORNADO'
              when tipo='PENALIDADE' and status='PENDENTE' then 'CANCELADA'
              else status
            end,
          cancelada_em =
            case
              when tipo='PENALIDADE' and status='PENDENTE' then now()
              else cancelada_em
            end,
          updated_at = now()
      where id_usuario_pai = v_pai_id
        and id_ocorrencia = v_id_ocorrencia;

    elsif v_consequencia = 'NENHUMA' then
      delete from public.t_ocorrencia_consequencia
      where id_usuario_pai = v_pai_id
        and id_ocorrencia = v_id_ocorrencia;

    elsif v_consequencia = 'DESCONTO' then
      insert into public.t_ocorrencia_consequencia (
        id_usuario_pai,
        id_ocorrencia,
        tipo,
        desconto_valor,
        penalidade_descricao,
        status,
        cumprida_em,
        cancelada_em
      )
      values (
        v_pai_id,
        v_id_ocorrencia,
        'DESCONTO',
        v_desconto_efetivo,
        null,
        'APLICADO',
        null,
        null
      )
      on conflict (id_ocorrencia) do update
      set tipo = 'DESCONTO',
          desconto_valor = excluded.desconto_valor,
          penalidade_descricao = null,
          status = 'APLICADO',
          cumprida_em = null,
          cancelada_em = null,
          updated_at = now();

    else
      if p_consequencia_tipo is null
         and v_tipo_anterior = 'NAO_FEZ'
         and v_conseq_anterior->>'tipo' = 'PENALIDADE'
         and v_conseq_anterior->>'status' = 'CUMPRIDA' then
        null;
      else
        insert into public.t_ocorrencia_consequencia (
          id_usuario_pai,
          id_ocorrencia,
          tipo,
          desconto_valor,
          penalidade_descricao,
          status,
          cumprida_em,
          cancelada_em
        )
        values (
          v_pai_id,
          v_id_ocorrencia,
          'PENALIDADE',
          null,
          v_penalidade_efetiva,
          'PENDENTE',
          null,
          null
        )
        on conflict (id_ocorrencia) do update
        set tipo = 'PENALIDADE',
            desconto_valor = null,
            penalidade_descricao = excluded.penalidade_descricao,
            status = 'PENDENTE',
            cumprida_em = null,
            cancelada_em = null,
            updated_at = now();
      end if;
    end if;

    if v_acao = 'RESOLVER_REVISAO' then
      update public.t_revisao_tarefa_filho
      set status = case
            when v_novo_tipo='FEZ' then 'ALTERADO_PARA_FEZ'
            else 'MANTEVE_NAO_FEZ'
          end,
          resolvido_em = now()
      where id = p_id_revisao
        and id_ocorrencia = v_id_ocorrencia
        and status = 'PENDENTE';

    elsif v_novo_tipo = 'FEZ' then
      update public.t_revisao_tarefa_filho
      set status = 'ALTERADO_PARA_FEZ',
          resolvido_em = now()
      where id_ocorrencia = v_id_ocorrencia
        and status = 'PENDENTE';
    end if;

    update public.t_solicitacao_tarefa_filho s
    set status = case
          when v_novo_tipo='FEZ' then 'RESOLVIDA_FEZ'
          else 'RESOLVIDA_NAO_FEZ'
        end,
        resolvido_em = now()
    where s.id_filho_tarefa = v_id_filho_tarefa
      and s.data_referencia = v_data
      and s.status = 'PENDENTE';

    perform public.sincronizar_estrela_ocorrencia_interno(
      v_pai_id,
      v_id_ocorrencia
    );

    perform public.reconciliar_recompensas_estrelas_filho_interno(
      v_pai_id,
      v_id_filho
    );
  end if;

  select jsonb_build_object(
    'id', o.id,
    'id_filho_tarefa', o.id_filho_tarefa,
    'tipo', o.tipo,
    'created_at', o.created_at,
    'bonificacao_tipo', o.bonificacao_tipo,
    'bonificacao_descricao', o.bonificacao_descricao,
    'bonificacao_valor', o.bonificacao_valor
  )
  into v_estado_novo
  from public.t_ocorrencia o
  where o.id = v_id_ocorrencia;

  select jsonb_build_object(
    'tipo', c.tipo,
    'desconto_valor', c.desconto_valor,
    'penalidade_descricao', c.penalidade_descricao,
    'status', c.status,
    'cumprida_em', c.cumprida_em,
    'cancelada_em', c.cancelada_em
  )
  into v_conseq_nova
  from public.t_ocorrencia_consequencia c
  where c.id_ocorrencia = v_id_ocorrencia
    and c.id_usuario_pai = v_pai_id;

  insert into public.t_ocorrencia_reconciliacao (
    id_usuario_pai,
    id_ocorrencia,
    id_filho_tarefa,
    acao,
    origem,
    id_revisao,
    estado_anterior,
    estado_novo,
    motivo
  )
  values (
    v_pai_id,
    v_id_ocorrencia,
    v_id_filho_tarefa,
    case
      when v_acao='CUMPRIR_PENALIDADE' then 'CUMPRIR_PENALIDADE'
      when v_acao='RESOLVER_REVISAO' then 'RESOLVER_REVISAO'
      when v_estado_anterior is null then 'CRIAR'
      else 'ALTERAR'
    end,
    case when v_acao='RESOLVER_REVISAO' then 'REVISAO' else 'RESPONSAVEL' end,
    p_id_revisao,
    case
      when v_estado_anterior is null then null
      else v_estado_anterior || jsonb_build_object('consequencia', v_conseq_anterior)
    end,
    v_estado_novo || jsonb_build_object('consequencia', v_conseq_nova),
    nullif(btrim(coalesce(p_motivo,'')), '')
  );

  v_contador := public.contar_nao_fez_filho_vigencia(
    v_id_filho,
    v_id_vigencia
  );

  return jsonb_build_object(
    'ok', true,
    'acao', v_acao,
    'id_ocorrencia', v_id_ocorrencia,
    'id_filho', v_id_filho,
    'id_vigencia', v_id_vigencia,
    'contador_nao_fez_vigencia', v_contador,
    'ocorrencia', v_estado_novo,
    'consequencia', v_conseq_nova,
    'estrelas', public.resumo_estrelas_filho_interno(v_pai_id, v_id_filho)
  );
end;
$$;

create or replace function public.resolver_revisao_tarefa_filho(
  p_id_revisao bigint,
  p_decisao text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pai_id bigint;
  v_id_ocorrencia bigint;
  v_decisao text;
begin
  select p.id
    into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  v_decisao := upper(btrim(coalesce(p_decisao,'')));

  if v_decisao not in ('MANTER_NAO_FEZ','ALTERAR_PARA_FEZ') then
    raise exception 'Decisão de revisão inválida';
  end if;

  select r.id_ocorrencia
    into v_id_ocorrencia
  from public.t_revisao_tarefa_filho r
  join public.t_filho_tarefa ft
    on ft.id = r.id_filho_tarefa
   and ft.id_usuario_pai = v_pai_id
  where r.id = p_id_revisao;

  if v_id_ocorrencia is null then
    raise exception 'Revisão não encontrada';
  end if;

  perform public.reconciliar_ocorrencia(
    'RESOLVER_REVISAO',
    v_id_ocorrencia,
    null,
    null,
    case
      when v_decisao='ALTERAR_PARA_FEZ' then 'FEZ'
      else 'NAO_FEZ'
    end,
    null,
    null,
    null,
    null,
    null,
    null,
    p_id_revisao,
    'Decisão de revisão do filho'
  );

  return true;
end;
$$;

create or replace function public.concluir_ciclo_recompensa_interno(
  p_id_usuario_pai bigint,
  p_id_filho bigint,
  p_id_recompensa bigint,
  p_confirmado_por text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recompensa_nome text;
  v_resgate_id bigint;
  v_meta integer;
  v_total integer;
  v_ultimo_id bigint;
  v_ultimo_total integer;
  v_ultimo_entregue_em timestamptz;
  v_ultimo_confirmado_por text;
begin
  if p_confirmado_por not in ('FILHO', 'RESPONSAVEL') then
    return jsonb_build_object('ok', false, 'codigo', 'ORIGEM_CONFIRMACAO_INVALIDA');
  end if;

  if p_id_recompensa is null or p_id_recompensa <= 0 then
    return jsonb_build_object('ok', false, 'codigo', 'RECOMPENSA_INVALIDA');
  end if;

  perform 1
  from public.t_filho f
  where f.id = p_id_filho
    and f.id_usuario_pai = p_id_usuario_pai
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'RECOMPENSA_INVALIDA');
  end if;

  select r.nome
    into v_recompensa_nome
  from public.t_recompensa_estrela r
  where r.id = p_id_recompensa
    and r.id_usuario_pai = p_id_usuario_pai
    and r.id_filho = p_id_filho
    and r.ativo = true;

  if v_recompensa_nome is null then
    return jsonb_build_object('ok', false, 'codigo', 'RECOMPENSA_INVALIDA');
  end if;

  perform public.reconciliar_recompensas_estrelas_filho_interno(
    p_id_usuario_pai,
    p_id_filho
  );

  select
    rr.id,
    coalesce(rr.meta_estrelas_no_resgate, rr.estrelas_utilizadas)
    into v_resgate_id, v_meta
  from public.t_recompensa_resgate rr
  where rr.id_usuario_pai = p_id_usuario_pai
    and rr.id_filho = p_id_filho
    and rr.id_recompensa = p_id_recompensa
    and rr.status = 'PENDENTE'
  order by rr.created_at desc, rr.id desc
  limit 1
  for update;

  v_total := public.estrelas_total_conquistado_interno(
    p_id_usuario_pai,
    p_id_filho
  );

  if v_resgate_id is null then
    select
      rr.id,
      rr.total_estrelas_no_resgate,
      rr.entregue_em,
      rr.confirmado_por
      into
        v_ultimo_id,
        v_ultimo_total,
        v_ultimo_entregue_em,
        v_ultimo_confirmado_por
    from public.t_recompensa_resgate rr
    where rr.id_usuario_pai = p_id_usuario_pai
      and rr.id_filho = p_id_filho
      and rr.id_recompensa = p_id_recompensa
      and rr.status = 'ENTREGUE'
    order by rr.entregue_em desc nulls last, rr.id desc
    limit 1;

    if v_ultimo_id is not null
       and v_ultimo_total = v_total
       and v_ultimo_entregue_em >= now() - interval '2 minutes' then
      return jsonb_build_object(
        'ok', true,
        'concluida', false,
        'ja_concluida', true,
        'id_usuario_pai', p_id_usuario_pai,
        'id_filho', p_id_filho,
        'confirmado_por', v_ultimo_confirmado_por,
        'recompensa', jsonb_build_object(
          'id', p_id_recompensa,
          'nome', v_recompensa_nome,
          'id_ciclo', v_ultimo_id
        )
      );
    end if;

    return jsonb_build_object('ok', false, 'codigo', 'RECOMPENSA_INDISPONIVEL');
  end if;

  update public.t_recompensa_resgate
  set status = 'ENTREGUE',
      total_estrelas_no_resgate = v_total,
      entregue_em = now(),
      cancelado_em = null,
      confirmado_por = p_confirmado_por,
      updated_at = now()
  where id = v_resgate_id
    and id_usuario_pai = p_id_usuario_pai
    and id_filho = p_id_filho;

  return jsonb_build_object(
    'ok', true,
    'concluida', true,
    'ja_concluida', false,
    'id_usuario_pai', p_id_usuario_pai,
    'id_filho', p_id_filho,
    'confirmado_por', p_confirmado_por,
    'recompensa', jsonb_build_object(
      'id', p_id_recompensa,
      'nome', v_recompensa_nome,
      'meta_estrelas', v_meta,
      'total_estrelas_na_conclusao', v_total,
      'id_ciclo', v_resgate_id
    )
  );
end;
$$;

revoke insert, update, delete on public.t_ocorrencia from anon, authenticated;

comment on function public.reconciliar_ocorrencia(
  text,bigint,bigint,timestamptz,text,text,numeric,text,text,text,numeric,bigint,text
) is
'Única operação transacional de mutação de Fez/Não fez. Centraliza ocorrência, consequência, revisão, solicitação do filho, estrelas, recompensas, contador vivo e auditoria.';
