do $$
declare
  v_ddl text;
  v_marker text;
  v_reset text;
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

  v_marker := E'    if v_novo_tipo = ''FEZ'' then\n';
  v_reset :=
    E'    if v_acao = ''RESOLVER_REVISAO'' then\n'
    || E'      perform set_config(''app.resolucao_revisao_ocorrencia'', ''off'', true);\n'
    || E'    end if;\n\n';

  if position(v_reset in v_ddl) > 0 then
    return;
  end if;

  if position(v_marker in v_ddl) = 0 then
    raise exception 'Ponto de reset da resolução de revisão não localizado';
  end if;

  execute replace(v_ddl, v_marker, v_reset || v_marker);
end;
$$;
