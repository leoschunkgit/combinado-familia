-- Remove o último vestígio da camada transitória de compatibilidade.
-- O modelo legado já foi excluído; o reconciliador não precisa mais sinalizar bypass algum.
do $$
declare
  v_ddl text;
begin
  select pg_get_functiondef(p.oid)
    into v_ddl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'reconciliar_ocorrencia'
  limit 1;

  if v_ddl is null then
    raise exception 'Função reconciliar_ocorrencia não encontrada';
  end if;

  v_ddl := replace(
    v_ddl,
    E'  -- Toda chamada é uma única transação PostgreSQL. Qualquer exception desfaz tudo.\n  perform set_config(''app.reconciliador_ocorrencia'', ''on'', true);\n',
    E'  -- Toda chamada é uma única transação PostgreSQL. Qualquer exception desfaz tudo.\n'
  );

  execute v_ddl;
end;
$$;
