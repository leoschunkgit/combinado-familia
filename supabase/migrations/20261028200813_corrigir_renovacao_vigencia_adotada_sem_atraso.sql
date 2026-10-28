-- Corrige a renovação quando uma vigência manual em andamento é adotada pelo modo automático.
-- O próximo ciclo passa a começar imediatamente após o fim real da vigência anterior,
-- sem aguardar um minuto adicional.

create or replace function private.vigencia_automatica_renovar_pai_interno(
  p_pai_id bigint,
  p_agora timestamptz default now()
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
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

  -- Continuidade real: o novo ciclo começa imediatamente após o fim do anterior.
  -- Para ciclos automáticos (...:59.999999), resulta exatamente no próximo minuto.
  -- Para vigências manuais adotadas (...:00.000000), evita esperar um minuto extra.
  v_inicio := v_atual.data_fim + interval '1 microsecond';

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
$function$;
