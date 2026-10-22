do $$
declare
  v_ddl text;
  v_marker text;
  v_guard text;
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

  v_marker := E'  if v_acao = ''CUMPRIR_PENALIDADE'' then\n';

  v_guard := E'  -- Penalidade cumprida é fato histórico e não pode ser apagada ou reescrita.\n'
    || E'  -- Se a marcação estiver errada, a ocorrência pode ser corrigida para FEZ,\n'
    || E'  -- preservando a penalidade já cumprida no histórico.\n'
    || E'  if v_id_ocorrencia is not null\n'
    || E'     and v_conseq_anterior->>''tipo'' = ''PENALIDADE''\n'
    || E'     and v_conseq_anterior->>''status'' = ''CUMPRIDA'' then\n'
    || E'    if v_acao = ''DESFAZER'' then\n'
    || E'      raise exception ''Uma penalidade já cumprida faz parte do histórico e não pode ser desfeita. Se a marcação estiver errada, altere para Fez'';\n'
    || E'    end if;\n\n'
    || E'    if v_acao in (''SALVAR'',''RESOLVER_REVISAO'')\n'
    || E'       and upper(btrim(coalesce(p_novo_tipo, ''''))) = ''NAO_FEZ''\n'
    || E'       and p_consequencia_tipo is not null then\n'
    || E'      raise exception ''Uma penalidade já cumprida não pode ter sua consequência alterada'';\n'
    || E'    end if;\n'
    || E'  end if;\n\n';

  if position(v_guard in v_ddl) > 0 then
    return;
  end if;

  if position(v_marker in v_ddl) = 0 then
    raise exception 'Ponto de inserção do reconciliador não localizado';
  end if;

  execute replace(v_ddl, v_marker, v_guard || v_marker);
end;
$$;
