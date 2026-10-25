
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

  if exists (
    select 1
    from public.t_solicitacao_tarefa_filho s
    where s.id_filho_tarefa = p_id_filho_tarefa
      and s.status = 'PENDENTE'
  ) then
    return 'PEDIDO_PENDENTE';
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

  -- Fez, Não fez ou qualquer tipo futuro/desconhecido protegem a atribuição.
  if exists (
    select 1
    from public.t_ocorrencia o
    where o.id_usuario_pai = p_id_usuario_pai
      and o.id_filho_tarefa = p_id_filho_tarefa
      and o.tipo <> 'NAO_PRECISOU'
  ) then
    return 'HISTORICO_EFETIVO';
  end if;

  -- Não precisou puro não deve possuir consequência financeira/disciplinar.
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

  -- Qualquer mérito atual ou legado ligado à ocorrência/atribuição é histórico efetivo.
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

  -- Uma ocorrência hoje "Não precisou" pode ter sido Fez/Não fez no passado.
  -- O reconciliador preserva essa trilha; nesse caso não permitimos apagá-la.
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

  return 'PODE_EXCLUIR';
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
  v_qtd_nao_precisou integer;
  v_qtd_solicitacoes integer;
  v_setting_anterior text;
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

  -- t_push_resposta_filho não possui FK para a solicitação.
  -- Removemos apenas notificações de solicitações que também serão descartadas.
  delete from public.t_push_resposta_filho pr
  where pr.id_usuario_pai = v_pai_id
    and pr.tipo_interacao = 'SOLICITACAO'
    and pr.id_interacao in (
      select s.id
      from public.t_solicitacao_tarefa_filho s
      where s.id_filho_tarefa = p_id_filho_tarefa
    );

  -- Reconciliação não possui FK para a atribuição/ocorrência.
  -- Neste ponto a classificação garante que a trilha é somente de Não precisou puro.
  delete from public.t_ocorrencia_reconciliacao r
  where r.id_usuario_pai = v_pai_id
    and r.id_filho_tarefa = p_id_filho_tarefa;

  -- A exclusão da atribuição fará CASCADE de ocorrências, consequências
  -- e solicitações. O trigger só aceita esse bypass dentro da RPC central.
  v_setting_anterior := current_setting('app.exclusao_atribuicao_autorizada', true);
  perform set_config('app.exclusao_atribuicao_autorizada', '1', true);

  delete from public.t_filho_tarefa ft
  where ft.id = p_id_filho_tarefa
    and ft.id_usuario_pai = v_pai_id;

  perform set_config(
    'app.exclusao_atribuicao_autorizada',
    coalesce(v_setting_anterior, ''),
    true
  );

  if not found then
    raise exception 'Atribuição não encontrada';
  end if;

  return jsonb_build_object(
    'ok', true,
    'id_filho_tarefa', p_id_filho_tarefa,
    'id_filho', v_id_filho,
    'id_vigencia', v_id_vigencia,
    'nao_precisou_removidos', v_qtd_nao_precisou,
    'solicitacoes_removidas', v_qtd_solicitacoes
  );
end;
$function$;

revoke all on function public.excluir_atribuicao_com_regra(bigint)
  from public, anon, service_role;
grant execute on function public.excluir_atribuicao_com_regra(bigint)
  to authenticated;


create or replace function public.guard_assignment_history()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_parentes_existentes boolean;
  v_tem_ocorrencia boolean;
  v_tem_solicitacao boolean;
  v_tem_solicitacao_pendente boolean;
begin
  if tg_op = 'DELETE'
     and coalesce(current_setting('app.exclusao_atribuicao_autorizada', true), '') = '1' then
    return old;
  end if;

  select exists (
    select 1
    from public.t_ocorrencia o
    where o.id_filho_tarefa = old.id
  ) into v_tem_ocorrencia;

  select
    exists (
      select 1
      from public.t_solicitacao_tarefa_filho s
      where s.id_filho_tarefa = old.id
    ),
    exists (
      select 1
      from public.t_solicitacao_tarefa_filho s
      where s.id_filho_tarefa = old.id
        and s.status = 'PENDENTE'
    )
  into v_tem_solicitacao, v_tem_solicitacao_pendente;

  if tg_op = 'DELETE' then
    select
      exists (select 1 from public.t_filho f where f.id = old.id_filho)
      and exists (select 1 from public.t_tarefa t where t.id = old.id_tarefa)
      and exists (select 1 from public.t_vigencia v where v.id = old.id_vigencia)
    into v_parentes_existentes;

    if v_parentes_existentes
       and (v_tem_ocorrencia or v_tem_solicitacao_pendente) then
      if v_tem_ocorrencia then
        raise exception 'Atribuicao com resultados nao pode ser excluida diretamente';
      end if;
      raise exception 'Atribuicao com aviso pendente do filho nao pode ser excluida diretamente';
    end if;

    return old;
  end if;

  if v_tem_ocorrencia then
    raise exception 'Atribuicao com resultados nao pode ser editada';
  end if;
  if v_tem_solicitacao then
    raise exception 'Atribuicao com aviso do filho nao pode ser editada';
  end if;

  return new;
end;
$function$;
