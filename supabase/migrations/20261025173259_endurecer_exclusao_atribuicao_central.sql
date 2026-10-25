
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

  delete from public.t_push_resposta_filho pr
  where pr.id_usuario_pai = v_pai_id
    and pr.tipo_interacao = 'SOLICITACAO'
    and pr.id_interacao in (
      select s.id
      from public.t_solicitacao_tarefa_filho s
      where s.id_filho_tarefa = p_id_filho_tarefa
    );

  delete from public.t_ocorrencia_reconciliacao r
  where r.id_usuario_pai = v_pai_id
    and r.id_filho_tarefa = p_id_filho_tarefa;

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
begin
  if tg_op = 'DELETE' then
    -- Cascades estruturais (filho, tarefa, vigência ou conta) continuam permitidos.
    if pg_trigger_depth() > 1 then
      return old;
    end if;

    if coalesce(current_setting('app.exclusao_atribuicao_autorizada', true), '') = '1' then
      return old;
    end if;

    select
      exists (select 1 from public.t_filho f where f.id = old.id_filho)
      and exists (select 1 from public.t_tarefa t where t.id = old.id_tarefa)
      and exists (select 1 from public.t_vigencia v where v.id = old.id_vigencia)
    into v_parentes_existentes;

    if not v_parentes_existentes then
      return old;
    end if;

    raise exception 'Use a regra central de exclusão para remover uma atribuição';
  end if;

  select exists (
    select 1
    from public.t_ocorrencia o
    where o.id_filho_tarefa = old.id
  ) into v_tem_ocorrencia;

  select exists (
    select 1
    from public.t_solicitacao_tarefa_filho s
    where s.id_filho_tarefa = old.id
  ) into v_tem_solicitacao;

  if v_tem_ocorrencia then
    raise exception 'Atribuicao com resultados nao pode ser editada';
  end if;

  if v_tem_solicitacao then
    raise exception 'Atribuicao com aviso do filho nao pode ser editada';
  end if;

  return new;
end;
$function$;
