create or replace function public.atribuir_tarefas_vigencia_automatica_lote(
  p_atribuicoes jsonb
)
returns table(
  id_vigencia bigint,
  vigencia_criada boolean,
  quantidade integer,
  repetidas integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pai_id bigint;
  v_vigencia_id bigint;
  v_vigencia_criada boolean;
  v_recebidas integer;
  v_unicas integer;
  v_inseridas integer;
begin
  if not private.vigencia_automatica_ativa() then
    raise exception 'Vigência automática está desativada';
  end if;

  v_pai_id := public.current_pai_id();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  if p_atribuicoes is null
     or jsonb_typeof(p_atribuicoes) <> 'array'
     or jsonb_array_length(p_atribuicoes) = 0 then
    raise exception 'Adicione ao menos uma atribuição';
  end if;

  v_recebidas := jsonb_array_length(p_atribuicoes);

  if v_recebidas > 500 then
    raise exception 'Limite de 500 atribuições por operação excedido';
  end if;

  with entrada as (
    select distinct
      x.id_filho,
      x.id_tarefa
    from jsonb_to_recordset(p_atribuicoes)
      as x(id_filho bigint, id_tarefa bigint)
  )
  select count(*)::integer
    into v_unicas
  from entrada;

  if exists (
    with entrada as (
      select distinct
        x.id_filho,
        x.id_tarefa
      from jsonb_to_recordset(p_atribuicoes)
        as x(id_filho bigint, id_tarefa bigint)
    )
    select 1
    from entrada e
    left join public.t_filho f
      on f.id = e.id_filho
     and f.id_usuario_pai = v_pai_id
    left join public.t_tarefa t
      on t.id = e.id_tarefa
     and t.id_usuario_pai = v_pai_id
     and t.ativo = true
    where e.id_filho is null
       or e.id_tarefa is null
       or f.id is null
       or t.id is null
  ) then
    raise exception 'Filho ou tarefa não encontrado, ou tarefa arquivada';
  end if;

  select g.id_vigencia, g.vigencia_criada
    into v_vigencia_id, v_vigencia_criada
  from private.vigencia_automatica_garantir_interno(
    v_pai_id,
    statement_timestamp()
  ) g;

  with entrada as (
    select distinct
      x.id_filho,
      x.id_tarefa
    from jsonb_to_recordset(p_atribuicoes)
      as x(id_filho bigint, id_tarefa bigint)
  )
  insert into public.t_filho_tarefa (
    id_usuario_pai,
    id_filho,
    id_tarefa,
    id_vigencia
  )
  select
    v_pai_id,
    e.id_filho,
    e.id_tarefa,
    v_vigencia_id
  from entrada e
  on conflict on constraint
    t_filho_tarefa_id_filho_id_tarefa_id_vigencia_key
  do nothing;

  get diagnostics v_inseridas = row_count;

  return query
  select
    v_vigencia_id,
    v_vigencia_criada,
    v_inseridas,
    greatest(v_recebidas - v_inseridas, 0);
end;
$$;

revoke execute on function public.atribuir_tarefas_vigencia_automatica_lote(jsonb)
  from public, anon;
grant execute on function public.atribuir_tarefas_vigencia_automatica_lote(jsonb)
  to authenticated;
