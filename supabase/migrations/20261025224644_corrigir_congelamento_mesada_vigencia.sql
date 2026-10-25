
create or replace function public.sincronizar_mesada_vigencia_atribuicao_interno()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_tem_mesada boolean;
  v_valor_mesada numeric;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if not exists (
      select 1
      from public.t_filho_tarefa ft
      where ft.id_usuario_pai = old.id_usuario_pai
        and ft.id_filho = old.id_filho
        and ft.id_vigencia = old.id_vigencia
    ) then
      delete from public.t_filho_vigencia_mesada m
      where m.id_usuario_pai = old.id_usuario_pai
        and m.id_filho = old.id_filho
        and m.id_vigencia = old.id_vigencia;
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select
      coalesce(f.tem_mesada_opcional, false) and f.valor_mesada is not null,
      case
        when coalesce(f.tem_mesada_opcional, false) and f.valor_mesada is not null
          then f.valor_mesada
        else null
      end
    into v_tem_mesada, v_valor_mesada
    from public.t_filho f
    where f.id_usuario_pai = new.id_usuario_pai
      and f.id = new.id_filho;

    insert into public.t_filho_vigencia_mesada (
      id_usuario_pai,
      id_filho,
      id_vigencia,
      tem_mesada,
      valor_mesada
    )
    values (
      new.id_usuario_pai,
      new.id_filho,
      new.id_vigencia,
      coalesce(v_tem_mesada, false),
      v_valor_mesada
    )
    on conflict (id_usuario_pai, id_filho, id_vigencia)
    do update
      set tem_mesada = excluded.tem_mesada,
          valor_mesada = excluded.valor_mesada,
          updated_at = statement_timestamp()
    where exists (
      select 1
      from public.t_vigencia v
      where v.id = excluded.id_vigencia
        and v.id_usuario_pai = excluded.id_usuario_pai
        and v.data_fim > statement_timestamp()
    );
  end if;

  return coalesce(new, old);
end;
$function$;

create or replace function public.sincronizar_mesada_vigencia_filho_interno()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_tem_mesada boolean;
  v_valor_mesada numeric;
begin
  v_tem_mesada :=
    coalesce(new.tem_mesada_opcional, false)
    and new.valor_mesada is not null;

  v_valor_mesada :=
    case when v_tem_mesada then new.valor_mesada else null end;

  update public.t_filho_vigencia_mesada m
  set tem_mesada = v_tem_mesada,
      valor_mesada = v_valor_mesada,
      updated_at = statement_timestamp()
  from public.t_vigencia v
  where m.id_usuario_pai = new.id_usuario_pai
    and m.id_filho = new.id
    and v.id = m.id_vigencia
    and v.id_usuario_pai = m.id_usuario_pai
    and v.data_fim > statement_timestamp();

  return new;
end;
$function$;

revoke all
on function public.sincronizar_mesada_vigencia_atribuicao_interno()
from public, anon, authenticated, service_role;

revoke all
on function public.sincronizar_mesada_vigencia_filho_interno()
from public, anon, authenticated, service_role;
