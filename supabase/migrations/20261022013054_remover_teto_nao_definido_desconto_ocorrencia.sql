
do $$
declare
  v_ddl text;
  v_novo text;
begin
  select pg_get_functiondef(p.oid)
    into v_ddl
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='reconciliar_ocorrencia'
  limit 1;

  v_novo := regexp_replace(
    v_ddl,
    E'\\n[[:space:]]*if v_desconto_efetivo > v_valor_mesada then\\n[[:space:]]*raise exception ''O desconto desta ocorrência não pode ser maior que a mesada cadastrada'';\\n[[:space:]]*end if;',
    E'',
    'g'
  );

  if v_novo = v_ddl then
    raise exception 'Trecho de teto do desconto não localizado';
  end if;

  execute v_novo;
end;
$$;
