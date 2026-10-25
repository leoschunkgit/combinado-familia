create or replace function public.validar_vigencia_atribuicao_interno()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_data_fim timestamptz;
begin
  select v.data_fim
    into v_data_fim
  from public.t_vigencia v
  where v.id = new.id_vigencia
    and v.id_usuario_pai = new.id_usuario_pai
  for share;

  if not found then
    raise exception 'Vigência não encontrada para esta atribuição';
  end if;

  if now() > v_data_fim then
    raise exception 'Não é possível criar ou alterar atribuições de uma vigência finalizada';
  end if;

  return new;
end;
$function$;

revoke all on function public.validar_vigencia_atribuicao_interno()
  from public, anon, authenticated, service_role;

drop trigger if exists validar_vigencia_atribuicao_before_change
  on public.t_filho_tarefa;

create trigger validar_vigencia_atribuicao_before_change
before insert or update of id_usuario_pai, id_filho, id_tarefa, id_vigencia
on public.t_filho_tarefa
for each row
execute function public.validar_vigencia_atribuicao_interno();


create or replace function public.guard_validity_history()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1 from public.t_usuario_pai p where p.id = old.id_usuario_pai
    )
    and exists (
      select 1 from public.t_filho_tarefa ft where ft.id_vigencia = old.id
    ) then
      raise exception 'Vigência com atribuições não pode ser excluída';
    end if;
    return old;
  end if;

  if now() > old.data_fim
     and (
       new.data_inicio is distinct from old.data_inicio
       or new.data_fim is distinct from old.data_fim
     ) then
    raise exception 'Vigências finalizadas não podem ser editadas';
  end if;

  if new.data_fim <= new.data_inicio then
    raise exception 'A data/hora fim deve ser posterior à data/hora início';
  end if;

  if (
       new.data_inicio is distinct from old.data_inicio
       or new.data_fim is distinct from old.data_fim
     )
     and exists (
       select 1
       from public.t_ocorrencia o
       join public.t_filho_tarefa ft on ft.id = o.id_filho_tarefa
       where ft.id_vigencia = old.id
         and (
           timezone('America/Sao_Paulo', o.created_at)::date
             < timezone('America/Sao_Paulo', new.data_inicio)::date
           or timezone('America/Sao_Paulo', o.created_at)::date
             > timezone('America/Sao_Paulo', new.data_fim)::date
         )
     ) then
    raise exception 'Há resultados fora do novo período da vigência';
  end if;

  if (
       new.data_inicio is distinct from old.data_inicio
       or new.data_fim is distinct from old.data_fim
     )
     and exists (
       select 1
       from public.t_solicitacao_tarefa_filho s
       join public.t_filho_tarefa ft on ft.id = s.id_filho_tarefa
       where ft.id_vigencia = old.id
         and (
           s.data_referencia < timezone('America/Sao_Paulo', new.data_inicio)::date
           or s.data_referencia > timezone('America/Sao_Paulo', new.data_fim)::date
         )
     ) then
    raise exception 'Há avisos do filho fora do novo período da vigência';
  end if;

  return new;
end;
$function$;
