create or replace function public.admin_localizar_usuario_limpeza(p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_admin_id bigint;
  v_usuario public.t_usuario_pai%rowtype;
begin
  select a.id
    into v_admin_id
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
  limit 1;

  if v_usuario.id is null then
    raise exception 'Usuário não encontrado';
  end if;

  return jsonb_build_object(
    'id', v_usuario.id,
    'nome', v_usuario.nome,
    'email', v_usuario.email,
    'onboarding_concluido', v_usuario.onboarding_concluido,
    'eh_admin', exists (
      select 1 from public.t_admin a where a.id_usuario_pai = v_usuario.id
    ),
    'filhos', (select count(*) from public.t_filho f where f.id_usuario_pai = v_usuario.id),
    'tarefas', (select count(*) from public.t_tarefa t where t.id_usuario_pai = v_usuario.id),
    'vigencias', (select count(*) from public.t_vigencia v where v.id_usuario_pai = v_usuario.id),
    'atribuicoes', (select count(*) from public.t_filho_tarefa ft where ft.id_usuario_pai = v_usuario.id),
    'ocorrencias', (select count(*) from public.t_ocorrencia o where o.id_usuario_pai = v_usuario.id),
    'feedbacks', (select count(*) from public.t_feedback f where f.id_usuario_pai = v_usuario.id)
  );
end;
$function$;

revoke all on function public.admin_localizar_usuario_limpeza(text) from public, anon, service_role;
grant execute on function public.admin_localizar_usuario_limpeza(text) to authenticated;


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
      'preservado', jsonb_build_array('auth.users', 't_usuario_pai', 't_admin', 't_admin_auditoria')
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
    'preservou_admin', exists(select 1 from public.t_admin a where a.id_usuario_pai = v_usuario.id),
    'onboarding_reaberto', true,
    'resumo_antes', v_resumo
  );
end;
$function$;

revoke all on function public.admin_limpar_dados_usuario(text) from public, anon, service_role;
grant execute on function public.admin_limpar_dados_usuario(text) to authenticated;
