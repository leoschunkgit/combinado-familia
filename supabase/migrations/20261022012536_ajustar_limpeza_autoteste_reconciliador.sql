
do $$
declare
  v_ddl text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(p.oid)
    into v_ddl
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='autoteste_reconciliador_ocorrencia'
  limit 1;

  v_old := $patch$
  delete from public.t_ocorrencia_reconciliacao
  where id_usuario_pai=v_pai
    and id_filho_tarefa = any(v_assignments);

  delete from public.t_filho
  where id in (v_filho_mesada,v_filho_sem_mesada)
    and id_usuario_pai=v_pai;
$patch$;

  v_new := $patch$
  delete from public.t_ocorrencia_reconciliacao
  where id_usuario_pai=v_pai
    and id_filho_tarefa = any(v_assignments);

  -- Remove primeiro os ciclos temporários; a proteção de recompensa
  -- corretamente impede excluir uma recompensa com ciclo PENDENTE.
  delete from public.t_recompensa_resgate
  where id_usuario_pai=v_pai
    and id_filho in (v_filho_mesada,v_filho_sem_mesada);

  delete from public.t_filho
  where id in (v_filho_mesada,v_filho_sem_mesada)
    and id_usuario_pai=v_pai;
$patch$;

  if position(v_old in v_ddl)=0 then
    raise exception 'Trecho de limpeza do autoteste não localizado';
  end if;

  execute replace(v_ddl,v_old,v_new);
end;
$$;
