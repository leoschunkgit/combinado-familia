create or replace function public.admin_vigencia_automatica_impacto()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_admin_id bigint;
  v_agora timestamptz := statement_timestamp();
  v_vigencias integer := 0;
  v_atribuicoes integer := 0;
  v_responsaveis integer := 0;
begin
  v_admin_id := public.current_admin_id();

  if v_admin_id is null then
    raise exception 'Acesso administrativo não autorizado'
      using errcode = '42501';
  end if;

  select
    count(*)::integer,
    count(distinct v.id_usuario_pai)::integer
  into
    v_vigencias,
    v_responsaveis
  from public.t_vigencia v
  where v.data_inicio > v_agora;

  select count(*)::integer
  into v_atribuicoes
  from public.t_filho_tarefa ft
  join public.t_vigencia v
    on v.id = ft.id_vigencia
   and v.id_usuario_pai = ft.id_usuario_pai
  where v.data_inicio > v_agora;

  return jsonb_build_object(
    'vigencias_futuras', v_vigencias,
    'atribuicoes_futuras', v_atribuicoes,
    'responsaveis_afetados', v_responsaveis,
    'consultado_em', v_agora
  );
end;
$function$;

revoke all on function public.admin_vigencia_automatica_impacto()
  from public, anon, authenticated;
grant execute on function public.admin_vigencia_automatica_impacto()
  to authenticated;


create or replace function public.admin_feature_salvar(
  p_chave text,
  p_nome text,
  p_descricao text,
  p_ativo boolean
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_admin_id bigint;
  v_chave text;
  v_existia boolean;
  v_ativo_anterior boolean := false;
  v_result jsonb;
  v_agora timestamptz := statement_timestamp();
  v_vigencias_futuras integer := 0;
  v_atribuicoes_futuras integer := 0;
  v_setting_exclusao_atribuicao text;
begin
  v_admin_id := public.current_admin_id();

  if v_admin_id is null then
    raise exception 'Acesso administrativo não autorizado'
      using errcode = '42501';
  end if;

  v_chave := lower(trim(coalesce(p_chave, '')));

  if v_chave !~ '^[a-z0-9][a-z0-9_.-]{1,63}$' then
    raise exception 'Chave inválida. Use letras minúsculas, números, ponto, hífen ou sublinhado';
  end if;

  if nullif(trim(coalesce(p_nome, '')), '') is null then
    raise exception 'Informe o nome da funcionalidade';
  end if;

  if v_chave = 'vigencia_automatica' then
    perform pg_catalog.pg_advisory_xact_lock(1836213098, 1);
  end if;

  select f.ativo
    into v_ativo_anterior
  from public.t_app_feature_flag f
  where f.chave = v_chave
  for update;

  v_existia := found;

  if not v_existia then
    v_ativo_anterior := false;
  end if;

  if v_chave = 'vigencia_automatica'
     and coalesce(v_ativo_anterior, false) = false
     and coalesce(p_ativo, false) = true then

    select count(*)::integer
      into v_atribuicoes_futuras
    from public.t_filho_tarefa ft
    join public.t_vigencia v
      on v.id = ft.id_vigencia
     and v.id_usuario_pai = ft.id_usuario_pai
    where v.data_inicio > v_agora;

    v_setting_exclusao_atribuicao :=
      current_setting('app.exclusao_atribuicao_autorizada', true);

    perform set_config(
      'app.exclusao_atribuicao_autorizada',
      '1',
      true
    );

    delete from public.t_filho_tarefa ft
    using public.t_vigencia v
    where v.id = ft.id_vigencia
      and v.id_usuario_pai = ft.id_usuario_pai
      and v.data_inicio > v_agora;

    perform set_config(
      'app.exclusao_atribuicao_autorizada',
      coalesce(v_setting_exclusao_atribuicao, ''),
      true
    );

    delete from public.t_vigencia v
    where v.data_inicio > v_agora;

    get diagnostics v_vigencias_futuras = row_count;
  end if;

  insert into public.t_app_feature_flag (
    chave,
    nome,
    descricao,
    ativo,
    updated_by_admin_id
  )
  values (
    v_chave,
    trim(p_nome),
    nullif(trim(coalesce(p_descricao, '')), ''),
    coalesce(p_ativo, false),
    v_admin_id
  )
  on conflict (chave)
  do update set
    nome = excluded.nome,
    descricao = excluded.descricao,
    ativo = excluded.ativo,
    updated_at = now(),
    updated_by_admin_id = v_admin_id;

  select jsonb_build_object(
    'chave', f.chave,
    'nome', f.nome,
    'descricao', f.descricao,
    'ativo', f.ativo,
    'created_at', f.created_at,
    'updated_at', f.updated_at
  )
  into v_result
  from public.t_app_feature_flag f
  where f.chave = v_chave;

  perform public.admin_auditar(
    case when v_existia then 'FEATURE_FLAG_ALTERADA' else 'FEATURE_FLAG_CRIADA' end,
    'feature_flag',
    v_chave,
    case
      when v_chave = 'vigencia_automatica' then
        jsonb_build_object(
          'feature', v_result,
          'ativo_anterior', coalesce(v_ativo_anterior, false),
          'ativo_novo', coalesce(p_ativo, false),
          'vigencias_futuras_excluidas', v_vigencias_futuras,
          'atribuicoes_futuras_excluidas', v_atribuicoes_futuras
        )
      else
        v_result
    end
  );

  return v_result;
end;
$function$;

revoke all on function public.admin_feature_salvar(text, text, text, boolean)
  from public, anon;
grant execute on function public.admin_feature_salvar(text, text, text, boolean)
  to authenticated;


create or replace function private.vigencia_automatica_bloquear_futura()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if private.vigencia_automatica_ativa()
     and new.data_inicio > statement_timestamp() then
    raise exception
      'Com a vigência automática ativada, não é permitido criar uma vigência futura';
  end if;

  return new;
end;
$function$;

drop trigger if exists vigencia_automatica_bloquear_futura_before_change
  on public.t_vigencia;

create trigger vigencia_automatica_bloquear_futura_before_change
before insert or update of data_inicio
on public.t_vigencia
for each row
execute function private.vigencia_automatica_bloquear_futura();

revoke all on function private.vigencia_automatica_bloquear_futura()
  from public, anon, authenticated;
