-- Teste transacional do ciclo da mesada.
-- Garante que retirar e reativar a mesada inicia um saldo novo
-- sem apagar nem reaplicar descontos históricos.

begin;

do $test$
declare
  v_pai_id bigint;
  v_vigencia_id bigint;
  v_filho_id bigint;
  v_tarefa1_id bigint;
  v_tarefa2_id bigint;
  v_ft1_id bigint;
  v_ft2_id bigint;
  v_occ1_id bigint;
  v_occ2_id bigint;
  v_ciclo bigint;
  v_ciclo_antigo bigint;
  v_total_atual numeric;
  v_status text;
begin
  select v.id_usuario_pai, v.id
    into v_pai_id, v_vigencia_id
  from public.t_vigencia v
  where now() between v.data_inicio and v.data_fim
  order by v.id desc
  limit 1;

  if v_pai_id is null or v_vigencia_id is null then
    raise exception 'TESTE CICLO MESADA: é necessária uma vigência em andamento';
  end if;

  insert into public.t_filho (
    id_usuario_pai, nome, tem_mesada, tem_mesada_opcional, valor_mesada
  )
  values (
    v_pai_id, '__TESTE_CICLO_MESADA__', true, true, 600
  )
  returning id, mesada_ciclo_atual into v_filho_id, v_ciclo;

  if v_ciclo <> 1 then
    raise exception 'TESTE CICLO MESADA: filho novo com mesada deveria iniciar no ciclo 1; obtido %', v_ciclo;
  end if;

  insert into public.t_tarefa (id_usuario_pai, nome)
  values (v_pai_id, '__TESTE_CICLO_MESADA_1__')
  returning id into v_tarefa1_id;

  insert into public.t_filho_tarefa (
    id_usuario_pai, id_filho, id_tarefa, id_vigencia
  )
  values (
    v_pai_id, v_filho_id, v_tarefa1_id, v_vigencia_id
  )
  returning id into v_ft1_id;

  insert into public.t_ocorrencia (
    id_usuario_pai, id_filho_tarefa, tipo, created_at
  )
  values (
    v_pai_id, v_ft1_id, 'NAO_FEZ', now()
  )
  returning id into v_occ1_id;

  insert into public.t_ocorrencia_consequencia (
    id_usuario_pai, id_ocorrencia, tipo, desconto_valor, status
  )
  values (
    v_pai_id, v_occ1_id, 'DESCONTO', 500, 'APLICADO'
  )
  returning mesada_ciclo into v_ciclo_antigo;

  if v_ciclo_antigo <> 1 then
    raise exception 'TESTE CICLO MESADA: desconto inicial deveria pertencer ao ciclo 1; obtido %', v_ciclo_antigo;
  end if;

  update public.t_filho
  set
    tem_mesada = false,
    tem_mesada_opcional = null,
    valor_mesada = null
  where id = v_filho_id;

  select mesada_ciclo_atual
    into v_ciclo
  from public.t_filho
  where id = v_filho_id;

  if v_ciclo <> 1 then
    raise exception 'TESTE CICLO MESADA: retirar mesada não deveria incrementar o ciclo; obtido %', v_ciclo;
  end if;

  update public.t_filho
  set
    tem_mesada = true,
    tem_mesada_opcional = true,
    valor_mesada = 300
  where id = v_filho_id;

  select mesada_ciclo_atual
    into v_ciclo
  from public.t_filho
  where id = v_filho_id;

  if v_ciclo <> 2 then
    raise exception 'TESTE CICLO MESADA: reativar mesada deveria abrir ciclo 2; obtido %', v_ciclo;
  end if;

  select status, mesada_ciclo
    into v_status, v_ciclo_antigo
  from public.t_ocorrencia_consequencia
  where id_ocorrencia = v_occ1_id;

  if v_status <> 'APLICADO' or v_ciclo_antigo <> 1 then
    raise exception 'TESTE CICLO MESADA: desconto antigo deveria permanecer APLICADO no ciclo 1';
  end if;

  select coalesce(sum(c.desconto_valor), 0)
    into v_total_atual
  from public.t_ocorrencia_consequencia c
  where c.id_usuario_pai = v_pai_id
    and c.tipo = 'DESCONTO'
    and c.status = 'APLICADO'
    and c.mesada_ciclo = v_ciclo;

  if v_total_atual <> 0 then
    raise exception 'TESTE CICLO MESADA: novo ciclo deveria começar com desconto 0; obtido %', v_total_atual;
  end if;

  if greatest(0, 300 - v_total_atual) <> 300 then
    raise exception 'TESTE CICLO MESADA: a nova mesada deveria começar com saldo 300';
  end if;

  insert into public.t_tarefa (id_usuario_pai, nome)
  values (v_pai_id, '__TESTE_CICLO_MESADA_2__')
  returning id into v_tarefa2_id;

  insert into public.t_filho_tarefa (
    id_usuario_pai, id_filho, id_tarefa, id_vigencia
  )
  values (
    v_pai_id, v_filho_id, v_tarefa2_id, v_vigencia_id
  )
  returning id into v_ft2_id;

  insert into public.t_ocorrencia (
    id_usuario_pai, id_filho_tarefa, tipo, created_at
  )
  values (
    v_pai_id, v_ft2_id, 'NAO_FEZ', now()
  )
  returning id into v_occ2_id;

  insert into public.t_ocorrencia_consequencia (
    id_usuario_pai, id_ocorrencia, tipo, desconto_valor, status
  )
  values (
    v_pai_id, v_occ2_id, 'DESCONTO', 50, 'APLICADO'
  );

  select coalesce(sum(c.desconto_valor), 0)
    into v_total_atual
  from public.t_ocorrencia_consequencia c
  where c.id_usuario_pai = v_pai_id
    and c.tipo = 'DESCONTO'
    and c.status = 'APLICADO'
    and c.mesada_ciclo = v_ciclo;

  if v_total_atual <> 50 then
    raise exception 'TESTE CICLO MESADA: novo desconto deveria somar 50 no ciclo 2; obtido %', v_total_atual;
  end if;

  update public.t_ocorrencia_consequencia
  set desconto_valor = 550
  where id_ocorrencia = v_occ1_id;

  select mesada_ciclo
    into v_ciclo_antigo
  from public.t_ocorrencia_consequencia
  where id_ocorrencia = v_occ1_id;

  if v_ciclo_antigo <> 1 then
    raise exception 'TESTE CICLO MESADA: editar desconto antigo não pode movê-lo para o ciclo novo';
  end if;

  select coalesce(sum(c.desconto_valor), 0)
    into v_total_atual
  from public.t_ocorrencia_consequencia c
  where c.id_usuario_pai = v_pai_id
    and c.tipo = 'DESCONTO'
    and c.status = 'APLICADO'
    and c.mesada_ciclo = v_ciclo;

  if v_total_atual <> 50 then
    raise exception 'TESTE CICLO MESADA: desconto antigo editado não pode afetar ciclo 2; obtido %', v_total_atual;
  end if;
end;
$test$;

rollback;

select 'CICLO_MESADA_OK' as resultado;
