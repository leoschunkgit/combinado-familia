
create or replace function public.classificar_historico_atribuicao_interno(
  p_id_usuario_pai bigint,
  p_id_filho_tarefa bigint
)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not exists (
    select 1
    from public.t_filho_tarefa ft
    where ft.id = p_id_filho_tarefa
      and ft.id_usuario_pai = p_id_usuario_pai
  ) then
    return 'NAO_ENCONTRADA';
  end if;

  if exists (
    select 1
    from public.t_solicitacao_tarefa_filho s
    where s.id_filho_tarefa = p_id_filho_tarefa
      and s.status = 'PENDENTE'
  ) then
    return 'PENDENTE';
  end if;

  if exists (
    select 1
    from public.t_ocorrencia o
    where o.id_usuario_pai = p_id_usuario_pai
      and o.id_filho_tarefa = p_id_filho_tarefa
      and o.tipo <> 'NAO_PRECISOU'
  ) then
    return 'HISTORICO_EFETIVO';
  end if;

  if exists (
    select 1
    from public.t_solicitacao_tarefa_filho s
    where s.id_filho_tarefa = p_id_filho_tarefa
      and s.status <> 'PENDENTE'
      and s.status <> 'RESOLVIDA_NAO_PRECISOU'
  ) then
    return 'HISTORICO_EFETIVO';
  end if;

  if exists (
    select 1
    from public.t_ocorrencia_consequencia c
    join public.t_ocorrencia o
      on o.id = c.id_ocorrencia
     and o.id_usuario_pai = c.id_usuario_pai
    where o.id_usuario_pai = p_id_usuario_pai
      and o.id_filho_tarefa = p_id_filho_tarefa
  ) then
    return 'HISTORICO_EFETIVO';
  end if;

  if exists (
    select 1
    from public.t_estrela_concessao ec
    where ec.id_usuario_pai = p_id_usuario_pai
      and (
        ec.id_filho_tarefa_origem = p_id_filho_tarefa
        or ec.id_ocorrencia_origem in (
          select o.id
          from public.t_ocorrencia o
          where o.id_usuario_pai = p_id_usuario_pai
            and o.id_filho_tarefa = p_id_filho_tarefa
        )
      )
  ) then
    return 'HISTORICO_EFETIVO';
  end if;

  if exists (
    select 1
    from public.t_estrela_movimento em
    where em.id_usuario_pai = p_id_usuario_pai
      and em.id_ocorrencia in (
        select o.id
        from public.t_ocorrencia o
        where o.id_usuario_pai = p_id_usuario_pai
          and o.id_filho_tarefa = p_id_filho_tarefa
      )
  ) then
    return 'HISTORICO_EFETIVO';
  end if;

  if exists (
    select 1
    from public.t_ocorrencia_reconciliacao r
    where r.id_usuario_pai = p_id_usuario_pai
      and r.id_filho_tarefa = p_id_filho_tarefa
      and (
        coalesce(r.estado_anterior->>'tipo', '') in ('FEZ', 'NAO_FEZ')
        or coalesce(r.estado_novo->>'tipo', '') in ('FEZ', 'NAO_FEZ')
        or (
          r.estado_anterior ? 'consequencia'
          and r.estado_anterior->'consequencia' <> 'null'::jsonb
        )
        or (
          r.estado_novo ? 'consequencia'
          and r.estado_novo->'consequencia' <> 'null'::jsonb
        )
      )
  ) then
    return 'HISTORICO_EFETIVO';
  end if;

  if exists (
    select 1
    from public.t_ocorrencia o
    where o.id_usuario_pai = p_id_usuario_pai
      and o.id_filho_tarefa = p_id_filho_tarefa
  )
  or exists (
    select 1
    from public.t_solicitacao_tarefa_filho s
    where s.id_filho_tarefa = p_id_filho_tarefa
  )
  or exists (
    select 1
    from public.t_ocorrencia_reconciliacao r
    where r.id_usuario_pai = p_id_usuario_pai
      and r.id_filho_tarefa = p_id_filho_tarefa
  ) then
    return 'DESCARTAVEL';
  end if;

  return 'SEM_HISTORICO';
end;
$function$;

revoke all on function public.classificar_historico_atribuicao_interno(bigint, bigint)
  from public, anon, authenticated, service_role;


create or replace function public.limpar_historico_descartavel_atribuicao_interno(
  p_id_usuario_pai bigint,
  p_id_filho_tarefa bigint
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_classificacao text;
  v_push integer := 0;
  v_reconciliacoes integer := 0;
begin
  v_classificacao := public.classificar_historico_atribuicao_interno(
    p_id_usuario_pai,
    p_id_filho_tarefa
  );

  if v_classificacao = 'NAO_ENCONTRADA' then
    raise exception 'Atribuição não encontrada';
  elsif v_classificacao = 'PENDENTE' then
    raise exception 'Atribuição com aviso pendente do filho não pode ser limpa';
  elsif v_classificacao = 'HISTORICO_EFETIVO' then
    raise exception 'Atribuição com histórico efetivo não pode ser limpa';
  end if;

  if v_classificacao = 'SEM_HISTORICO' then
    return jsonb_build_object(
      'ok', true,
      'classificacao', v_classificacao,
      'push_removidos', 0,
      'reconciliacoes_removidas', 0
    );
  end if;

  delete from public.t_push_resposta_filho pr
  where pr.id_usuario_pai = p_id_usuario_pai
    and pr.tipo_interacao = 'SOLICITACAO'
    and pr.id_interacao in (
      select s.id
      from public.t_solicitacao_tarefa_filho s
      where s.id_filho_tarefa = p_id_filho_tarefa
        and s.status = 'RESOLVIDA_NAO_PRECISOU'
    );
  get diagnostics v_push = row_count;

  delete from public.t_ocorrencia_reconciliacao r
  where r.id_usuario_pai = p_id_usuario_pai
    and r.id_filho_tarefa = p_id_filho_tarefa;
  get diagnostics v_reconciliacoes = row_count;

  return jsonb_build_object(
    'ok', true,
    'classificacao', v_classificacao,
    'push_removidos', v_push,
    'reconciliacoes_removidas', v_reconciliacoes
  );
end;
$function$;

revoke all on function public.limpar_historico_descartavel_atribuicao_interno(bigint, bigint)
  from public, anon, authenticated, service_role;


create or replace function public.classificar_exclusao_atribuicao_interno(
  p_id_usuario_pai bigint,
  p_id_filho_tarefa bigint
)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_data_fim timestamptz;
  v_historico text;
begin
  select v.data_fim
    into v_data_fim
  from public.t_filho_tarefa ft
  join public.t_vigencia v
    on v.id = ft.id_vigencia
   and v.id_usuario_pai = ft.id_usuario_pai
  where ft.id = p_id_filho_tarefa
    and ft.id_usuario_pai = p_id_usuario_pai;

  if v_data_fim is null then
    return 'NAO_ENCONTRADA';
  end if;

  if now() > v_data_fim then
    return 'VIGENCIA_FINALIZADA';
  end if;

  v_historico := public.classificar_historico_atribuicao_interno(
    p_id_usuario_pai,
    p_id_filho_tarefa
  );

  if v_historico = 'PENDENTE' then
    return 'PEDIDO_PENDENTE';
  elsif v_historico = 'HISTORICO_EFETIVO' then
    return 'HISTORICO_EFETIVO';
  elsif v_historico in ('SEM_HISTORICO', 'DESCARTAVEL') then
    return 'PODE_EXCLUIR';
  end if;

  return 'NAO_ENCONTRADA';
end;
$function$;

revoke all on function public.classificar_exclusao_atribuicao_interno(bigint, bigint)
  from public, anon, authenticated, service_role;


create or replace function public.excluir_atribuicao_com_regra(p_id_filho_tarefa bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_pai_id bigint;
  v_id_filho bigint;
  v_id_vigencia bigint;
  v_classificacao text;
  v_historico text;
  v_qtd_nao_precisou integer;
  v_qtd_solicitacoes integer;
  v_setting_anterior text;
  v_linhas_excluidas integer;
begin
  select p.id
    into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  select ft.id_filho, ft.id_vigencia
    into v_id_filho, v_id_vigencia
  from public.t_filho_tarefa ft
  where ft.id = p_id_filho_tarefa
    and ft.id_usuario_pai = v_pai_id
  for update;

  if v_id_filho is null then
    raise exception 'Atribuição não encontrada';
  end if;

  v_classificacao := public.classificar_exclusao_atribuicao_interno(
    v_pai_id,
    p_id_filho_tarefa
  );

  if v_classificacao = 'VIGENCIA_FINALIZADA' then
    raise exception 'Atribuições de vigências finalizadas não podem ser excluídas';
  elsif v_classificacao = 'PEDIDO_PENDENTE' then
    raise exception 'Esta atribuição tem um aviso pendente do filho e não pode ser excluída';
  elsif v_classificacao = 'HISTORICO_EFETIVO' then
    raise exception 'Esta atribuição possui histórico de Fez ou Não fez e não pode ser excluída';
  elsif v_classificacao <> 'PODE_EXCLUIR' then
    raise exception 'Atribuição não pode ser excluída';
  end if;

  v_historico := public.classificar_historico_atribuicao_interno(
    v_pai_id,
    p_id_filho_tarefa
  );

  select count(*)
    into v_qtd_nao_precisou
  from public.t_ocorrencia o
  where o.id_usuario_pai = v_pai_id
    and o.id_filho_tarefa = p_id_filho_tarefa
    and o.tipo = 'NAO_PRECISOU';

  select count(*)
    into v_qtd_solicitacoes
  from public.t_solicitacao_tarefa_filho s
  where s.id_filho_tarefa = p_id_filho_tarefa;

  perform public.limpar_historico_descartavel_atribuicao_interno(
    v_pai_id,
    p_id_filho_tarefa
  );

  v_setting_anterior := current_setting('app.exclusao_atribuicao_autorizada', true);
  perform set_config('app.exclusao_atribuicao_autorizada', '1', true);

  delete from public.t_filho_tarefa ft
  where ft.id = p_id_filho_tarefa
    and ft.id_usuario_pai = v_pai_id;

  get diagnostics v_linhas_excluidas = row_count;

  perform set_config(
    'app.exclusao_atribuicao_autorizada',
    coalesce(v_setting_anterior, ''),
    true
  );

  if v_linhas_excluidas <> 1 then
    raise exception 'Atribuição não encontrada';
  end if;

  return jsonb_build_object(
    'ok', true,
    'id_filho_tarefa', p_id_filho_tarefa,
    'id_filho', v_id_filho,
    'id_vigencia', v_id_vigencia,
    'historico', v_historico,
    'nao_precisou_removidos', v_qtd_nao_precisou,
    'solicitacoes_removidas', v_qtd_solicitacoes
  );
end;
$function$;

revoke all on function public.excluir_atribuicao_com_regra(bigint)
  from public, anon, service_role;
grant execute on function public.excluir_atribuicao_com_regra(bigint)
  to authenticated;


create or replace function public.tarefa_tem_historico_interno(
  p_id_usuario_pai bigint,
  p_id_tarefa bigint
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select
    exists (
      select 1
      from public.t_filho_tarefa ft
      where ft.id_usuario_pai = p_id_usuario_pai
        and ft.id_tarefa = p_id_tarefa
        and public.classificar_historico_atribuicao_interno(
          p_id_usuario_pai,
          ft.id
        ) = 'HISTORICO_EFETIVO'
    )
    or exists (
      select 1
      from public.t_estrela_concessao ec
      where ec.id_usuario_pai = p_id_usuario_pai
        and ec.id_tarefa = p_id_tarefa
    )
    or exists (
      select 1
      from public.t_estrela_movimento em
      where em.id_usuario_pai = p_id_usuario_pai
        and em.id_tarefa = p_id_tarefa
    );
$function$;

revoke all on function public.tarefa_tem_historico_interno(bigint, bigint)
  from public, anon, authenticated, service_role;


create or replace function public.remover_tarefa_interno(
  p_id_usuario_pai bigint,
  p_id_tarefa bigint
)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_ativa boolean;
  v_tem_historico boolean;
  v_flag_tarefa_anterior text;
  v_flag_atribuicao_anterior text;
  v_id_atribuicao bigint;
begin
  select t.ativo
    into v_ativa
  from public.t_tarefa t
  where t.id = p_id_tarefa
    and t.id_usuario_pai = p_id_usuario_pai
  for update;

  if not found then
    raise exception 'Tarefa não encontrada';
  end if;

  if v_ativa = false then
    return 'ARQUIVADA';
  end if;

  perform 1
  from public.t_filho_tarefa ft
  where ft.id_usuario_pai = p_id_usuario_pai
    and ft.id_tarefa = p_id_tarefa
  for update;

  if exists (
    select 1
    from public.t_filho_tarefa ft
    where ft.id_usuario_pai = p_id_usuario_pai
      and ft.id_tarefa = p_id_tarefa
      and public.classificar_historico_atribuicao_interno(
        p_id_usuario_pai,
        ft.id
      ) = 'PENDENTE'
  ) then
    raise exception 'Tarefa com aviso pendente do filho não pode ser removida';
  end if;

  v_tem_historico :=
    public.tarefa_tem_historico_interno(p_id_usuario_pai, p_id_tarefa);

  if not v_tem_historico then
    for v_id_atribuicao in
      select ft.id
      from public.t_filho_tarefa ft
      where ft.id_usuario_pai = p_id_usuario_pai
        and ft.id_tarefa = p_id_tarefa
      order by ft.id
    loop
      perform public.limpar_historico_descartavel_atribuicao_interno(
        p_id_usuario_pai,
        v_id_atribuicao
      );
    end loop;

    v_flag_tarefa_anterior :=
      coalesce(current_setting('app.remocao_tarefa_autorizada', true), '');

    perform set_config('app.remocao_tarefa_autorizada', '1', true);

    delete from public.t_tarefa t
    where t.id = p_id_tarefa
      and t.id_usuario_pai = p_id_usuario_pai;

    perform set_config(
      'app.remocao_tarefa_autorizada',
      v_flag_tarefa_anterior,
      true
    );

    return 'EXCLUIDA';
  end if;

  for v_id_atribuicao in
    select ft.id
    from public.t_filho_tarefa ft
    join public.t_vigencia v
      on v.id = ft.id_vigencia
     and v.id_usuario_pai = ft.id_usuario_pai
    where ft.id_usuario_pai = p_id_usuario_pai
      and ft.id_tarefa = p_id_tarefa
      and v.data_inicio > now()
      and public.classificar_historico_atribuicao_interno(
        p_id_usuario_pai,
        ft.id
      ) in ('SEM_HISTORICO', 'DESCARTAVEL')
    order by ft.id
  loop
    perform public.limpar_historico_descartavel_atribuicao_interno(
      p_id_usuario_pai,
      v_id_atribuicao
    );

    v_flag_atribuicao_anterior :=
      coalesce(current_setting('app.exclusao_atribuicao_autorizada', true), '');
    perform set_config('app.exclusao_atribuicao_autorizada', '1', true);

    delete from public.t_filho_tarefa
    where id = v_id_atribuicao
      and id_usuario_pai = p_id_usuario_pai;

    perform set_config(
      'app.exclusao_atribuicao_autorizada',
      v_flag_atribuicao_anterior,
      true
    );
  end loop;

  v_flag_tarefa_anterior :=
    coalesce(current_setting('app.remocao_tarefa_autorizada', true), '');

  perform set_config('app.remocao_tarefa_autorizada', '1', true);

  update public.t_tarefa
  set ativo = false,
      arquivada_em = now()
  where id = p_id_tarefa
    and id_usuario_pai = p_id_usuario_pai;

  perform set_config(
    'app.remocao_tarefa_autorizada',
    v_flag_tarefa_anterior,
    true
  );

  return 'ARQUIVADA';
end;
$function$;

revoke all on function public.remover_tarefa_interno(bigint, bigint)
  from public, anon, authenticated, service_role;


create or replace function public.excluir_vigencia_com_regra(p_id_vigencia bigint)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_pai_id bigint;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_tem_atribuicoes boolean;
  v_id_atribuicao bigint;
  v_classificacao text;
  v_flag_atribuicao_anterior text;
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
    and v.id_usuario_pai = v_pai_id
  for update;

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

  for v_id_atribuicao in
    select ft.id
    from public.t_filho_tarefa ft
    where ft.id_vigencia = p_id_vigencia
      and ft.id_usuario_pai = v_pai_id
    order by ft.id
  loop
    v_classificacao := public.classificar_historico_atribuicao_interno(
      v_pai_id,
      v_id_atribuicao
    );

    if v_classificacao = 'PENDENTE' then
      raise exception 'Vigência com pedido pendente do filho não pode ser excluída';
    elsif v_classificacao = 'HISTORICO_EFETIVO' then
      raise exception 'Vigência com histórico de Fez ou Não fez não pode ser excluída';
    end if;
  end loop;

  if now() >= v_inicio
     and now() <= v_fim
     and v_tem_atribuicoes then
    raise exception 'Vigência em andamento com atribuições não pode ser excluída';
  end if;

  for v_id_atribuicao in
    select ft.id
    from public.t_filho_tarefa ft
    where ft.id_vigencia = p_id_vigencia
      and ft.id_usuario_pai = v_pai_id
    order by ft.id
  loop
    perform public.limpar_historico_descartavel_atribuicao_interno(
      v_pai_id,
      v_id_atribuicao
    );
  end loop;

  v_flag_atribuicao_anterior :=
    coalesce(current_setting('app.exclusao_atribuicao_autorizada', true), '');
  perform set_config('app.exclusao_atribuicao_autorizada', '1', true);

  delete from public.t_filho_tarefa ft
  where ft.id_vigencia = p_id_vigencia
    and ft.id_usuario_pai = v_pai_id;

  perform set_config(
    'app.exclusao_atribuicao_autorizada',
    v_flag_atribuicao_anterior,
    true
  );

  delete from public.t_vigencia v
  where v.id = p_id_vigencia
    and v.id_usuario_pai = v_pai_id;

  return true;
end;
$function$;

revoke all on function public.excluir_vigencia_com_regra(bigint)
  from public, anon, service_role;
grant execute on function public.excluir_vigencia_com_regra(bigint)
  to authenticated;
