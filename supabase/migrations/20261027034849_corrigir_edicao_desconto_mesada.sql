create or replace function public.validar_desconto_mesada_vigencia_interno()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_id_filho bigint;
  v_id_vigencia bigint;
  v_mesada_ativa boolean;
  v_valor_mesada numeric;
  v_total_outros numeric;
  v_ignorar_id bigint;
begin
  if new.tipo is distinct from 'DESCONTO'
     or new.status is distinct from 'APLICADO' then
    return new;
  end if;

  select
    ft.id_filho,
    ft.id_vigencia,
    coalesce(f.tem_mesada, false) and f.valor_mesada is not null,
    f.valor_mesada
  into
    v_id_filho,
    v_id_vigencia,
    v_mesada_ativa,
    v_valor_mesada
  from public.t_ocorrencia o
  join public.t_filho_tarefa ft
    on ft.id = o.id_filho_tarefa
   and ft.id_usuario_pai = o.id_usuario_pai
  join public.t_filho f
    on f.id = ft.id_filho
   and f.id_usuario_pai = ft.id_usuario_pai
  where o.id = new.id_ocorrencia
    and o.id_usuario_pai = new.id_usuario_pai;

  if not found then
    raise exception 'Não foi possível identificar o filho e a vigência da consequência';
  end if;

  if not v_mesada_ativa then
    raise exception 'Desconto de mesada só pode ser aplicado a filho com mesada cadastrada';
  end if;

  if new.desconto_valor is null or new.desconto_valor <= 0 then
    raise exception 'Informe um valor de desconto válido';
  end if;

  if tg_op = 'UPDATE' then
    v_ignorar_id := old.id;
  else
    select c.id
      into v_ignorar_id
    from public.t_ocorrencia_consequencia c
    where c.id_usuario_pai = new.id_usuario_pai
      and c.id_ocorrencia = new.id_ocorrencia
    limit 1;
  end if;

  v_total_outros :=
    public.total_descontos_aplicados_filho_vigencia_interno(
      new.id_usuario_pai,
      v_id_filho,
      v_id_vigencia,
      v_ignorar_id
    );

  if v_total_outros + new.desconto_valor > v_valor_mesada then
    raise exception
      'O total de descontos aplicados na vigência não pode ultrapassar a mesada atual (R$ %).',
      trim(to_char(v_valor_mesada, 'FM9999999990D00'));
  end if;

  return new;
end;
$function$;

comment on function public.validar_desconto_mesada_vigencia_interno() is
'Valida descontos de mesada por vigência. Em edição/upsert ignora a consequência da mesma ocorrência; em criação considera todos os descontos já aplicados.';
