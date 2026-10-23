-- Permite limpeza estrutural em cascata ao excluir um filho/responsável.
-- A regra de bloqueio continua valendo para exclusão direta da recompensa.

create or replace function public.proteger_exclusao_recompensa_com_pendencia()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  -- Exclusões disparadas por cascata de FK (ex.: exclusão do filho ou do responsável)
  -- são limpeza estrutural e não devem ser tratadas como exclusão manual da recompensa.
  if pg_trigger_depth() > 1 then
    return old;
  end if;

  if exists (
    select 1
    from public.t_recompensa_resgate rr
    where rr.id_recompensa = old.id
      and rr.id_usuario_pai = old.id_usuario_pai
      and rr.id_filho = old.id_filho
      and rr.status = 'PENDENTE'
  ) then
    raise exception 'Esta recompensa está conquistada e aguardando confirmação; conclua o ciclo antes de excluir';
  end if;

  return old;
end;
$function$;
