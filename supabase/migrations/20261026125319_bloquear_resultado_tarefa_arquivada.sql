create or replace function public.bloquear_resultado_tarefa_inativa_interno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_ativa boolean;
begin
  select t.ativo
    into v_ativa
  from public.t_filho_tarefa ft
  join public.t_tarefa t
    on t.id = ft.id_tarefa
   and t.id_usuario_pai = ft.id_usuario_pai
  where ft.id = new.id_filho_tarefa
    and ft.id_usuario_pai = new.id_usuario_pai;

  if v_ativa is distinct from true then
    raise exception 'Tarefa excluída está disponível somente como histórico';
  end if;

  return new;
end;
$function$;

revoke all on function public.bloquear_resultado_tarefa_inativa_interno()
from public, anon, authenticated, service_role;

drop trigger if exists bloquear_resultado_tarefa_inativa_before_change
on public.t_ocorrencia;

create trigger bloquear_resultado_tarefa_inativa_before_change
before insert or update of id_filho_tarefa, tipo, created_at
on public.t_ocorrencia
for each row
execute function public.bloquear_resultado_tarefa_inativa_interno();

comment on function public.bloquear_resultado_tarefa_inativa_interno() is
'Impede novas marcações e alterações de resultado em atribuições cuja tarefa foi arquivada; o registro antigo permanece somente como histórico.';
