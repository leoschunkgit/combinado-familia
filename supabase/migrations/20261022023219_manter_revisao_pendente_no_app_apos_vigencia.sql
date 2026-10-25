
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
    and p.proname='montar_painel_app_filho'
  order by p.oid desc
  limit 1;

  if v_ddl is null then
    raise exception 'montar_painel_app_filho não encontrado';
  end if;

  v_old :=
    E'  where ft.id_usuario_pai = p_id_usuario_pai\n'
    || E'    and ft.id_filho = p_id_filho\n'
    || E'    and now() between v.data_inicio and v.data_fim;\n\n'
    || E'  return v_painel || jsonb_build_object(';

  v_new :=
    E'  where ft.id_usuario_pai = p_id_usuario_pai\n'
    || E'    and ft.id_filho = p_id_filho\n'
    || E'    and (\n'
    || E'      now() between v.data_inicio and v.data_fim\n'
    || E'      or r.status = ''PENDENTE''\n'
    || E'    );\n\n'
    || E'  return v_painel || jsonb_build_object(';

  if position(v_new in v_ddl) > 0 then
    return;
  end if;

  if position(v_old in v_ddl) = 0 then
    raise exception 'Trecho de revisões do painel do filho não localizado';
  end if;

  execute replace(v_ddl, v_old, v_new);
end;
$$;
