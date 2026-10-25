
create or replace function public.current_admin_nivel()
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select a.nivel
  from public.t_admin a
  join public.t_usuario_pai p
    on p.id = a.id_usuario_pai
  where a.ativo = true
    and p.auth_user_id = auth.uid()
  limit 1
$function$;

revoke all on function public.current_admin_nivel()
  from public, anon, authenticated, service_role;


create or replace function public.is_master()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(public.current_admin_nivel() = 'MASTER', false)
$function$;

revoke all on function public.is_master()
  from public, anon, authenticated, service_role;


create unique index if not exists t_admin_master_unico_uq
  on public.t_admin (nivel)
  where nivel = 'MASTER';


create or replace function public.proteger_admin_master()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'DELETE' and old.nivel = 'MASTER' then
    raise exception 'O administrador MASTER é intocável e não pode ser removido';
  end if;

  if tg_op = 'UPDATE' and old.nivel = 'MASTER' then
    if new is distinct from old then
      raise exception 'O administrador MASTER é intocável e não pode ser alterado';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$function$;


create or replace function public.admin_adicionar(p_email text)
returns bigint
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_admin_atual bigint;
  v_usuario public.t_usuario_pai%rowtype;
  v_admin_id bigint;
  v_ja_existia boolean;
  v_nivel_existente text;
begin
  v_admin_atual := public.current_admin_id();

  if v_admin_atual is null then
    raise exception 'Acesso administrativo não autorizado'
      using errcode = '42501';
  end if;

  if not public.is_master() then
    raise exception 'Somente o administrador MASTER pode definir administradores'
      using errcode = '42501';
  end if;

  select p.*
    into v_usuario
  from public.t_usuario_pai p
  where lower(p.email) = lower(trim(coalesce(p_email, '')))
  limit 1;

  if v_usuario.id is null then
    raise exception 'Usuário não encontrado. Ele precisa ter uma conta no Combinado Família';
  end if;

  select a.nivel
    into v_nivel_existente
  from public.t_admin a
  where a.id_usuario_pai = v_usuario.id;

  if v_nivel_existente = 'MASTER' then
    raise exception 'O usuário informado já é o administrador MASTER';
  end if;

  select exists (
    select 1
    from public.t_admin a
    where a.id_usuario_pai = v_usuario.id
  )
  into v_ja_existia;

  insert into public.t_admin (id_usuario_pai, ativo, nivel)
  values (v_usuario.id, true, 'ADMIN')
  on conflict (id_usuario_pai)
  do update
    set ativo = true,
        nivel = 'ADMIN'
  returning id into v_admin_id;

  perform public.admin_auditar(
    case when v_ja_existia then 'ADMIN_REATIVADO' else 'ADMIN_ADICIONADO' end,
    'admin',
    v_admin_id::text,
    jsonb_build_object(
      'id_usuario_pai', v_usuario.id,
      'nome', v_usuario.nome,
      'email', v_usuario.email,
      'nivel', 'ADMIN',
      'definido_por_master', true
    )
  );

  return v_admin_id;
end;
$function$;


create or replace function public.admin_definir_status(
  p_admin_id bigint,
  p_ativo boolean
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_admin_atual bigint;
  v_alvo public.t_admin%rowtype;
  v_usuario public.t_usuario_pai%rowtype;
begin
  v_admin_atual := public.current_admin_id();

  if v_admin_atual is null then
    raise exception 'Acesso administrativo não autorizado'
      using errcode = '42501';
  end if;

  if not public.is_master() then
    raise exception 'Somente o administrador MASTER pode ativar ou desativar administradores'
      using errcode = '42501';
  end if;

  select a.*
    into v_alvo
  from public.t_admin a
  where a.id = p_admin_id
  for update;

  if v_alvo.id is null then
    raise exception 'Administrador não encontrado';
  end if;

  if v_alvo.nivel = 'MASTER' then
    raise exception 'O administrador MASTER é intocável e não pode ser alterado'
      using errcode = '42501';
  end if;

  select p.*
    into v_usuario
  from public.t_usuario_pai p
  where p.id = v_alvo.id_usuario_pai;

  update public.t_admin
  set ativo = p_ativo
  where id = p_admin_id;

  perform public.admin_auditar(
    case when p_ativo then 'ADMIN_ATIVADO' else 'ADMIN_DESATIVADO' end,
    'admin',
    p_admin_id::text,
    jsonb_build_object(
      'id_usuario_pai', v_alvo.id_usuario_pai,
      'nome', v_usuario.nome,
      'email', v_usuario.email,
      'nivel', v_alvo.nivel,
      'ativo_anterior', v_alvo.ativo,
      'ativo_novo', p_ativo,
      'alterado_por_master', true
    )
  );

  return true;
end;
$function$;


create or replace function public.admin_limpar_dados_usuario(p_email text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_admin_id bigint;
  v_admin_nivel text;
  v_usuario public.t_usuario_pai%rowtype;
  v_resumo jsonb;
  v_setting_anterior text;
begin
  select a.id, a.nivel
    into v_admin_id, v_admin_nivel
  from public.t_admin a
  join public.t_usuario_pai p on p.id = a.id_usuario_pai
  where a.ativo = true
    and a.nivel in ('ADMIN', 'MASTER')
    and p.auth_user_id = auth.uid()
  limit 1;

  if v_admin_id is null then
    raise exception 'Acesso administrativo não autorizado'
      using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_email, '')), '') is null then
    raise exception 'Informe o e-mail do usuário';
  end if;

  select p.*
    into v_usuario
  from public.t_usuario_pai p
  where lower(trim(p.email)) = lower(trim(p_email))
  limit 1
  for update;

  if v_usuario.id is null then
    raise exception 'Usuário não encontrado';
  end if;

  if exists (
    select 1
    from public.t_admin a
    where a.id_usuario_pai = v_usuario.id
      and a.nivel = 'MASTER'
  ) then
    raise exception 'O administrador MASTER é intocável e não pode ter seus dados limpos'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'filhos', (select count(*) from public.t_filho f where f.id_usuario_pai = v_usuario.id),
    'tarefas', (select count(*) from public.t_tarefa t where t.id_usuario_pai = v_usuario.id),
    'vigencias', (select count(*) from public.t_vigencia v where v.id_usuario_pai = v_usuario.id),
    'atribuicoes', (select count(*) from public.t_filho_tarefa ft where ft.id_usuario_pai = v_usuario.id),
    'ocorrencias', (select count(*) from public.t_ocorrencia o where o.id_usuario_pai = v_usuario.id),
    'feedbacks', (select count(*) from public.t_feedback f where f.id_usuario_pai = v_usuario.id),
    'era_admin', exists(select 1 from public.t_admin a where a.id_usuario_pai = v_usuario.id),
    'onboarding_concluido', v_usuario.onboarding_concluido
  )
  into v_resumo;

  perform public.admin_auditar(
    'DADOS_USUARIO_LIMPOS',
    'usuario_pai',
    v_usuario.id::text,
    jsonb_build_object(
      'email', v_usuario.email,
      'nome', v_usuario.nome,
      'executado_por_nivel', v_admin_nivel,
      'resumo_antes', v_resumo,
      'preservado', jsonb_build_array(
        'auth.users',
        't_usuario_pai',
        't_admin',
        't_admin_auditoria'
      )
    )
  );

  delete from public.t_ocorrencia_reconciliacao
  where id_usuario_pai = v_usuario.id;

  delete from public.t_feedback
  where id_usuario_pai = v_usuario.id;

  delete from public.t_app_telemetria
  where id_usuario_pai = v_usuario.id;

  delete from public.t_push_dispositivo
  where id_usuario_pai = v_usuario.id;

  delete from public.t_filho
  where id_usuario_pai = v_usuario.id;

  v_setting_anterior := current_setting('app.remocao_tarefa_autorizada', true);
  perform set_config('app.remocao_tarefa_autorizada', '1', true);

  delete from public.t_tarefa
  where id_usuario_pai = v_usuario.id;

  perform set_config(
    'app.remocao_tarefa_autorizada',
    coalesce(v_setting_anterior, ''),
    true
  );

  delete from public.t_vigencia
  where id_usuario_pai = v_usuario.id;

  update public.t_usuario_pai
  set onboarding_concluido = false
  where id = v_usuario.id;

  return jsonb_build_object(
    'ok', true,
    'id_usuario_pai', v_usuario.id,
    'nome', v_usuario.nome,
    'email', v_usuario.email,
    'preservou_conta', true,
    'preservou_admin', exists(
      select 1 from public.t_admin a where a.id_usuario_pai = v_usuario.id
    ),
    'onboarding_reaberto', true,
    'resumo_antes', v_resumo
  );
end;
$function$;
