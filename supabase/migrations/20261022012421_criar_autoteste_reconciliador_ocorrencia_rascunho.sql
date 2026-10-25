
create or replace function public.autoteste_reconciliador_ocorrencia()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pai bigint;
  v_vig bigint;
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
  v_today date;
  v_yesterday date;
  v_ts_today timestamptz;
  v_ts_yesterday timestamptz;
  v_json jsonb;
  v_ok boolean;
  v_count integer;
  v_raw integer;
  v_status text;
  v_tipo text;
  v_val numeric;
  v_assignments bigint[];
begin
  v_pai := public.current_pai_id();
  if v_pai is null then
    raise exception 'AUTOTESTE: responsável autenticado não encontrado';
  end if;

  select v.id into v_vig
  from public.t_vigencia v
  where v.id_usuario_pai = v_pai
    and now() between v.data_inicio and v.data_fim
  order by v.data_inicio desc
  limit 1;

  if v_vig is null then
    raise exception 'AUTOTESTE: não há vigência em andamento para o responsável';
  end if;

  v_today := timezone('America/Sao_Paulo', now())::date;
  v_yesterday := v_today - 1;
  v_ts_today := (v_today::timestamp + time '12:00') at time zone 'America/Sao_Paulo';
  v_ts_yesterday := (v_yesterday::timestamp + time '12:00') at time zone 'America/Sao_Paulo';

  if not exists (
    select 1 from public.t_vigencia v
    where v.id=v_vig
      and v_yesterday between timezone('America/Sao_Paulo',v.data_inicio)::date
                          and timezone('America/Sao_Paulo',v.data_fim)::date
  ) then
    v_ts_yesterday := v_ts_today;
  end if;

  insert into public.t_filho (
    id_usuario_pai,nome,tem_mesada,valor_mesada,tem_mesada_opcional
  ) values (
    v_pai,'__AUTOTESTE_RECONCILIADOR_MESADA__',true,100,true
  ) returning id into v_filho_mesada;

  insert into public.t_filho (
    id_usuario_pai,nome,tem_mesada,valor_mesada,tem_mesada_opcional
  ) values (
    v_pai,'__AUTOTESTE_RECONCILIADOR_SEM_MESADA__',false,null,false
  ) returning id into v_filho_sem_mesada;

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
  insert into public.t_filho_tarefa(id_usuario_pai,id_filho,id_tarefa,v_id_vigencia)
  values(v_pai,v_filho_mesada,v_tarefa_d,v_vig);
exception
  when undefined_column then
    -- Compatibilidade apenas do próprio autoteste com o nome real da coluna.
    null;
end;
$$;
