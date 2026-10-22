begin;

do $$
begin
  if not has_function_privilege(
    'authenticated',
    'public.total_descontos_aplicados_filho_vigencia_interno(bigint,bigint,bigint,bigint)',
    'EXECUTE'
  ) then
    raise exception 'AUTHENTICATED_SEM_EXECUTE_HELPER_MESADA_VIGENCIA';
  end if;
end $$;

do $$
declare
  v_id_usuario_pai bigint;
  v_id_vigencia bigint;
  v_id_filho bigint;
  v_id_tarefa_1 bigint;
  v_id_tarefa_2 bigint;
  v_id_tarefa_3 bigint;
  v_id_filho_tarefa_1 bigint;
  v_id_filho_tarefa_2 bigint;
  v_id_filho_tarefa_3 bigint;
  v_id_ocorrencia_1 bigint;
  v_id_ocorrencia_2 bigint;
  v_id_ocorrencia_3 bigint;
  v_id_consequencia_2 bigint;
  v_total numeric;
  v_bloqueou_mesada_menor boolean := false;
  v_bloqueou_desconto_excedente boolean := false;
begin
  select v.id_usuario_pai, v.id
    into v_id_usuario_pai, v_id_vigencia
  from public.t_vigencia v
  where now() between v.data_inicio and v.data_fim
  order by v.id
  limit 1;

  if v_id_vigencia is null then
    raise exception 'TESTE_REQUER_VIGENCIA_EM_ANDAMENTO';
  end if;

  insert into public.t_filho (
    id_usuario_pai,
    nome,
    tem_mesada,
    tem_mesada_opcional,
    valor_mesada
  )
  values (
    v_id_usuario_pai,
    'AUTOTESTE_MESADA_POR_VIGENCIA',
    true,
    true,
    100
  )
  returning id into v_id_filho;

  insert into public.t_tarefa (id_usuario_pai, nome)
  values (v_id_usuario_pai, 'AUTOTESTE_MESADA_1')
  returning id into v_id_tarefa_1;

  insert into public.t_tarefa (id_usuario_pai, nome)
  values (v_id_usuario_pai, 'AUTOTESTE_MESADA_2')
  returning id into v_id_tarefa_2;

  insert into public.t_tarefa (id_usuario_pai, nome)
  values (v_id_usuario_pai, 'AUTOTESTE_MESADA_3')
  returning id into v_id_tarefa_3;

  insert into public.t_filho_tarefa (
    id_usuario_pai,
    id_filho,
    id_tarefa,
    id_vigencia
  )
  values (v_id_usuario_pai, v_id_filho, v_id_tarefa_1, v_id_vigencia)
  returning id into v_id_filho_tarefa_1;

  insert into public.t_filho_tarefa (
    id_usuario_pai,
    id_filho,
    id_tarefa,
    id_vigencia
  )
  values (v_id_usuario_pai, v_id_filho, v_id_tarefa_2, v_id_vigencia)
  returning id into v_id_filho_tarefa_2;

  insert into public.t_filho_tarefa (
    id_usuario_pai,
    id_filho,
    id_tarefa,
    id_vigencia
  )
  values (v_id_usuario_pai, v_id_filho, v_id_tarefa_3, v_id_vigencia)
  returning id into v_id_filho_tarefa_3;

  insert into public.t_ocorrencia (
    id_usuario_pai,
    id_filho_tarefa,
    tipo,
    created_at
  )
  values (v_id_usuario_pai, v_id_filho_tarefa_1, 'NAO_FEZ', now())
  returning id into v_id_ocorrencia_1;

  insert into public.t_ocorrencia_consequencia (
    id_usuario_pai,
    id_ocorrencia,
    tipo,
    desconto_valor,
    status
  )
  values (v_id_usuario_pai, v_id_ocorrencia_1, 'DESCONTO', 10, 'APLICADO');

  insert into public.t_ocorrencia (
    id_usuario_pai,
    id_filho_tarefa,
    tipo,
    created_at
  )
  values (v_id_usuario_pai, v_id_filho_tarefa_2, 'NAO_FEZ', now())
  returning id into v_id_ocorrencia_2;

  insert into public.t_ocorrencia_consequencia (
    id_usuario_pai,
    id_ocorrencia,
    tipo,
    desconto_valor,
    status
  )
  values (v_id_usuario_pai, v_id_ocorrencia_2, 'DESCONTO', 20, 'APLICADO')
  returning id into v_id_consequencia_2;

  v_total :=
    public.total_descontos_aplicados_filho_vigencia_interno(
      v_id_usuario_pai,
      v_id_filho,
      v_id_vigencia,
      null
    );

  if v_total <> 30 then
    raise exception 'TOTAL_DESCONTOS_ESPERADO_30_OBTIDO_%', v_total;
  end if;

  update public.t_filho
  set tem_mesada = false,
      tem_mesada_opcional = null,
      valor_mesada = null
  where id = v_id_filho;

  update public.t_filho
  set tem_mesada = true,
      tem_mesada_opcional = true,
      valor_mesada = 30
  where id = v_id_filho;

  begin
    update public.t_filho
    set valor_mesada = 29.99
    where id = v_id_filho;
  exception when others then
    v_bloqueou_mesada_menor :=
      position('A mesada não pode ser menor' in sqlerrm) > 0;
  end;

  if not v_bloqueou_mesada_menor then
    raise exception 'MESADA_MENOR_QUE_DESCONTOS_DEVERIA_SER_BLOQUEADA';
  end if;

  insert into public.t_ocorrencia (
    id_usuario_pai,
    id_filho_tarefa,
    tipo,
    created_at
  )
  values (v_id_usuario_pai, v_id_filho_tarefa_3, 'NAO_FEZ', now())
  returning id into v_id_ocorrencia_3;

  begin
    insert into public.t_ocorrencia_consequencia (
      id_usuario_pai,
      id_ocorrencia,
      tipo,
      desconto_valor,
      status
    )
    values (
      v_id_usuario_pai,
      v_id_ocorrencia_3,
      'DESCONTO',
      0.01,
      'APLICADO'
    );
  exception when others then
    v_bloqueou_desconto_excedente :=
      position('não pode ultrapassar a mesada atual' in sqlerrm) > 0;
  end;

  if not v_bloqueou_desconto_excedente then
    raise exception 'DESCONTO_ACIMA_DO_SALDO_DEVERIA_SER_BLOQUEADO';
  end if;

  update public.t_ocorrencia_consequencia
  set status = 'ESTORNADO'
  where id = v_id_consequencia_2;

  v_total :=
    public.total_descontos_aplicados_filho_vigencia_interno(
      v_id_usuario_pai,
      v_id_filho,
      v_id_vigencia,
      null
    );

  if v_total <> 10 then
    raise exception 'TOTAL_APOS_ESTORNO_ESPERADO_10_OBTIDO_%', v_total;
  end if;

  update public.t_filho
  set valor_mesada = 10
  where id = v_id_filho;

  raise notice 'MESADA_POR_VIGENCIA_OK';
end $$;

rollback;
