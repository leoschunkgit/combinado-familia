-- Teste transacional: penalidade só pode ser cumprida durante vigência em andamento.
-- Não deixa dados, pois termina em ROLLBACK.

begin;

do $$
declare
  v_pai_id bigint;
  v_auth uuid;
  v_filho_id bigint;
  v_vigencia_id bigint;
  v_tarefa_1 bigint;
  v_tarefa_2 bigint;
  v_ft_1 bigint;
  v_ft_2 bigint;
  v_occ_1 bigint;
  v_occ_2 bigint;
  v_res jsonb;
  v_status text;
begin
  select p.id, p.auth_user_id
    into v_pai_id, v_auth
  from public.t_usuario_pai p
  where p.auth_user_id is not null
  order by p.id
  limit 1;

  if v_pai_id is null or v_auth is null then
    raise exception 'TESTE: nenhum responsável disponível';
  end if;

  perform set_config('request.jwt.claim.sub', v_auth::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.t_filho (
    id_usuario_pai, nome, tem_mesada, tem_mesada_opcional, valor_mesada
  )
  values (
    v_pai_id, '__TESTE_PENALIDADE_VIGENCIA__', false, false, null
  )
  returning id into v_filho_id;

  insert into public.t_vigencia (
    id_usuario_pai, data_inicio, data_fim
  )
  values (
    v_pai_id, now() - interval '1 day', now() + interval '1 day'
  )
  returning id into v_vigencia_id;

  insert into public.t_tarefa (id_usuario_pai, nome)
  values (v_pai_id, '__TESTE_PENALIDADE_ATIVA__')
  returning id into v_tarefa_1;

  insert into public.t_tarefa (id_usuario_pai, nome)
  values (v_pai_id, '__TESTE_PENALIDADE_FINALIZADA__')
  returning id into v_tarefa_2;

  insert into public.t_filho_tarefa (
    id_usuario_pai, id_filho, id_tarefa, id_vigencia
  )
  values (
    v_pai_id, v_filho_id, v_tarefa_1, v_vigencia_id
  )
  returning id into v_ft_1;

  insert into public.t_filho_tarefa (
    id_usuario_pai, id_filho, id_tarefa, id_vigencia
  )
  values (
    v_pai_id, v_filho_id, v_tarefa_2, v_vigencia_id
  )
  returning id into v_ft_2;

  -- Cenário 1: durante a vigência, cumprir penalidade continua permitido.
  v_res := public.reconciliar_ocorrencia(
    p_acao => 'SALVAR',
    p_id_filho_tarefa => v_ft_1,
    p_created_at => now(),
    p_novo_tipo => 'NAO_FEZ',
    p_consequencia_tipo => 'PENALIDADE',
    p_penalidade_descricao => 'Penalidade ativa'
  );
  v_occ_1 := (v_res->>'id_ocorrencia')::bigint;

  perform public.reconciliar_ocorrencia(
    p_acao => 'CUMPRIR_PENALIDADE',
    p_id_ocorrencia => v_occ_1
  );

  select status into v_status
  from public.t_ocorrencia_consequencia
  where id_ocorrencia = v_occ_1;

  if v_status <> 'CUMPRIDA' then
    raise exception 'TESTE: penalidade em vigência ativa deveria ficar CUMPRIDA';
  end if;

  -- Cenário 2: cria outra penalidade pendente e encerra a vigência.
  v_res := public.reconciliar_ocorrencia(
    p_acao => 'SALVAR',
    p_id_filho_tarefa => v_ft_2,
    p_created_at => now(),
    p_novo_tipo => 'NAO_FEZ',
    p_consequencia_tipo => 'PENALIDADE',
    p_penalidade_descricao => 'Penalidade que ficará pendente'
  );
  v_occ_2 := (v_res->>'id_ocorrencia')::bigint;

  update public.t_vigencia
  set data_fim = now() - interval '1 minute'
  where id = v_vigencia_id;

  if public.vigencia_ocorrencia_em_andamento_interno(v_pai_id, v_occ_2) then
    raise exception 'TESTE: a vigência deveria estar finalizada';
  end if;

  -- A RPC central deve ser bloqueada.
  begin
    perform public.reconciliar_ocorrencia(
      p_acao => 'CUMPRIR_PENALIDADE',
      p_id_ocorrencia => v_occ_2
    );
    raise exception 'TESTE: RPC permitiu cumprir penalidade após a vigência';
  exception
    when others then
      if sqlerrm = 'TESTE: RPC permitiu cumprir penalidade após a vigência' then
        raise;
      end if;
      if position('vigência em andamento' in lower(sqlerrm)) = 0 then
        raise exception 'TESTE: erro inesperado na RPC: %', sqlerrm;
      end if;
  end;

  select status into v_status
  from public.t_ocorrencia_consequencia
  where id_ocorrencia = v_occ_2;

  if v_status <> 'PENDENTE' then
    raise exception 'TESTE: penalidade bloqueada deveria permanecer PENDENTE';
  end if;

  -- A proteção também deve funcionar contra UPDATE direto no banco.
  begin
    update public.t_ocorrencia_consequencia
    set status = 'CUMPRIDA',
        cumprida_em = now(),
        updated_at = now()
    where id_ocorrencia = v_occ_2;

    raise exception 'TESTE: UPDATE direto permitiu cumprir penalidade após a vigência';
  exception
    when others then
      if sqlerrm = 'TESTE: UPDATE direto permitiu cumprir penalidade após a vigência' then
        raise;
      end if;
      if position('vigência em andamento' in lower(sqlerrm)) = 0 then
        raise exception 'TESTE: erro inesperado no UPDATE direto: %', sqlerrm;
      end if;
  end;

  select status into v_status
  from public.t_ocorrencia_consequencia
  where id_ocorrencia = v_occ_2;

  if v_status <> 'PENDENTE' then
    raise exception 'TESTE: UPDATE bloqueado alterou o status indevidamente';
  end if;
end;
$$;

rollback;

select 'PENALIDADE_VIGENCIA_ATIVA_OK' as resultado;
