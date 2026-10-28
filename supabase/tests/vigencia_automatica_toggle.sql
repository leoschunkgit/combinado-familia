-- Teste transacional: OFF -> ON remove vigências futuras e suas atribuições,
-- preserva vigências atuais/finalizadas e bloqueia nova vigência futura no automático.
-- Não deixa dados, pois termina em ROLLBACK.

begin;

do $$
declare
  v_admin_auth uuid;
  v_pai bigint;
  v_filho bigint;
  v_tarefa bigint;
  v_vigencia bigint;
  v_atribuicao bigint;
  v_nome text;
  v_descricao text;
  v_nao_futuras_antes integer;
  v_nao_futuras_depois integer;
  v_bloqueou_futura boolean := false;
begin
  select p.auth_user_id
    into v_admin_auth
  from public.t_admin a
  join public.t_usuario_pai p on p.id = a.id_usuario_pai
  where a.ativo = true
  order by case when a.nivel = 'MASTER' then 0 else 1 end, a.id
  limit 1;

  if v_admin_auth is null then
    raise exception 'TESTE: nenhum administrador ativo disponível';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select f.nome, f.descricao
    into v_nome, v_descricao
  from public.t_app_feature_flag f
  where f.chave = 'vigencia_automatica';

  update public.t_app_feature_flag
  set ativo = false
  where chave = 'vigencia_automatica';

  select f.id_usuario_pai, f.id, t.id
    into v_pai, v_filho, v_tarefa
  from public.t_filho f
  join public.t_tarefa t
    on t.id_usuario_pai = f.id_usuario_pai
   and t.ativo = true
  order by f.id_usuario_pai, f.id, t.id
  limit 1;

  if v_pai is null then
    raise exception 'TESTE: precisa existir ao menos um filho e uma tarefa ativa';
  end if;

  select count(*)::integer
    into v_nao_futuras_antes
  from public.t_vigencia
  where data_inicio <= statement_timestamp();

  insert into public.t_vigencia (
    id_usuario_pai,
    data_inicio,
    data_fim
  )
  values (
    v_pai,
    statement_timestamp() + interval '40 years',
    statement_timestamp() + interval '40 years 30 days'
  )
  returning id into v_vigencia;

  insert into public.t_filho_tarefa (
    id_usuario_pai,
    id_filho,
    id_tarefa,
    id_vigencia
  )
  values (
    v_pai,
    v_filho,
    v_tarefa,
    v_vigencia
  )
  returning id into v_atribuicao;

  perform public.admin_feature_salvar(
    'vigencia_automatica',
    coalesce(v_nome, 'Vigência automática'),
    v_descricao,
    true
  );

  if exists (select 1 from public.t_vigencia where id = v_vigencia) then
    raise exception 'TESTE: vigência futura não foi excluída';
  end if;

  if exists (select 1 from public.t_filho_tarefa where id = v_atribuicao) then
    raise exception 'TESTE: atribuição futura não foi excluída';
  end if;

  if not exists (
    select 1
    from public.t_app_feature_flag
    where chave = 'vigencia_automatica'
      and ativo = true
  ) then
    raise exception 'TESTE: vigência automática não foi ativada';
  end if;

  select count(*)::integer
    into v_nao_futuras_depois
  from public.t_vigencia
  where data_inicio <= statement_timestamp();

  if v_nao_futuras_depois <> v_nao_futuras_antes then
    raise exception 'TESTE: vigências atuais/finalizadas foram alteradas';
  end if;

  begin
    insert into public.t_vigencia (
      id_usuario_pai,
      data_inicio,
      data_fim
    )
    values (
      v_pai,
      statement_timestamp() + interval '41 years',
      statement_timestamp() + interval '41 years 30 days'
    );

    v_bloqueou_futura := false;
  exception
    when others then
      if position('não é permitido criar uma vigência futura' in sqlerrm) > 0 then
        v_bloqueou_futura := true;
      else
        raise;
      end if;
  end;

  if not v_bloqueou_futura then
    raise exception 'TESTE: nova vigência futura não foi bloqueada no automático';
  end if;
end;
$$;

rollback;

select 'VIGENCIA_AUTOMATICA_TOGGLE_OK' as resultado;
