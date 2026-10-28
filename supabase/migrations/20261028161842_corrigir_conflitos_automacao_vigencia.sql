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
      id_usuario_pai,
      id_vigencia_referencia
    )
    values (p_pai_id, v_id)
    on conflict (id_usuario_pai)
    do update set
      id_vigencia_referencia = excluded.id_vigencia_referencia,
      updated_at = statement_timestamp();

    insert into private.t_vigencia_automacao_ciclo (
      id_vigencia,
      id_usuario_pai,
      id_vigencia_origem,
      origem
    )
    values (
      v_id,
      p_pai_id,
      null,
      'ADOTADA'
    )
    on conflict on constraint t_vigencia_automacao_ciclo_pkey
    do nothing;

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
          p_pai_id,
          p_agora
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
    id_usuario_pai,
    data_inicio,
    data_fim
  )
  values (
    p_pai_id,
    v_inicio,
    v_fim
  )
  returning id into v_id;

  insert into private.t_vigencia_automacao_estado (
    id_usuario_pai,
    id_vigencia_referencia
  )
  values (p_pai_id, v_id)
  on conflict (id_usuario_pai)
  do update set
    id_vigencia_referencia = excluded.id_vigencia_referencia,
    updated_at = statement_timestamp();

  insert into private.t_vigencia_automacao_ciclo (
    id_vigencia,
    id_usuario_pai,
    id_vigencia_origem,
    origem
  )
  values (
    v_id,
    p_pai_id,
    null,
    'INICIAL'
  )
  on conflict on constraint t_vigencia_automacao_ciclo_pkey
  do nothing;

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
    select 1
    from public.t_filho f
    where f.id = p_id_filho
      and f.id_usuario_pai = v_pai_id
  ) then
    raise exception 'Filho não encontrado';
  end if;

  if not exists (
    select 1
    from public.t_tarefa t
    where t.id = p_id_tarefa
      and t.id_usuario_pai = v_pai_id
      and t.ativo = true
  ) then
    raise exception 'Tarefa não encontrada ou arquivada';
  end if;

  select g.id_vigencia, g.vigencia_criada
    into v_vigencia_id, v_vigencia_criada
  from private.vigencia_automatica_garantir_interno(
    v_pai_id,
    statement_timestamp()
  ) g;

  insert into public.t_filho_tarefa (
    id_usuario_pai,
    id_filho,
    id_tarefa,
    id_vigencia
  )
  values (
    v_pai_id,
    p_id_filho,
    p_id_tarefa,
    v_vigencia_id
  )
  on conflict on constraint
    t_filho_tarefa_id_filho_id_tarefa_id_vigencia_key
  do nothing
  returning id into v_atribuicao_id;

  if v_atribuicao_id is not null then
    v_atribuicao_criada := true;
  else
    select ft.id
      into v_atribuicao_id
    from public.t_filho_tarefa ft
    where ft.id_usuario_pai = v_pai_id
      and ft.id_filho = p_id_filho
      and ft.id_tarefa = p_id_tarefa
      and ft.id_vigencia = v_vigencia_id;
  end if;

  return query
  select
    v_atribuicao_id,
    v_vigencia_id,
    v_vigencia_criada,
    v_atribuicao_criada;
end;
$$;

revoke execute on function private.vigencia_automatica_garantir_interno(bigint, timestamptz)
  from public, anon, authenticated;

revoke execute on function public.atribuir_tarefa_vigencia_automatica(bigint, bigint)
  from public, anon;
grant execute on function public.atribuir_tarefa_vigencia_automatica(bigint, bigint)
  to authenticated;
