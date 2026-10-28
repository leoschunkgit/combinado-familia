create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create table if not exists private.t_vigencia_automacao_estado (
  id_usuario_pai bigint primary key
    references public.t_usuario_pai(id) on delete cascade,
  id_vigencia_referencia bigint
    references public.t_vigencia(id) on delete set null,
  iniciado_em timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.t_vigencia_automacao_ciclo (
  id_vigencia bigint primary key
    references public.t_vigencia(id) on delete cascade,
  id_usuario_pai bigint not null
    references public.t_usuario_pai(id) on delete cascade,
  id_vigencia_origem bigint
    references public.t_vigencia(id) on delete set null,
  origem text not null
    check (origem in ('INICIAL', 'ADOTADA', 'RENOVACAO')),
  created_at timestamptz not null default now()
);

create unique index if not exists uq_vigencia_automacao_ciclo_origem
  on private.t_vigencia_automacao_ciclo(id_vigencia_origem)
  where id_vigencia_origem is not null and origem = 'RENOVACAO';

comment on table private.t_vigencia_automacao_estado is
  'Estado interno da vigência automática por responsável. Não altera nem substitui t_vigencia.';
comment on table private.t_vigencia_automacao_ciclo is
  'Rastreia vigências adotadas/criadas pela automação para auditoria e idempotência.';

create or replace function private.vigencia_automatica_ativa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select f.ativo
    from public.t_app_feature_flag f
    where f.chave = 'vigencia_automatica'
  ), false)
$$;

create or replace function private.vigencia_automatica_inicio_minuto(
  p_momento timestamptz
)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select (
    date_trunc(
      'minute',
      timezone('America/Sao_Paulo', p_momento)
    )
    at time zone 'America/Sao_Paulo'
  )
$$;

create or replace function private.vigencia_automatica_fim_periodo(
  p_inicio timestamptz
)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_inicio_local timestamp;
  v_fim_local timestamp;
  v_fim timestamptz;
begin
  v_inicio_local := timezone('America/Sao_Paulo', p_inicio);
  v_fim_local :=
    date_trunc('month', v_inicio_local)
    + interval '1 month'
    - interval '1 minute';

  v_fim := v_fim_local at time zone 'America/Sao_Paulo';

  if v_fim <= p_inicio then
    v_fim_local :=
      date_trunc('month', v_inicio_local)
      + interval '2 months'
      - interval '1 minute';
    v_fim := v_fim_local at time zone 'America/Sao_Paulo';
  end if;

  return v_fim;
end;
$$;

create or replace function private.duplicar_vigencia_com_atribuicoes_interno(
  p_pai_id bigint,
  p_modelo_id bigint,
  p_data_inicio timestamptz,
  p_data_fim timestamptz
)
returns table(id_vigencia bigint, qtd_atribuicoes integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_modelo_fim timestamptz;
  v_nova_id bigint;
  v_qtd integer;
begin
  if p_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  select v.data_fim
    into v_modelo_fim
  from public.t_vigencia v
  where v.id = p_modelo_id
    and v.id_usuario_pai = p_pai_id
  for share;

  if v_modelo_fim is null then
    raise exception 'Vigência modelo não encontrada';
  end if;

  if p_data_fim <= p_data_inicio then
    raise exception 'A data/hora fim deve ser posterior à data/hora início';
  end if;

  if p_data_inicio <= v_modelo_fim then
    raise exception 'A nova vigência deve começar depois do término da vigência modelo';
  end if;

  insert into public.t_vigencia (
    id_usuario_pai, data_inicio, data_fim
  )
  values (
    p_pai_id, p_data_inicio, p_data_fim
  )
  returning id into v_nova_id;

  insert into public.t_filho_tarefa (
    id_usuario_pai, id_vigencia, id_filho, id_tarefa
  )
  select
    p_pai_id, v_nova_id, ft.id_filho, ft.id_tarefa
  from public.t_filho_tarefa ft
  join public.t_tarefa t
    on t.id = ft.id_tarefa
   and t.id_usuario_pai = ft.id_usuario_pai
   and t.ativo = true
  where ft.id_usuario_pai = p_pai_id
    and ft.id_vigencia = p_modelo_id;

  get diagnostics v_qtd = row_count;
  return query select v_nova_id, v_qtd;
end;
$$;

create or replace function public.duplicar_vigencia_com_atribuicoes(
  p_modelo_id bigint,
  p_data_inicio timestamptz,
  p_data_fim timestamptz
)
returns table(id_vigencia bigint, qtd_atribuicoes integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pai_id bigint;
begin
  select p.id into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  return query
  select x.id_vigencia, x.qtd_atribuicoes
  from private.duplicar_vigencia_com_atribuicoes_interno(
    v_pai_id, p_modelo_id, p_data_inicio, p_data_fim
  ) x;
end;
$$;

create or replace function private.vigencia_automatica_renovar_pai_interno(
  p_pai_id bigint,
  p_agora timestamptz default now()
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado private.t_vigencia_automacao_estado%rowtype;
  v_atual public.t_vigencia%rowtype;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_nova_id bigint;
begin
  if not private.vigencia_automatica_ativa() then
    return null;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    1836213097,
    (p_pai_id % 2147483647)::integer
  );

  select s.*
    into v_estado
  from private.t_vigencia_automacao_estado s
  where s.id_usuario_pai = p_pai_id
  for update;

  if not found then
    return null;
  end if;

  select v.*
    into v_atual
  from public.t_vigencia v
  where v.id_usuario_pai = p_pai_id
  order by v.data_fim desc, v.id desc
  limit 1
  for share;

  if not found then
    update private.t_vigencia_automacao_estado
    set id_vigencia_referencia = null,
        updated_at = statement_timestamp()
    where id_usuario_pai = p_pai_id;
    return null;
  end if;

  if v_estado.id_vigencia_referencia is distinct from v_atual.id then
    insert into private.t_vigencia_automacao_ciclo (
      id_vigencia, id_usuario_pai, id_vigencia_origem, origem
    )
    values (
      v_atual.id, p_pai_id, null, 'ADOTADA'
    )
    on conflict (id_vigencia) do nothing;

    update private.t_vigencia_automacao_estado
    set id_vigencia_referencia = v_atual.id,
        updated_at = statement_timestamp()
    where id_usuario_pai = p_pai_id;
  end if;

  if v_atual.data_fim >= p_agora then
    return null;
  end if;

  v_inicio := v_atual.data_fim + interval '1 minute';

  if p_agora < v_inicio then
    return null;
  end if;

  v_fim := private.vigencia_automatica_fim_periodo(v_inicio);

  if exists (
    select 1
    from public.t_vigencia v
    where v.id_usuario_pai = p_pai_id
      and v.id <> v_atual.id
      and v.data_inicio <= v_fim
      and v.data_fim >= v_inicio
  ) then
    return null;
  end if;

  select x.id_vigencia
    into v_nova_id
  from private.duplicar_vigencia_com_atribuicoes_interno(
    p_pai_id, v_atual.id, v_inicio, v_fim
  ) x;

  insert into private.t_vigencia_automacao_ciclo (
    id_vigencia, id_usuario_pai, id_vigencia_origem, origem
  )
  values (
    v_nova_id, p_pai_id, v_atual.id, 'RENOVACAO'
  );

  update private.t_vigencia_automacao_estado
  set id_vigencia_referencia = v_nova_id,
      updated_at = statement_timestamp()
  where id_usuario_pai = p_pai_id;

  return v_nova_id;
end;
$$;

create or replace function private.vigencia_automatica_garantir_interno(
  p_pai_id bigint,
  p_agora timestamptz default now()
)
returns table(id_vigencia bigint, vigencia_criada boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_estado_existe boolean;
  v_tentativa integer := 0;
  v_renovada bigint;
begin
  if not private.vigencia_automatica_ativa() then
    raise exception 'Vigência automática está desativada';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    1836213097,
    (p_pai_id % 2147483647)::integer
  );

  select v.id
    into v_id
  from public.t_vigencia v
  where v.id_usuario_pai = p_pai_id
    and p_agora between v.data_inicio and v.data_fim
  order by v.data_inicio desc, v.id desc
  limit 1;

  if v_id is not null then
    insert into private.t_vigencia_automacao_estado (
      id_usuario_pai, id_vigencia_referencia
    )
    values (p_pai_id, v_id)
    on conflict (id_usuario_pai)
    do update set
      id_vigencia_referencia = excluded.id_vigencia_referencia,
      updated_at = statement_timestamp();

    insert into private.t_vigencia_automacao_ciclo (
      id_vigencia, id_usuario_pai, id_vigencia_origem, origem
    )
    values (
      v_id, p_pai_id, null, 'ADOTADA'
    )
    on conflict (id_vigencia) do nothing;

    return query select v_id, false;
    return;
  end if;

  select exists (
    select 1
    from private.t_vigencia_automacao_estado s
    where s.id_usuario_pai = p_pai_id
  )
  into v_estado_existe;

  if v_estado_existe then
    loop
      exit when v_tentativa >= 24;
      v_tentativa := v_tentativa + 1;

      v_renovada :=
        private.vigencia_automatica_renovar_pai_interno(
          p_pai_id, p_agora
        );

      exit when v_renovada is null;

      select v.id
        into v_id
      from public.t_vigencia v
      where v.id = v_renovada
        and p_agora between v.data_inicio and v.data_fim;

      if v_id is not null then
        return query select v_id, true;
        return;
      end if;
    end loop;
  end if;

  select v.id
    into v_id
  from public.t_vigencia v
  where v.id_usuario_pai = p_pai_id
    and p_agora between v.data_inicio and v.data_fim
  order by v.data_inicio desc, v.id desc
  limit 1;

  if v_id is not null then
    return query select v_id, false;
    return;
  end if;

  v_inicio := private.vigencia_automatica_inicio_minuto(p_agora);
  v_fim := private.vigencia_automatica_fim_periodo(v_inicio);

  if exists (
    select 1
    from public.t_vigencia v
    where v.id_usuario_pai = p_pai_id
      and v.data_inicio <= v_fim
      and v.data_fim >= v_inicio
  ) then
    raise exception
      'Existe uma vigência cadastrada que conflita com o período automático';
  end if;

  insert into public.t_vigencia (
    id_usuario_pai, data_inicio, data_fim
  )
  values (
    p_pai_id, v_inicio, v_fim
  )
  returning id into v_id;

  insert into private.t_vigencia_automacao_estado (
    id_usuario_pai, id_vigencia_referencia
  )
  values (p_pai_id, v_id)
  on conflict (id_usuario_pai)
  do update set
    id_vigencia_referencia = excluded.id_vigencia_referencia,
    updated_at = statement_timestamp();

  insert into private.t_vigencia_automacao_ciclo (
    id_vigencia, id_usuario_pai, id_vigencia_origem, origem
  )
  values (
    v_id, p_pai_id, null, 'INICIAL'
  )
  on conflict (id_vigencia) do nothing;

  return query select v_id, true;
end;
$$;

create or replace function public.atribuir_tarefa_vigencia_automatica(
  p_id_filho bigint,
  p_id_tarefa bigint
)
returns table(
  id_filho_tarefa bigint,
  id_vigencia bigint,
  vigencia_criada boolean,
  atribuicao_criada boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pai_id bigint;
  v_vigencia_id bigint;
  v_vigencia_criada boolean;
  v_atribuicao_id bigint;
  v_atribuicao_criada boolean := false;
begin
  if not private.vigencia_automatica_ativa() then
    raise exception 'Vigência automática está desativada';
  end if;

  v_pai_id := public.current_pai_id();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  if not exists (
    select 1 from public.t_filho f
    where f.id = p_id_filho
      and f.id_usuario_pai = v_pai_id
  ) then
    raise exception 'Filho não encontrado';
  end if;

  if not exists (
    select 1 from public.t_tarefa t
    where t.id = p_id_tarefa
      and t.id_usuario_pai = v_pai_id
      and t.ativo = true
  ) then
    raise exception 'Tarefa não encontrada ou arquivada';
  end if;

  select g.id_vigencia, g.vigencia_criada
    into v_vigencia_id, v_vigencia_criada
  from private.vigencia_automatica_garantir_interno(
    v_pai_id, statement_timestamp()
  ) g;

  insert into public.t_filho_tarefa (
    id_usuario_pai, id_filho, id_tarefa, id_vigencia
  )
  values (
    v_pai_id, p_id_filho, p_id_tarefa, v_vigencia_id
  )
  on conflict (id_filho, id_tarefa, id_vigencia)
  do nothing
  returning id into v_atribuicao_id;

  if v_atribuicao_id is not null then
    v_atribuicao_criada := true;
  else
    select ft.id into v_atribuicao_id
    from public.t_filho_tarefa ft
    where ft.id_usuario_pai = v_pai_id
      and ft.id_filho = p_id_filho
      and ft.id_tarefa = p_id_tarefa
      and ft.id_vigencia = v_vigencia_id;
  end if;

  return query select
    v_atribuicao_id,
    v_vigencia_id,
    v_vigencia_criada,
    v_atribuicao_criada;
end;
$$;

create or replace function private.vigencia_automatica_inicializar_existentes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qtd integer := 0;
begin
  if not private.vigencia_automatica_ativa() then
    raise exception 'Vigência automática está desativada';
  end if;

  with ultimas as (
    select distinct on (v.id_usuario_pai)
      v.id_usuario_pai, v.id
    from public.t_vigencia v
    order by v.id_usuario_pai, v.data_fim desc, v.id desc
  ),
  inseridos as (
    insert into private.t_vigencia_automacao_estado (
      id_usuario_pai, id_vigencia_referencia
    )
    select u.id_usuario_pai, u.id
    from ultimas u
    on conflict (id_usuario_pai)
    do update set
      id_vigencia_referencia = excluded.id_vigencia_referencia,
      updated_at = statement_timestamp()
    returning id_usuario_pai, id_vigencia_referencia
  )
  select count(*) into v_qtd from inseridos;

  insert into private.t_vigencia_automacao_ciclo (
    id_vigencia, id_usuario_pai, id_vigencia_origem, origem
  )
  select
    s.id_vigencia_referencia,
    s.id_usuario_pai,
    null,
    'ADOTADA'
  from private.t_vigencia_automacao_estado s
  where s.id_vigencia_referencia is not null
  on conflict (id_vigencia) do nothing;

  return v_qtd;
end;
$$;

create or replace function private.vigencia_automatica_processar()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado record;
  v_nova_id bigint;
  v_qtd_responsaveis integer := 0;
  v_qtd_renovacoes integer := 0;
  v_tentativa integer;
begin
  if not private.vigencia_automatica_ativa() then
    return jsonb_build_object(
      'ativa', false,
      'responsaveis_processados', 0,
      'vigencias_renovadas', 0
    );
  end if;

  for v_estado in
    select s.id_usuario_pai
    from private.t_vigencia_automacao_estado s
    order by s.id_usuario_pai
  loop
    v_qtd_responsaveis := v_qtd_responsaveis + 1;

    for v_tentativa in 1..24 loop
      v_nova_id :=
        private.vigencia_automatica_renovar_pai_interno(
          v_estado.id_usuario_pai,
          statement_timestamp()
        );

      exit when v_nova_id is null;
      v_qtd_renovacoes := v_qtd_renovacoes + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'ativa', true,
    'responsaveis_processados', v_qtd_responsaveis,
    'vigencias_renovadas', v_qtd_renovacoes
  );
end;
$$;

insert into public.t_app_feature_flag (
  chave, nome, descricao, ativo, updated_by_admin_id
)
values (
  'vigencia_automatica',
  'Vigência automática',
  'Cria e renova vigências implicitamente. Quando desligada, o fluxo manual atual permanece inalterado.',
  false,
  null
)
on conflict (chave) do nothing;

do $$
begin
  if not exists (
    select 1 from cron.job
    where jobname = 'vigencia-automatica-renovacao'
  ) then
    perform cron.schedule(
      'vigencia-automatica-renovacao',
      '* * * * *',
      'select private.vigencia_automatica_processar();'
    );
  end if;
end;
$$;

revoke all on all tables in schema private from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

revoke execute on function public.atribuir_tarefa_vigencia_automatica(bigint, bigint)
  from public, anon;
grant execute on function public.atribuir_tarefa_vigencia_automatica(bigint, bigint)
  to authenticated;

revoke execute on function public.duplicar_vigencia_com_atribuicoes(bigint, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.duplicar_vigencia_com_atribuicoes(bigint, timestamptz, timestamptz)
  to authenticated;
