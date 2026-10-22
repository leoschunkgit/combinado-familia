create or replace function public.desfazer_ocorrencias(
  p_ids bigint[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_resultados jsonb := '[]'::jsonb;
begin
  if p_ids is null or coalesce(array_length(p_ids,1),0)=0 then
    raise exception 'Informe ao menos uma ocorrência';
  end if;

  if exists (
    select 1
    from unnest(p_ids) x(id)
    left join public.t_ocorrencia o
      on o.id=x.id
     and o.id_usuario_pai=public.current_pai_id()
    where o.id is null
  ) then
    raise exception 'Uma ou mais ocorrências não pertencem ao responsável';
  end if;

  foreach v_id in array p_ids
  loop
    v_resultados := v_resultados || jsonb_build_array(
      public.reconciliar_ocorrencia(
        'DESFAZER',
        v_id,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        'Desfazer marcação'
      )
    );
  end loop;

  return jsonb_build_object(
    'ok',true,
    'quantidade',array_length(p_ids,1),
    'resultados',v_resultados
  );
end;
$$;

revoke all on function public.desfazer_ocorrencias(bigint[]) from public;
grant execute on function public.desfazer_ocorrencias(bigint[]) to authenticated;

comment on function public.desfazer_ocorrencias(bigint[]) is
'Desfaz uma ou várias ocorrências em uma única transação, delegando cada item ao reconciliador central.';
