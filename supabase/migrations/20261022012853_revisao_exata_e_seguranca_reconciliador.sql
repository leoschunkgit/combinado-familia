
-- Fechamentos adicionais do núcleo:
-- - revisão pede uma ocorrência exata, inclusive de dia anterior dentro da vigência;
-- - penalidade pendente fica suspensa durante revisão;
-- - não existe limite artificial do valor de desconto além de ser positivo e exigir mesada;
-- - tabelas derivadas e helpers internos não podem ser mutados/chamados diretamente pelo cliente.

-- Segurança das tabelas derivadas.
revoke insert, update, delete on public.t_ocorrencia_consequencia from anon, authenticated;
revoke insert, update, delete on public.t_ocorrencia_reconciliacao from anon, authenticated;

-- Helpers internos não são RPCs públicas.
revoke all on function public.sincronizar_estrela_ocorrencia_interno(bigint,bigint) from public;
revoke all on function public.reconciliar_recompensas_estrelas_filho_interno(bigint,bigint) from public;

-- Auditoria também contempla o pedido de revisão.
alter table public.t_ocorrencia_reconciliacao
  drop constraint if exists t_ocorrencia_reconciliacao_acao_check;

alter table public.t_ocorrencia_reconciliacao
  add constraint t_ocorrencia_reconciliacao_acao_check
  check (acao in (
    'CRIAR',
    'ALTERAR',
    'DESFAZER',
    'CUMPRIR_PENALIDADE',
    'SOLICITAR_REVISAO',
    'RESOLVER_REVISAO'
  ));

-- Penalidade pode ficar suspensa enquanto o responsável decide a revisão.
alter table public.t_ocorrencia_consequencia
  drop constraint if exists t_ocorrencia_consequencia_status_check;

alter table public.t_ocorrencia_consequencia
  add constraint t_ocorrencia_consequencia_status_check
  check (status in (
    'APLICADO',
    'PENDENTE',
    'SUSPENSA_REVISAO',
    'CUMPRIDA',
    'CANCELADA',
    'ESTORNADO'
  ));

alter table public.t_ocorrencia_consequencia
  drop constraint if exists t_ocorrencia_consequencia_coerencia_chk;

alter table public.t_ocorrencia_consequencia
  add constraint t_ocorrencia_consequencia_coerencia_chk
  check (
    (
      tipo = 'DESCONTO'
      and desconto_valor is not null
      and penalidade_descricao is null
      and status in ('APLICADO','ESTORNADO')
      and cumprida_em is null
    )
    or
    (
      tipo = 'PENALIDADE'
      and desconto_valor is null
      and penalidade_descricao is not null
      and char_length(btrim(penalidade_descricao)) between 2 and 200
      and status in ('PENDENTE','SUSPENSA_REVISAO','CUMPRIDA','CANCELADA')
    )
  );

-- Remove a antiga API que identificava revisão apenas pela atribuição/data de hoje.
drop function if exists public.criar_revisao_tarefa_filho_interno(text,bigint,text);

create or replace function public.criar_revisao_ocorrencia_filho_interno(
  p_token text,
  p_id_ocorrencia bigint,
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
  v_id_filho_tarefa bigint;
  v_vigencia_id bigint;
  v_tarefa_id bigint;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_nome_filho text;
  v_nome_tarefa text;
  v_data date;
  v_observacao text;
  v_tipo text;
  v_id bigint;
  v_status text;
  v_created_at timestamptz;
  v_resolvido_em timestamptz;
  v_conseq_antes jsonb;
  v_conseq_depois jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'codigo', 'SESSAO_INVALIDA');
  end if;

  if p_id_ocorrencia is null or p_id_ocorrencia <= 0 then
    return jsonb_build_object('ok', false, 'codigo', 'OCORRENCIA_INVALIDA');
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

  select
    o.id_filho_tarefa,
    o.tipo,
    timezone('America/Sao_Paulo', o.created_at)::date,
    ft.id_vigencia,
    ft.id_tarefa
  into
    v_id_filho_tarefa,
    v_tipo,
    v_data,
    v_vigencia_id,
    v_tarefa_id
  from public.t_ocorrencia o
  join public.t_filho_tarefa ft
    on ft.id = o.id_filho_tarefa
   and ft.id_usuario_pai = o.id_usuario_pai
  where o.id = p_id_ocorrencia
    and o.id_usuario_pai = v_pai_id
    and ft.id_filho = v_filho_id
  for update of o;

  if v_id_filho_tarefa is null then
    return jsonb_build_object('ok', false, 'codigo', 'OCORRENCIA_INVALIDA');
  end if;

  if v_tipo <> 'NAO_FEZ' then
    return jsonb_build_object('ok', false, 'codigo', 'REVISAO_INDISPONIVEL');
  end if;

  select v.data_inicio, v.data_fim
    into v_inicio, v_fim
  from public.t_vigencia v
  where v.id = v_vigencia_id
    and v.id_usuario_pai = v_pai_id
  for key share;

  if v_inicio is null or v_fim is null then
    return jsonb_build_object('ok', false, 'codigo', 'OCORRENCIA_INVALIDA');
  end if;

  -- A revisão pode ser pedida depois do dia da marcação, mas apenas enquanto
  -- a vigência correspondente ainda estiver em andamento.
  if now() < v_inicio or now() > v_fim then
    return jsonb_build_object('ok', false, 'codigo', 'VIGENCIA_INATIVA');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_id_filho_tarefa::text || ':' || v_data::text,
      0
    )
  );

  select f.nome, t.nome
    into v_nome_filho, v_nome_tarefa
  from public.t_filho f
  join public.t_tarefa t
    on t.id = v_tarefa_id
   and t.id_usuario_pai = v_pai_id
  where f.id = v_filho_id
    and f.id_usuario_pai = v_pai_id;

  if v_nome_filho is null or v_nome_tarefa is null then
    return jsonb_build_object('ok', false, 'codigo', 'OCORRENCIA_INVALIDA');
  end if;

  insert into public.t_revisao_tarefa_filho (
    id_filho_tarefa,
    id_ocorrencia,
    data_referencia,
    observacao
  )
  values (
    v_id_filho_tarefa,
    p_id_ocorrencia,
    v_data,
    v_observacao
  )
  on conflict (id_ocorrencia) do nothing
  returning id, status, created_at, resolvido_em
    into v_id, v_status, v_created_at, v_resolvido_em;

  if v_id is null then
    select r.id, r.status, r.created_at, r.resolvido_em, r.observacao
      into v_id, v_status, v_created_at, v_resolvido_em, v_observacao
    from public.t_revisao_tarefa_filho r
    where r.id_ocorrencia = p_id_ocorrencia;

    return jsonb_build_object(
      'ok', true,
      'criada', false,
      'id_usuario_pai', v_pai_id,
      'id_filho', v_filho_id,
      'nome_filho', v_nome_filho,
      'nome_tarefa', v_nome_tarefa,
      'revisao', jsonb_build_object(
        'id', v_id,
        'id_ocorrencia', p_id_ocorrencia,
        'id_filho_tarefa', v_id_filho_tarefa,
        'data_referencia', v_data,
        'observacao', v_observacao,
        'status', v_status,
        'created_at', v_created_at,
        'resolvido_em', v_resolvido_em
      )
    );
  end if;

  select jsonb_build_object(
    'tipo', c.tipo,
    'desconto_valor', c.desconto_valor,
    'penalidade_descricao', c.penalidade_descricao,
    'status', c.status,
    'cumprida_em', c.cumprida_em,
    'cancelada_em', c.cancelada_em
  )
  into v_conseq_antes
  from public.t_ocorrencia_consequencia c
  where c.id_usuario_pai = v_pai_id
    and c.id_ocorrencia = p_id_ocorrencia
  for update;

  -- Só penalidade ainda pendente é suspensa. Desconto permanece aplicado;
  -- penalidade já cumprida permanece como fato histórico.
  update public.t_ocorrencia_consequencia
  set status = 'SUSPENSA_REVISAO',
      updated_at = now()
  where id_usuario_pai = v_pai_id
    and id_ocorrencia = p_id_ocorrencia
    and tipo = 'PENALIDADE'
    and status = 'PENDENTE';

  select jsonb_build_object(
    'tipo', c.tipo,
    'desconto_valor', c.desconto_valor,
    'penalidade_descricao', c.penalidade_descricao,
    'status', c.status,
    'cumprida_em', c.cumprida_em,
    'cancelada_em', c.cancelada_em
  )
  into v_conseq_depois
  from public.t_ocorrencia_consequencia c
  where c.id_usuario_pai = v_pai_id
    and c.id_ocorrencia = p_id_ocorrencia;

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
    p_id_ocorrencia,
    v_id_filho_tarefa,
    'SOLICITAR_REVISAO',
    'REVISAO',
    v_id,
    jsonb_build_object('consequencia', v_conseq_antes),
    jsonb_build_object('consequencia', v_conseq_depois),
    'Pedido de revisão do filho'
  );

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
      'id_ocorrencia', p_id_ocorrencia,
      'id_filho_tarefa', v_id_filho_tarefa,
      'data_referencia', v_data,
      'observacao', v_observacao,
      'status', v_status,
      'created_at', v_created_at,
      'resolvido_em', v_resolvido_em
    )
  );
end;
$$;

revoke all on function public.criar_revisao_ocorrencia_filho_interno(text,bigint,text) from public;

-- Ajusta o reconciliador:
-- 1) desconto positivo sem um teto inventado pela mesada;
-- 2) penalidade suspensa por revisão também é cancelada ao virar FEZ.
do $$
declare
  v_ddl text;
begin
  select pg_get_functiondef(p.oid)
    into v_ddl
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='reconciliar_ocorrencia'
  limit 1;

  if v_ddl is null then
    raise exception 'reconciliar_ocorrencia não encontrado';
  end if;

  v_ddl := replace(
    v_ddl,
    E'\\n        if v_desconto_efetivo > v_valor_mesada then\\n          raise exception ''O desconto desta ocorrência não pode ser maior que a mesada cadastrada'';\\n        end if;\\n',
    E'\\n'
  );

  v_ddl := replace(
    v_ddl,
    E'when tipo=''PENALIDADE'' and status=''PENDENTE'' then ''CANCELADA''',
    E'when tipo=''PENALIDADE'' and status in (''PENDENTE'',''SUSPENSA_REVISAO'') then ''CANCELADA'''
  );

  v_ddl := replace(
    v_ddl,
    E'when tipo=''PENALIDADE'' and status=''PENDENTE'' then now()',
    E'when tipo=''PENALIDADE'' and status in (''PENDENTE'',''SUSPENSA_REVISAO'') then now()'
  );

  execute v_ddl;
end;
$$;
