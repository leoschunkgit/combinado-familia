do $$
declare
  v_ddl text;
  v_reset text;
  v_marker text;
  v_replacement text;
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

  v_reset :=
    E'    if v_acao = ''RESOLVER_REVISAO'' then\n'
    || E'      perform set_config(''app.resolucao_revisao_ocorrencia'', ''off'', true);\n'
    || E'    end if;\n\n';

  v_ddl := replace(v_ddl, v_reset, '');

  v_marker :=
    E'      where id = v_id_ocorrencia\n'
    || E'        and id_usuario_pai = v_pai_id;\n'
    || E'    end if;\n\n'
    || E'    if v_novo_tipo = ''FEZ'' then\n'
    || E'      update public.t_ocorrencia_consequencia';

  v_replacement :=
    E'      where id = v_id_ocorrencia\n'
    || E'        and id_usuario_pai = v_pai_id;\n'
    || E'    end if;\n\n'
    || v_reset
    || E'    if v_novo_tipo = ''FEZ'' then\n'
    || E'      update public.t_ocorrencia_consequencia';

  if position(v_marker in v_ddl)=0 then
    raise exception 'Ponto correto de reset após update da ocorrência não localizado';
  end if;

  execute replace(v_ddl, v_marker, v_replacement);
end;
$$;
