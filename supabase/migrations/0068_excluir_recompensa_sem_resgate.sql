-- Permite excluir recompensa apenas quando nunca houve resgate.
-- O backend protege o histórico: qualquer resgate, inclusive cancelado, bloqueia a exclusão.

create or replace function public.excluir_recompensa_estrelas(p_id_recompensa bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pai_id bigint;
  v_count integer;
begin
  select p.id
    into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  if not exists (
    select 1
    from public.t_recompensa_estrela r
    where r.id = p_id_recompensa
      and r.id_usuario_pai = v_pai_id
  ) then
    raise exception 'Recompensa não encontrada';
  end if;

  if exists (
    select 1
    from public.t_recompensa_resgate rr
    where rr.id_recompensa = p_id_recompensa
      and rr.id_usuario_pai = v_pai_id
  ) then
    raise exception 'Esta recompensa já possui histórico de resgate e não pode ser excluída';
  end if;

  delete from public.t_recompensa_estrela
  where id = p_id_recompensa
    and id_usuario_pai = v_pai_id;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$function$;

revoke all on function public.excluir_recompensa_estrelas(bigint)
from public, anon, authenticated, service_role;

grant execute on function public.excluir_recompensa_estrelas(bigint)
to authenticated;
