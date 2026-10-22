-- Teste transacional do fechamento de FEZ / NAO_FEZ / NAO_PRECISOU.
-- Não deixa dados: tudo roda dentro de transaction e termina em rollback.

begin;

do $$
declare
  v_pai_id bigint;
  v_auth uuid;
  v_filho_id bigint;
  v_vigencia_id bigint;
  v_vigencia_2_id bigint;
  v_tarefa_id bigint;
  v_ft_ids bigint[] := '{}';
  v_ft_id bigint;
  v_occ_id bigint;
  v_occ_fez bigint;
  v_occ_nao_fez bigint;
  v_occ_nao_precisou bigint;
  v_reward_id bigint;
  v_ultimo_fim timestamptz;
  v_inicio_2 timestamptz;
  v_res jsonb;
  v_total integer;
  v_count integer;
  v_status text;
  v_i integer;
  v_hoje date := timezone('America/Sao_Paulo', now())::date;
begin
  -- Prefere uma vigência ativa já existente. Se o ambiente estiver limpo,
  -- cria uma vigência temporária para o próprio teste. Tudo termina em ROLLBACK.
  select p.id, p.auth_user_id, v.id
    into v_pai_id, v_auth, v_vigencia_id
  from public.t_usuario_pai p
  join lateral (
    select v1.id
    from public.t_vigencia v1
    where v1.id_usuario_pai = p.id
      and now() between v1.data_inicio and v1.data_fim
    order by v1.data_inicio desc, v1.id desc
    limit 1
  ) v on true
  where p.auth_user_id is not null
  order by p.id
  limit 1;

  if v_pai_id is null or v_auth is null or v_vigencia_id is null then
    select p.id, p.auth_user_id
      into v_pai_id, v_auth
    from public.t_usuario_pai p
    where p.auth_user_id is not null
      and not exists (
        select 1
        from public.t_vigencia v
        where v.id_usuario_pai = p.id
      )
    order by p.id
    limit 1;

    if v_pai_id is null or v_auth is null then
      raise exception 'TESTE: nenhum responsável disponível para criar vigência temporária';
    end if;

    insert into public.t_vigencia (
      id_usuario_pai, data_inicio, data_fim
    )
    values (
      v_pai_id, now() - interval '1 day', now() + interval '1 day'
    )
    returning id into v_vigencia_id;
  end if;

  perform set_config('request.jwt.claim.sub', v_auth::text, true);

  insert into public.t_filho (
    id_usuario_pai, nome, tem_mesada, tem_mesada_opcional, valor_mesada
  )
  values (
    v_pai_id, '__TESTE_RESULTADOS__', true, true, 100
  )
  returning id into v_filho_id;

  -- Segunda vigência temporária, criada depois de qualquer vigência existente,
  -- prova que o contador de NAO_FEZ é isolado por vigência.
  select max(v.data_fim)
    into v_ultimo_fim
  from public.t_vigencia v
  where v.id_usuario_pai = v_pai_id;

  v_inicio_2 := greatest(
    coalesce(v_ultimo_fim + interval '1 day', now() + interval '10 days'),
    now() + interval '10 days'
  );

  insert into public.t_vigencia (
    id_usuario_pai, data_inicio, data_fim
  )
  values (
    v_pai_id, v_inicio_2, v_inicio_2 + interval '2 days'
  )
  returning id into v_vigencia_2_id;

  for v_i in 1..12 loop
    insert into public.t_tarefa (id_usuario_pai, nome)
    values (v_pai_id, '__TESTE_RESULTADO_' || v_i::text || '__')
    returning id into v_tarefa_id;

    insert into public.t_filho_tarefa (
      id_usuario_pai, id_filho, id_tarefa, id_vigencia
    )
    values (
      v_pai_id, v_filho_id, v_tarefa_id, v_vigencia_id
    )
    returning id into v_ft_id;

    v_ft_ids := array_append(v_ft_ids, v_ft_id);
  end loop;

  insert into public.t_recompensa_estrela (
    id_usuario_pai, id_filho, nome, descricao,
    estrelas_necessarias, ativo, marco_inicial_estrelas
  )
  values (
    v_pai_id, v_filho_id, '__TESTE_RECOMPENSA__', 'Teste', 3, true, 0
  )
  returning id into v_reward_id;

  -- 1) FEZ direto: resolve solicitação, cria 1 estrela.
  insert into public.t_solicitacao_tarefa_filho (
    id_filho_tarefa, data_referencia, observacao
  )
  values (v_ft_ids[1], v_hoje, 'terminou');

  v_res := public.reconciliar_ocorrencia(
    p_acao => 'SALVAR',
    p_id_filho_tarefa => v_ft_ids[1],
    p_created_at => now(),
    p_novo_tipo => 'FEZ',
    p_motivo => 'teste FEZ'
  );
  v_occ_fez := (v_res->>'id_ocorrencia')::bigint;

  select status into v_status
  from public.t_solicitacao_tarefa_filho
  where id_filho_tarefa = v_ft_ids[1]
    and data_referencia = v_hoje
  order by id desc limit 1;

  if v_status <> 'RESOLVIDA_FEZ' then
    raise exception 'TESTE FEZ: solicitação não resolvida como FEZ';
  end if;

  v_total := public.estrelas_total_conquistado_interno(v_pai_id, v_filho_id);
  if v_total <> 1 then
    raise exception 'TESTE FEZ: esperado 1 estrela, obtido %', v_total;
  end if;

  -- 2) NAO_FEZ direto: resolve solicitação, conta na vigência, sem estrela.
  insert into public.t_solicitacao_tarefa_filho (
    id_filho_tarefa, data_referencia, observacao
  )
  values (v_ft_ids[2], v_hoje, 'terminou');

  v_res := public.reconciliar_ocorrencia(
    p_acao => 'SALVAR',
    p_id_filho_tarefa => v_ft_ids[2],
    p_created_at => now(),
    p_novo_tipo => 'NAO_FEZ',
    p_consequencia_tipo => 'NENHUMA',
    p_motivo => 'teste NAO_FEZ'
  );
  v_occ_nao_fez := (v_res->>'id_ocorrencia')::bigint;

  select status into v_status
  from public.t_solicitacao_tarefa_filho
  where id_filho_tarefa = v_ft_ids[2]
    and data_referencia = v_hoje
  order by id desc limit 1;

  if v_status <> 'RESOLVIDA_NAO_FEZ' then
    raise exception 'TESTE NAO_FEZ: solicitação não resolvida';
  end if;

  v_count := public.contar_nao_fez_filho_vigencia(v_filho_id, v_vigencia_id);
  if v_count <> 1 then
    raise exception 'TESTE NAO_FEZ: contador esperado 1, obtido %', v_count;
  end if;

  v_count := public.contar_nao_fez_filho_vigencia(v_filho_id, v_vigencia_2_id);
  if v_count <> 0 then
    raise exception 'TESTE NAO_FEZ: nova vigência deveria iniciar com 0';
  end if;

  -- 3) NAO_PRECISOU direto: resolve solicitação, sem estrela/consequência.
  insert into public.t_solicitacao_tarefa_filho (
    id_filho_tarefa, data_referencia, observacao
  )
  values (v_ft_ids[3], v_hoje, 'terminou');

  v_res := public.reconciliar_ocorrencia(
    p_acao => 'SALVAR',
    p_id_filho_tarefa => v_ft_ids[3],
    p_created_at => now(),
    p_novo_tipo => 'NAO_PRECISOU',
    p_motivo => 'teste NAO_PRECISOU'
  );
  v_occ_nao_precisou := (v_res->>'id_ocorrencia')::bigint;

  select status into v_status
  from public.t_solicitacao_tarefa_filho
  where id_filho_tarefa = v_ft_ids[3]
    and data_referencia = v_hoje
  order by id desc limit 1;

  if v_status <> 'RESOLVIDA_NAO_PRECISOU' then
    raise exception 'TESTE NAO_PRECISOU: solicitação não resolvida';
  end if;

  if exists (
    select 1 from public.t_ocorrencia_consequencia
    where id_ocorrencia = v_occ_nao_precisou
  ) then
    raise exception 'TESTE NAO_PRECISOU: não deveria ter consequência';
  end if;

  -- 4) Cria 5 estrelas no total e conquista uma recompensa de meta 3.
  for v_i in 4..7 loop
    perform public.reconciliar_ocorrencia(
      p_acao => 'SALVAR',
      p_id_filho_tarefa => v_ft_ids[v_i],
      p_created_at => now(),
      p_novo_tipo => 'FEZ',
      p_motivo => 'teste estrelas'
    );
  end loop;

  v_total := public.estrelas_total_conquistado_interno(v_pai_id, v_filho_id);
  if v_total <> 5 then
    raise exception 'TESTE RECOMPENSA: esperado total 5, obtido %', v_total;
  end if;

  select count(*) into v_count
  from public.t_recompensa_resgate
  where id_usuario_pai = v_pai_id
    and id_filho = v_filho_id
    and id_recompensa = v_reward_id
    and status = 'PENDENTE';

  if v_count <> 1 then
    raise exception 'TESTE RECOMPENSA: deveria existir 1 conquista pendente';
  end if;

  -- 5) Confirma com 5 estrelas: o marco do próximo ciclo vira 5.
  perform public.concluir_ciclo_recompensa_interno(
    v_pai_id, v_filho_id, v_reward_id, 'RESPONSAVEL'
  );

  select count(*) into v_count
  from public.t_recompensa_resgate
  where id_usuario_pai = v_pai_id
    and id_filho = v_filho_id
    and id_recompensa = v_reward_id
    and status = 'ENTREGUE';

  if v_count <> 1 then
    raise exception 'TESTE RECOMPENSA: recompensa deveria estar entregue';
  end if;

  -- Só 2 novas estrelas depois do marco 5: ainda não conquista de novo.
  for v_i in 8..9 loop
    perform public.reconciliar_ocorrencia(
      p_acao => 'SALVAR',
      p_id_filho_tarefa => v_ft_ids[v_i],
      p_created_at => now(),
      p_novo_tipo => 'FEZ',
      p_motivo => 'teste novo ciclo'
    );
  end loop;

  select count(*) into v_count
  from public.t_recompensa_resgate
  where id_usuario_pai = v_pai_id
    and id_filho = v_filho_id
    and id_recompensa = v_reward_id
    and status = 'PENDENTE';

  if v_count <> 0 then
    raise exception 'TESTE RECOMPENSA: 2 estrelas após marco não deveriam conquistar';
  end if;

  -- Terceira estrela nova: total 8, nova conquista pendente.
  v_res := public.reconciliar_ocorrencia(
    p_acao => 'SALVAR',
    p_id_filho_tarefa => v_ft_ids[10],
    p_created_at => now(),
    p_novo_tipo => 'FEZ',
    p_motivo => 'teste nova conquista'
  );
  v_occ_id := (v_res->>'id_ocorrencia')::bigint;

  select count(*) into v_count
  from public.t_recompensa_resgate
  where id_usuario_pai = v_pai_id
    and id_filho = v_filho_id
    and id_recompensa = v_reward_id
    and status = 'PENDENTE';

  if v_count <> 1 then
    raise exception 'TESTE RECOMPENSA: terceira estrela nova deveria conquistar';
  end if;

  -- Uma estrela extra enquanto a recompensa está pendente.
  perform public.reconciliar_ocorrencia(
    p_acao => 'SALVAR',
    p_id_filho_tarefa => v_ft_ids[11],
    p_created_at => now(),
    p_novo_tipo => 'FEZ',
    p_motivo => 'teste estrela extra pendente'
  );

  -- FEZ -> NAO_FEZ remove 1 estrela, mas total continua >= 8: mantém conquista.
  perform public.reconciliar_ocorrencia(
    p_acao => 'SALVAR',
    p_id_ocorrencia => (
      select id from public.t_ocorrencia
      where id_filho_tarefa = v_ft_ids[11]
        and timezone('America/Sao_Paulo', created_at)::date = v_hoje
    ),
    p_novo_tipo => 'NAO_FEZ',
    p_consequencia_tipo => 'NENHUMA',
    p_motivo => 'teste mantém recompensa'
  );

  v_total := public.estrelas_total_conquistado_interno(v_pai_id, v_filho_id);
  if v_total <> 8 then
    raise exception 'TESTE TRANSIÇÃO: esperado total 8, obtido %', v_total;
  end if;

  select count(*) into v_count
  from public.t_recompensa_resgate
  where id_usuario_pai = v_pai_id
    and id_filho = v_filho_id
    and id_recompensa = v_reward_id
    and status = 'PENDENTE';

  if v_count <> 1 then
    raise exception 'TESTE TRANSIÇÃO: recompensa deveria continuar pendente na meta';
  end if;

  -- FEZ -> NAO_PRECISOU remove outra estrela: cai para 7 e cancela pendente.
  perform public.reconciliar_ocorrencia(
    p_acao => 'SALVAR',
    p_id_ocorrencia => v_occ_id,
    p_novo_tipo => 'NAO_PRECISOU',
    p_motivo => 'teste cancela recompensa'
  );

  v_total := public.estrelas_total_conquistado_interno(v_pai_id, v_filho_id);
  if v_total <> 7 then
    raise exception 'TESTE NAO_PRECISOU: esperado total 7, obtido %', v_total;
  end if;

  select count(*) into v_count
  from public.t_recompensa_resgate
  where id_usuario_pai = v_pai_id
    and id_filho = v_filho_id
    and id_recompensa = v_reward_id
    and status = 'PENDENTE';

  if v_count <> 0 then
    raise exception 'TESTE NAO_PRECISOU: conquista pendente deveria cancelar abaixo da meta';
  end if;

  -- Recompensa já entregue continua entregue mesmo com redução posterior.
  select count(*) into v_count
  from public.t_recompensa_resgate
  where id_usuario_pai = v_pai_id
    and id_filho = v_filho_id
    and id_recompensa = v_reward_id
    and status = 'ENTREGUE';

  if v_count <> 1 then
    raise exception 'TESTE RECOMPENSA: entregue não pode ser desfeita';
  end if;

  -- 6) NAO_FEZ com desconto -> NAO_PRECISOU estorna desconto.
  perform public.reconciliar_ocorrencia(
    p_acao => 'SALVAR',
    p_id_ocorrencia => v_occ_nao_fez,
    p_novo_tipo => 'NAO_FEZ',
    p_consequencia_tipo => 'DESCONTO',
    p_desconto_valor => 10,
    p_motivo => 'teste desconto'
  );

  select status into v_status
  from public.t_ocorrencia_consequencia
  where id_ocorrencia = v_occ_nao_fez;

  if v_status <> 'APLICADO' then
    raise exception 'TESTE DESCONTO: deveria estar aplicado';
  end if;

  perform public.reconciliar_ocorrencia(
    p_acao => 'SALVAR',
    p_id_ocorrencia => v_occ_nao_fez,
    p_novo_tipo => 'NAO_PRECISOU',
    p_motivo => 'teste estorno'
  );

  select status into v_status
  from public.t_ocorrencia_consequencia
  where id_ocorrencia = v_occ_nao_fez;

  if v_status <> 'ESTORNADO' then
    raise exception 'TESTE DESCONTO: deveria estar estornado';
  end if;

  -- 7) Penalidade pendente -> cumprida; depois FEZ e NAO_PRECISOU ficam bloqueados.
  v_res := public.reconciliar_ocorrencia(
    p_acao => 'SALVAR',
    p_id_filho_tarefa => v_ft_ids[12],
    p_created_at => now(),
    p_novo_tipo => 'NAO_FEZ',
    p_consequencia_tipo => 'PENALIDADE',
    p_penalidade_descricao => 'Sem videogame por 30 minutos',
    p_motivo => 'teste penalidade'
  );
  v_occ_id := (v_res->>'id_ocorrencia')::bigint;

  perform public.reconciliar_ocorrencia(
    p_acao => 'CUMPRIR_PENALIDADE',
    p_id_ocorrencia => v_occ_id
  );

  select status into v_status
  from public.t_ocorrencia_consequencia
  where id_ocorrencia = v_occ_id;

  if v_status <> 'CUMPRIDA' then
    raise exception 'TESTE PENALIDADE: deveria estar cumprida';
  end if;

  begin
    perform public.reconciliar_ocorrencia(
      p_acao => 'SALVAR',
      p_id_ocorrencia => v_occ_id,
      p_novo_tipo => 'FEZ'
    );
    raise exception 'TESTE PENALIDADE: FEZ foi aceito indevidamente';
  exception
    when others then
      if sqlerrm = 'TESTE PENALIDADE: FEZ foi aceito indevidamente' then
        raise;
      end if;
      if position('penalidade já foi cumprida' in lower(sqlerrm)) = 0 then
        raise exception 'TESTE PENALIDADE: erro inesperado ao bloquear FEZ: %', sqlerrm;
      end if;
  end;

  begin
    perform public.reconciliar_ocorrencia(
      p_acao => 'SALVAR',
      p_id_ocorrencia => v_occ_id,
      p_novo_tipo => 'NAO_PRECISOU'
    );
    raise exception 'TESTE PENALIDADE: NAO_PRECISOU foi aceito indevidamente';
  exception
    when others then
      if sqlerrm = 'TESTE PENALIDADE: NAO_PRECISOU foi aceito indevidamente' then
        raise;
      end if;
      if position('penalidade já foi cumprida' in lower(sqlerrm)) = 0 then
        raise exception 'TESTE PENALIDADE: erro inesperado ao bloquear NAO_PRECISOU: %', sqlerrm;
      end if;
  end;

  -- O trigger também protege contra UPDATE direto, fora da RPC.
  begin
    update public.t_ocorrencia
    set tipo = 'FEZ'
    where id = v_occ_id;
    raise exception 'TESTE TRIGGER: UPDATE direto foi aceito indevidamente';
  exception
    when others then
      if sqlerrm = 'TESTE TRIGGER: UPDATE direto foi aceito indevidamente' then
        raise;
      end if;
      if position('penalidade já foi cumprida' in lower(sqlerrm)) = 0 then
        raise exception 'TESTE TRIGGER: erro inesperado: %', sqlerrm;
      end if;
  end;

  -- Não existe mais desfazer: DELETE direto de resultado deve ser bloqueado.
  begin
    delete from public.t_ocorrencia
    where id = v_occ_fez;
    raise exception 'TESTE DELETE: resultado foi excluído indevidamente';
  exception
    when others then
      if sqlerrm = 'TESTE DELETE: resultado foi excluído indevidamente' then
        raise;
      end if;
      if position('não podem ser excluídos' in lower(sqlerrm)) = 0 then
        raise exception 'TESTE DELETE: erro inesperado: %', sqlerrm;
      end if;
  end;

  -- Consequência ativa não pode existir em FEZ.
  begin
    insert into public.t_ocorrencia_consequencia (
      id_usuario_pai, id_ocorrencia, tipo, desconto_valor, status
    )
    values (
      v_pai_id, v_occ_fez, 'DESCONTO', 1, 'APLICADO'
    );
    raise exception 'TESTE CONSEQUENCIA: consequência ativa foi aceita em FEZ';
  exception
    when others then
      if sqlerrm = 'TESTE CONSEQUENCIA: consequência ativa foi aceita em FEZ' then
        raise;
      end if;
      if position('consequência ativa' in lower(sqlerrm)) = 0 then
        raise exception 'TESTE CONSEQUENCIA: erro inesperado: %', sqlerrm;
      end if;
  end;

  -- Concessão manual de estrela não pode apontar para resultado não-FEZ.
  begin
    insert into public.t_estrela_concessao (
      id_usuario_pai, id_filho, id_vigencia, id_tarefa,
      id_filho_tarefa_origem, id_ocorrencia_origem,
      tarefa_nome_snapshot, data_referencia
    )
    select
      v_pai_id,
      ft.id_filho,
      ft.id_vigencia,
      ft.id_tarefa,
      ft.id,
      v_occ_id,
      t.nome,
      v_hoje
    from public.t_filho_tarefa ft
    join public.t_tarefa t on t.id = ft.id_tarefa
    where ft.id = v_ft_ids[12];

    raise exception 'TESTE ESTRELA: estrela foi aceita em NAO_FEZ';
  exception
    when others then
      if sqlerrm = 'TESTE ESTRELA: estrela foi aceita em NAO_FEZ' then
        raise;
      end if;
      if position('estrela só pode ser concedida' in lower(sqlerrm)) = 0 then
        raise exception 'TESTE ESTRELA: erro inesperado: %', sqlerrm;
      end if;
  end;

  -- Fechamento do contador de NAO_FEZ continua por vigência.
  v_count := public.contar_nao_fez_filho_vigencia(v_filho_id, v_vigencia_2_id);
  if v_count <> 0 then
    raise exception 'TESTE VIGENCIA: contador da segunda vigência deveria permanecer 0';
  end if;
end;
$$;

rollback;

select 'FECHAMENTO_RESULTADOS_OK' as resultado;
