
create or replace function public.motivo_bloqueio_desfazer_ocorrencia_interno(
  p_id_usuario_pai bigint,
  p_id_ocorrencia bigint
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1
      from public.t_ocorrencia_consequencia c
      where c.id_usuario_pai = p_id_usuario_pai
        and c.id_ocorrencia = p_id_ocorrencia
        and c.tipo = 'PENALIDADE'
        and c.status = 'CUMPRIDA'
    )
    then 'PENALIDADE_CUMPRIDA'
    else null
  end;
$$;

revoke all on function public.motivo_bloqueio_desfazer_ocorrencia_interno(bigint,bigint)
  from public, anon, authenticated, service_role;

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
    and p.proname='reconciliar_ocorrencia'
  order by p.oid desc
  limit 1;

  if v_ddl is null then
    raise exception 'reconciliar_ocorrencia não encontrado';
  end if;

  v_old :=
    E'  if v_id_ocorrencia is not null\n'
    || E'     and v_conseq_anterior->>''tipo'' = ''PENALIDADE''\n'
    || E'     and v_conseq_anterior->>''status'' = ''CUMPRIDA'' then\n'
    || E'    if v_acao = ''DESFAZER'' then\n'
    || E'      raise exception ''Uma penalidade já cumprida faz parte do histórico e não pode ser desfeita. Se a marcação estiver errada, altere para Fez'';\n'
    || E'    end if;\n\n'
    || E'    if v_acao in (''SALVAR'',''RESOLVER_REVISAO'')\n';

  v_new :=
    E'  if v_id_ocorrencia is not null\n'
    || E'     and v_acao = ''DESFAZER''\n'
    || E'     and public.motivo_bloqueio_desfazer_ocorrencia_interno(v_pai_id, v_id_ocorrencia) = ''PENALIDADE_CUMPRIDA'' then\n'
    || E'    raise exception ''Uma penalidade já cumprida faz parte do histórico e não pode ser desfeita. Se a marcação estiver errada, altere para Fez'';\n'
    || E'  end if;\n\n'
    || E'  if v_id_ocorrencia is not null\n'
    || E'     and v_conseq_anterior->>''tipo'' = ''PENALIDADE''\n'
    || E'     and v_conseq_anterior->>''status'' = ''CUMPRIDA'' then\n'
    || E'    if v_acao in (''SALVAR'',''RESOLVER_REVISAO'')\n';

  if position(v_old in v_ddl)=0 then
    raise exception 'Trecho histórico de desfazer não localizado no reconciliador';
  end if;

  execute replace(v_ddl,v_old,v_new);
end;
$$;

create or replace function public.desfazer_ocorrencias(p_ids bigint[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pai_id bigint;
  v_ids bigint[];
  v_id bigint;
  v_resultados jsonb := '[]'::jsonb;
  v_ids_desfeitos bigint[] := '{}';
  v_ids_preservados bigint[] := '{}';
begin
  v_pai_id := public.current_pai_id();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  select array_agg(distinct x.id order by x.id)
    into v_ids
  from unnest(p_ids) x(id)
  where x.id is not null;

  if v_ids is null or coalesce(array_length(v_ids,1),0)=0 then
    raise exception 'Informe ao menos uma ocorrência';
  end if;

  if exists (
    select 1
    from unnest(v_ids) x(id)
    left join public.t_ocorrencia o
      on o.id=x.id
     and o.id_usuario_pai=v_pai_id
    where o.id is null
  ) then
    raise exception 'Uma ou mais ocorrências não pertencem ao responsável';
  end if;

  foreach v_id in array v_ids
  loop
    if public.motivo_bloqueio_desfazer_ocorrencia_interno(v_pai_id,v_id)
       = 'PENALIDADE_CUMPRIDA' then
      v_ids_preservados := array_append(v_ids_preservados,v_id);
      continue;
    end if;

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

    v_ids_desfeitos := array_append(v_ids_desfeitos,v_id);
  end loop;

  return jsonb_build_object(
    'ok',true,
    'quantidade_solicitada',coalesce(array_length(v_ids,1),0),
    'quantidade_desfeita',coalesce(array_length(v_ids_desfeitos,1),0),
    'quantidade_preservada',coalesce(array_length(v_ids_preservados,1),0),
    'ids_desfeitos',to_jsonb(v_ids_desfeitos),
    'ids_preservados',to_jsonb(v_ids_preservados),
    'resultados',v_resultados
  );
end;
$$;

revoke all on function public.desfazer_ocorrencias(bigint[])
  from public, anon, authenticated, service_role;
grant execute on function public.desfazer_ocorrencias(bigint[])
  to authenticated;
