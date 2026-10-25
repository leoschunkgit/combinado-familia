
create or replace function public.autoteste_reconciliador_ocorrencia()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pai bigint;
  v_vig bigint;
  v_inicio date;
  v_fim date;
  v_today date;
  v_other date;
  v_ts_today timestamptz;
  v_ts_other timestamptz;

  v_filho_mesada bigint;
  v_filho_sem_mesada bigint;

  v_tarefa_a bigint;
  v_tarefa_b bigint;
  v_tarefa_c bigint;
  v_tarefa_d bigint;
  v_tarefa_e bigint;

  v_ft_a bigint;
  v_ft_b bigint;
  v_ft_c bigint;
  v_ft_d bigint;
  v_ft_e bigint;
  v_assignments bigint[];

  v_occ_a bigint;
  v_occ_b bigint;
  v_occ_d bigint;
  v_occ_e bigint;

  v_revisao_b bigint;
  v_revisao_d bigint;
  v_revisao_e bigint;

  v_reward bigint;
  v_sol1 bigint;
  v_sol2 bigint;

  v_result jsonb;
  v_report jsonb := '{}'::jsonb;
  v_ok boolean;
  v_count integer;
  v_raw integer;
  v_status text;
  v_tipo text;
  v_val numeric;
begin
  v_pai := public.current_pai_id();
  if v_pai is null then
    raise exception 'AUTOTESTE: responsável autenticado não encontrado';
  end if;

  select
    v.id,
    timezone('America/Sao_Paulo',v.data_inicio)::date,
    timezone('America/Sao_Paulo',v.data_fim)::date
  into v_vig,v_inicio,v_fim
  from public.t_vigencia v
  where v.id_usuario_pai = v_pai
    and now() between v.data_inicio and v.data_fim
  order by v.data_inicio desc
  limit 1;

  if v_vig is null then
    raise exception 'AUTOTESTE: não há vigência em andamento';
  end if;

  v_today := timezone('America/Sao_Paulo',now())::date;
  v_other := case
    when v_today - 1 >= v_inicio then v_today - 1
    else v_today
  end;

  v_ts_today := (v_today::timestamp + time '12:00') at time zone 'America/Sao_Paulo';
  v_ts_other := (v_other::timestamp + time '12:00') at time zone 'America/Sao_Paulo';

  insert into public.t_filho(
    id_usuario_pai,nome,tem_mesada,valor_mesada,tem_mesada_opcional
  )
  values(v_pai,'__AUTOTESTE_RECONCILIADOR_MESADA__',true,100,true)
  returning id into v_filho_mesada;

  insert into public.t_filho(
    id_usuario_pai,nome,tem_mesada,valor_mesada,tem_mesada_opcional
  )
  values(v_pai,'__AUTOTESTE_RECONCILIADOR_SEM_MESADA__',false,null,false)
  returning id into v_filho_sem_mesada;

  insert into public.t_tarefa(id_usuario_pai,nome)
  values(v_pai,'__AUTOTESTE_A__') returning id into v_tarefa_a;
  insert into public.t_tarefa(id_usuario_pai,nome)
  values(v_pai,'__AUTOTESTE_B__') returning id into v_tarefa_b;
  insert into public.t_tarefa(id_usuario_pai,nome)
  values(v_pai,'__AUTOTESTE_C__') returning id into v_tarefa_c;
  insert into public.t_tarefa(id_usuario_pai,nome)
  values(v_pai,'__AUTOTESTE_D__') returning id into v_tarefa_d;
  insert into public.t_tarefa(id_usuario_pai,nome)
  values(v_pai,'__AUTOTESTE_E__') returning id into v_tarefa_e;

  insert into public.t_filho_tarefa(id_usuario_pai,id_filho,id_tarefa,id_vigencia)
  values(v_pai,v_filho_mesada,v_tarefa_a,v_vig) returning id into v_ft_a;
  insert into public.t_filho_tarefa(id_usuario_pai,id_filho,id_tarefa,id_vigencia)
  values(v_pai,v_filho_mesada,v_tarefa_b,v_vig) returning id into v_ft_b;
  insert into public.t_filho_tarefa(id_usuario_pai,id_filho,id_tarefa,id_vigencia)
  values(v_pai,v_filho_sem_mesada,v_tarefa_c,v_vig) returning id into v_ft_c;
  insert into public.t_filho_tarefa(id_usuario_pai,id_filho,id_tarefa,id_vigencia)
  values(v_pai,v_filho_mesada,v_tarefa_d,v_vig) returning id into v_ft_d;
  insert into public.t_filho_tarefa(id_usuario_pai,id_filho,id_tarefa,id_vigencia)
  values(v_pai,v_filho_mesada,v_tarefa_e,v_vig) returning id into v_ft_e;

  v_assignments := array[v_ft_a,v_ft_b,v_ft_c,v_ft_d,v_ft_e];

  -- Recompensa com meta 1: permite testar criação/cancelamento/preservação de ciclo.
  v_reward := public.salvar_recompensa_estrelas(
    v_filho_mesada,
    '__AUTOTESTE_RECOMPENSA__',
    'recompensa temporária',
    1,
    null
  );

  -- 1) FEZ cria estrela e ciclo pendente.
  v_result := public.reconciliar_ocorrencia(
    'SALVAR',null,v_ft_a,v_ts_today,'FEZ',
    null,null,null,'TEXTO','Muito bem',null,null,'AUTOTESTE'
  );
  v_occ_a := (v_result->>'id_ocorrencia')::bigint;

  select count(*) into v_count
  from public.t_estrela_concessao
  where id_usuario_pai=v_pai and id_filho=v_filho_mesada;
  if v_count <> 1 then
    raise exception 'AUTOTESTE 1: FEZ deveria gerar 1 estrela, gerou %',v_count;
  end if;

  select count(*) into v_count
  from public.t_recompensa_resgate
  where id_usuario_pai=v_pai and id_filho=v_filho_mesada
    and id_recompensa=v_reward and status='PENDENTE';
  if v_count <> 1 then
    raise exception 'AUTOTESTE 1: recompensa deveria estar PENDENTE';
  end if;
  v_report := v_report || jsonb_build_object('01_fez_estrela_recompensa','OK');

  -- 2) FEZ -> NAO_FEZ sem consequência revoga estrela viva e cancela ciclo pendente.
  v_result := public.reconciliar_ocorrencia(
    'SALVAR',v_occ_a,null,null,'NAO_FEZ',
    'NENHUMA',null,null,null,null,null,null,'AUTOTESTE'
  );

  if public.estrelas_total_conquistado_interno(v_pai,v_filho_mesada) <> 0 then
    raise exception 'AUTOTESTE 2: estrela não foi removida ao virar NAO_FEZ';
  end if;

  select count(*) into v_count
  from public.t_recompensa_resgate
  where id_usuario_pai=v_pai and id_filho=v_filho_mesada
    and id_recompensa=v_reward and status='CANCELADO';
  if v_count <> 1 then
    raise exception 'AUTOTESTE 2: ciclo pendente não foi cancelado';
  end if;

  if public.contar_nao_fez_filho_vigencia(v_filho_mesada,v_vig) <> 1 then
    raise exception 'AUTOTESTE 2: contador vivo de NAO_FEZ deveria ser 1';
  end if;
  v_report := v_report || jsonb_build_object('02_fez_para_nao_fez','OK');

  -- 3) NAO_FEZ -> FEZ volta a conceder estrela e pode gerar novo ciclo pendente.
  perform public.reconciliar_ocorrencia(
    'SALVAR',v_occ_a,null,null,'FEZ',
    null,null,null,'NENHUMA',null,null,null,'AUTOTESTE'
  );

  if public.estrelas_total_conquistado_interno(v_pai,v_filho_mesada) <> 1 then
    raise exception 'AUTOTESTE 3: estrela não voltou ao corrigir para FEZ';
  end if;

  select count(*) into v_count
  from public.t_recompensa_resgate
  where id_usuario_pai=v_pai and id_filho=v_filho_mesada
    and id_recompensa=v_reward and status='PENDENTE';
  if v_count <> 1 then
    raise exception 'AUTOTESTE 3: novo ciclo pendente não foi criado';
  end if;
  v_report := v_report || jsonb_build_object('03_nao_fez_para_fez','OK');

  -- 4) Ciclo entregue permanece histórico mesmo se FEZ depois virar NAO_FEZ.
  v_result := public.confirmar_recompensa_aproveitada(v_reward);
  if coalesce((v_result->>'ok')::boolean,false) is not true then
    raise exception 'AUTOTESTE 4: não foi possível concluir recompensa: %',v_result;
  end if;

  perform public.reconciliar_ocorrencia(
    'SALVAR',v_occ_a,null,null,'NAO_FEZ',
    'NENHUMA',null,null,null,null,null,null,'AUTOTESTE'
  );

  select count(*) into v_count
  from public.t_recompensa_resgate
  where id_usuario_pai=v_pai and id_filho=v_filho_mesada
    and id_recompensa=v_reward and status='ENTREGUE';
  if v_count <> 1 then
    raise exception 'AUTOTESTE 4: ciclo ENTREGUE foi alterado';
  end if;
  v_report := v_report || jsonb_build_object('04_ciclo_entregue_preservado','OK');

  -- 5) Desconto aplicado e depois estornado quando NAO_FEZ vira FEZ.
  perform public.reconciliar_ocorrencia(
    'SALVAR',v_occ_a,null,null,'NAO_FEZ',
    'DESCONTO',10,null,null,null,null,null,'AUTOTESTE'
  );

  select desconto_valor,status into v_val,v_status
  from public.t_ocorrencia_consequencia
  where id_ocorrencia=v_occ_a;
  if v_val <> 10 or v_status <> 'APLICADO' then
    raise exception 'AUTOTESTE 5: desconto não ficou APLICADO';
  end if;

  perform public.reconciliar_ocorrencia(
    'SALVAR',v_occ_a,null,null,'FEZ',
    null,null,null,'NENHUMA',null,null,null,'AUTOTESTE'
  );

  select status into v_status
  from public.t_ocorrencia_consequencia
  where id_ocorrencia=v_occ_a;
  if v_status <> 'ESTORNADO' then
    raise exception 'AUTOTESTE 5: desconto não foi ESTORNADO';
  end if;
  v_report := v_report || jsonb_build_object('05_desconto_estorno','OK');

  -- 6) Penalidade pendente -> cumprida; correção posterior para FEZ preserva fato cumprido.
  perform public.reconciliar_ocorrencia(
    'SALVAR',v_occ_a,null,null,'NAO_FEZ',
    'PENALIDADE',null,'Sem videogame por 30 minutos',null,null,null,null,'AUTOTESTE'
  );

  select status into v_status
  from public.t_ocorrencia_consequencia
  where id_ocorrencia=v_occ_a;
  if v_status <> 'PENDENTE' then
    raise exception 'AUTOTESTE 6: penalidade deveria estar PENDENTE';
  end if;

  perform public.reconciliar_ocorrencia(
    'CUMPRIR_PENALIDADE',v_occ_a,null,null,null,
    null,null,null,null,null,null,null,'AUTOTESTE'
  );

  select status into v_status
  from public.t_ocorrencia_consequencia
  where id_ocorrencia=v_occ_a;
  if v_status <> 'CUMPRIDA' then
    raise exception 'AUTOTESTE 6: penalidade não foi marcada CUMPRIDA';
  end if;

  perform public.reconciliar_ocorrencia(
    'SALVAR',v_occ_a,null,null,'FEZ',
    null,null,null,'NENHUMA',null,null,null,'AUTOTESTE'
  );

  select status into v_status
  from public.t_ocorrencia_consequencia
  where id_ocorrencia=v_occ_a;
  if v_status <> 'CUMPRIDA' then
    raise exception 'AUTOTESTE 6: penalidade cumprida não deveria ser apagada/cancelada';
  end if;
  v_report := v_report || jsonb_build_object('06_penalidade_cumprida_historica','OK');

  -- 7) Filho sem mesada não pode receber desconto.
  v_ok := false;
  begin
    perform public.reconciliar_ocorrencia(
      'SALVAR',null,v_ft_c,v_ts_today,'NAO_FEZ',
      'DESCONTO',5,null,null,null,null,null,'AUTOTESTE'
    );
  exception when others then
    if position('só pode ser aplicado a filho com mesada' in sqlerrm) > 0 then
      v_ok := true;
    else
      raise;
    end if;
  end;
  if not v_ok then
    raise exception 'AUTOTESTE 7: desconto para filho sem mesada não foi bloqueado';
  end if;
  v_report := v_report || jsonb_build_object('07_bloqueio_desconto_sem_mesada','OK');

  -- 8) Revisão exata mantendo NAO_FEZ.
  v_result := public.reconciliar_ocorrencia(
    'SALVAR',null,v_ft_b,v_ts_today,'NAO_FEZ',
    'NENHUMA',null,null,null,null,null,null,'AUTOTESTE'
  );
  v_occ_b := (v_result->>'id_ocorrencia')::bigint;

  insert into public.t_revisao_tarefa_filho(
    id_filho_tarefa,id_ocorrencia,data_referencia,observacao
  )
  values(v_ft_b,v_occ_b,v_today,'autoteste manter')
  returning id into v_revisao_b;

  perform public.resolver_revisao_tarefa_filho(v_revisao_b,'MANTER_NAO_FEZ');

  select status into v_status
  from public.t_revisao_tarefa_filho where id=v_revisao_b;
  if v_status <> 'MANTEVE_NAO_FEZ' then
    raise exception 'AUTOTESTE 8: revisão não fechou como MANTEVE_NAO_FEZ';
  end if;

  select tipo into v_tipo from public.t_ocorrencia where id=v_occ_b;
  if v_tipo <> 'NAO_FEZ' then
    raise exception 'AUTOTESTE 8: ocorrência não permaneceu NAO_FEZ';
  end if;
  v_report := v_report || jsonb_build_object('08_revisao_mantem_nao_fez','OK');

  -- 9) Revisão exata alterando NAO_FEZ com desconto para FEZ gera estorno.
  v_result := public.reconciliar_ocorrencia(
    'SALVAR',null,v_ft_d,v_ts_today,'NAO_FEZ',
    'DESCONTO',7,null,null,null,null,null,'AUTOTESTE'
  );
  v_occ_d := (v_result->>'id_ocorrencia')::bigint;

  insert into public.t_revisao_tarefa_filho(
    id_filho_tarefa,id_ocorrencia,data_referencia,observacao
  )
  values(v_ft_d,v_occ_d,v_today,'autoteste alterar')
  returning id into v_revisao_d;

  perform public.resolver_revisao_tarefa_filho(v_revisao_d,'ALTERAR_PARA_FEZ');

  select status into v_status
  from public.t_revisao_tarefa_filho where id=v_revisao_d;
  if v_status <> 'ALTERADO_PARA_FEZ' then
    raise exception 'AUTOTESTE 9: revisão não fechou como ALTERADO_PARA_FEZ';
  end if;

  select tipo into v_tipo from public.t_ocorrencia where id=v_occ_d;
  if v_tipo <> 'FEZ' then
    raise exception 'AUTOTESTE 9: ocorrência não virou FEZ';
  end if;

  select status into v_status
  from public.t_ocorrencia_consequencia where id_ocorrencia=v_occ_d;
  if v_status <> 'ESTORNADO' then
    raise exception 'AUTOTESTE 9: desconto da revisão não foi estornado';
  end if;
  v_report := v_report || jsonb_build_object('09_revisao_altera_para_fez','OK');

  -- 10) "Terminei": resolve somente a pendência atual; desfazer não reabre o ciclo antigo.
  insert into public.t_solicitacao_tarefa_filho(
    id_filho_tarefa,data_referencia,observacao
  )
  values(v_ft_e,v_today,'primeiro ciclo')
  returning id into v_sol1;

  v_result := public.reconciliar_ocorrencia(
    'SALVAR',null,v_ft_e,v_ts_today,'FEZ',
    null,null,null,'NENHUMA',null,null,null,'AUTOTESTE'
  );
  v_occ_e := (v_result->>'id_ocorrencia')::bigint;

  select status into v_status
  from public.t_solicitacao_tarefa_filho where id=v_sol1;
  if v_status <> 'RESOLVIDA_FEZ' then
    raise exception 'AUTOTESTE 10: solicitação não resolveu como FEZ';
  end if;

  perform public.reconciliar_ocorrencia(
    'DESFAZER',v_occ_e,null,null,null,
    null,null,null,null,null,null,null,'AUTOTESTE'
  );

  select status into v_status
  from public.t_solicitacao_tarefa_filho where id=v_sol1;
  if v_status <> 'RESOLVIDA_FEZ' then
    raise exception 'AUTOTESTE 10: desfazer reabriu/alterou solicitação histórica';
  end if;

  insert into public.t_solicitacao_tarefa_filho(
    id_filho_tarefa,data_referencia,observacao
  )
  values(v_ft_e,v_today,'segundo ciclo')
  returning id into v_sol2;

  v_result := public.reconciliar_ocorrencia(
    'SALVAR',null,v_ft_e,v_ts_today,'NAO_FEZ',
    'NENHUMA',null,null,null,null,null,null,'AUTOTESTE'
  );
  v_occ_e := (v_result->>'id_ocorrencia')::bigint;

  select status into v_status
  from public.t_solicitacao_tarefa_filho where id=v_sol2;
  if v_status <> 'RESOLVIDA_NAO_FEZ' then
    raise exception 'AUTOTESTE 10: novo ciclo não resolveu como NAO_FEZ';
  end if;

  select status into v_status
  from public.t_solicitacao_tarefa_filho where id=v_sol1;
  if v_status <> 'RESOLVIDA_FEZ' then
    raise exception 'AUTOTESTE 10: histórico antigo foi reescrito';
  end if;
  v_report := v_report || jsonb_build_object('10_ciclo_terimei_sem_loop','OK');

  -- 11) Uma única ocorrência oficial por tarefa/dia.
  v_ok := false;
  begin
    perform public.reconciliar_ocorrencia(
      'SALVAR',null,v_ft_e,v_ts_today,'FEZ',
      null,null,null,'NENHUMA',null,null,null,'AUTOTESTE'
    );
  exception when unique_violation then
    v_ok := true;
  end;
  if not v_ok then
    raise exception 'AUTOTESTE 11: foi possível criar ocorrência duplicada na mesma tarefa/dia';
  end if;
  v_report := v_report || jsonb_build_object('11_unica_ocorrencia_tarefa_dia','OK');

  -- 12) Não permite mover ocorrência existente para outro dia.
  if v_other <> v_today then
    v_ok := false;
    begin
      perform public.reconciliar_ocorrencia(
        'SALVAR',v_occ_e,null,v_ts_other,'NAO_FEZ',
        null,null,null,null,null,null,null,'AUTOTESTE'
      );
    exception when others then
      if position('Para mudar a data' in sqlerrm) > 0 then
        v_ok := true;
      else
        raise;
      end if;
    end;
    if not v_ok then
      raise exception 'AUTOTESTE 12: mudança direta de data não foi bloqueada';
    end if;
  end if;
  v_report := v_report || jsonb_build_object('12_data_imutavel_por_ocorrencia','OK');

  -- 13) Desfazer NAO_FEZ com revisão pendente encerra a revisão como MARCACAO_DESFEITA.
  perform public.reconciliar_ocorrencia(
    'SALVAR',v_occ_e,null,null,'NAO_FEZ',
    null,null,null,null,null,null,null,'AUTOTESTE'
  );

  -- Como já existe revisão por ocorrência? Esta ocorrência não possui revisão ainda.
  insert into public.t_revisao_tarefa_filho(
    id_filho_tarefa,id_ocorrencia,data_referencia,observacao
  )
  values(v_ft_e,v_occ_e,v_today,'autoteste desfazer')
  returning id into v_revisao_e;

  perform public.reconciliar_ocorrencia(
    'DESFAZER',v_occ_e,null,null,null,
    null,null,null,null,null,null,null,'AUTOTESTE'
  );

  select status into v_status
  from public.t_revisao_tarefa_filho where id=v_revisao_e;
  if v_status <> 'MARCACAO_DESFEITA' then
    raise exception 'AUTOTESTE 13: revisão não encerrou como MARCACAO_DESFEITA';
  end if;

  if exists(select 1 from public.t_ocorrencia where id=v_occ_e) then
    raise exception 'AUTOTESTE 13: ocorrência não foi desfeita';
  end if;
  v_report := v_report || jsonb_build_object('13_desfazer_fecha_revisao','OK');

  -- 14) Contador é derivado diretamente dos registros vivos.
  v_count := public.contar_nao_fez_filho_vigencia(v_filho_mesada,v_vig);

  select count(*)::integer into v_raw
  from public.t_ocorrencia o
  join public.t_filho_tarefa ft on ft.id=o.id_filho_tarefa
  where ft.id_usuario_pai=v_pai
    and ft.id_filho=v_filho_mesada
    and ft.id_vigencia=v_vig
    and o.tipo='NAO_FEZ';

  if v_count <> v_raw then
    raise exception 'AUTOTESTE 14: contador central % difere do registro vivo %',v_count,v_raw;
  end if;
  v_report := v_report || jsonb_build_object('14_contador_registro_vivo','OK');

  -- Limpeza integral dos dados temporários.
  delete from public.t_ocorrencia_reconciliacao
  where id_usuario_pai=v_pai
    and id_filho_tarefa = any(v_assignments);

  delete from public.t_filho
  where id in (v_filho_mesada,v_filho_sem_mesada)
    and id_usuario_pai=v_pai;

  delete from public.t_tarefa
  where id in (v_tarefa_a,v_tarefa_b,v_tarefa_c,v_tarefa_d,v_tarefa_e)
    and id_usuario_pai=v_pai;

  return jsonb_build_object(
    'ok',true,
    'resultado','AUTOTESTE_APROVADO',
    'cenarios',v_report
  );
end;
$$;

revoke all on function public.autoteste_reconciliador_ocorrencia() from public;
grant execute on function public.autoteste_reconciliador_ocorrencia() to authenticated;
