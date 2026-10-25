
create or replace function public.guard_occurrence_active_validity()
returns trigger
language plpgsql
set search_path = 'public'
as $$
declare
  v_assignment_id bigint;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_ocorrencia timestamptz;
  v_hoje date;
  v_resolucao_revisao boolean;
begin
  -- Cascades de FK executam dentro de triggers encadeados.
  -- Não bloquear limpeza dependente quando filho/tarefa/atribuição/conta é removido.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  v_assignment_id := case
    when tg_op = 'DELETE' then old.id_filho_tarefa
    else new.id_filho_tarefa
  end;

  v_ocorrencia := case
    when tg_op = 'DELETE' then old.created_at
    else new.created_at
  end;

  select v.data_inicio, v.data_fim
    into v_inicio, v_fim
  from public.t_filho_tarefa ft
  join public.t_vigencia v on v.id = ft.id_vigencia
  where ft.id = v_assignment_id;

  if v_inicio is null or v_fim is null then
    raise exception 'Vigência da atribuição não encontrada';
  end if;

  v_resolucao_revisao :=
    tg_op = 'UPDATE'
    and current_setting('app.resolucao_revisao_ocorrencia', true) = 'on';

  -- Uma revisão pedida durante a vigência pode ser decidida depois do fim.
  -- Esta exceção só é habilitada pelo reconciliador depois de validar a revisão exata.
  if not v_resolucao_revisao
     and (now() < v_inicio or now() > v_fim) then
    raise exception 'Fez/Não fez só pode ser alterado em vigência em andamento';
  end if;

  if tg_op <> 'DELETE' then
    v_hoje := (now() at time zone 'America/Sao_Paulo')::date;

    if (v_ocorrencia at time zone 'America/Sao_Paulo')::date
         < (v_inicio at time zone 'America/Sao_Paulo')::date
       or (v_ocorrencia at time zone 'America/Sao_Paulo')::date
         > (v_fim at time zone 'America/Sao_Paulo')::date then
      raise exception 'A data do Fez/Não fez deve estar dentro da vigência';
    end if;

    if (v_ocorrencia at time zone 'America/Sao_Paulo')::date > v_hoje then
      raise exception 'Não é permitido registrar Fez/Não fez em data futura';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare
  v_ddl text;
  v_lock_marker text;
  v_lock text;
  v_revision_marker text;
  v_revision_context text;
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

  -- Não permita uma edição paralela do mesmo NAO_FEZ enquanto existe revisão pendente.
  v_lock_marker := E'  -- Penalidade cumprida é fato histórico e não pode ser apagada ou reescrita.\n';
  v_lock :=
    E'  if v_id_ocorrencia is not null\n'
    || E'     and v_acao = ''SALVAR''\n'
    || E'     and upper(btrim(coalesce(p_novo_tipo, ''''))) = ''NAO_FEZ''\n'
    || E'     and exists (\n'
    || E'       select 1\n'
    || E'       from public.t_revisao_tarefa_filho r\n'
    || E'       where r.id_ocorrencia = v_id_ocorrencia\n'
    || E'         and r.status = ''PENDENTE''\n'
    || E'     ) then\n'
    || E'    raise exception ''Esta ocorrência possui revisão pendente. Resolva a revisão antes de alterar o Não fez'';\n'
    || E'  end if;\n\n';

  if position(v_lock in v_ddl)=0 then
    if position(v_lock_marker in v_ddl)=0 then
      raise exception 'Ponto de proteção da revisão pendente não localizado';
    end if;
    v_ddl := replace(v_ddl, v_lock_marker, v_lock || v_lock_marker);
  end if;

  -- Depois de validar id da revisão + ocorrência + atribuição + data + status,
  -- habilita somente nesta transação a exceção para resolver revisão após o fim.
  v_revision_marker :=
    E'      if v_tipo_anterior <> ''NAO_FEZ'' then\n'
    || E'        raise exception ''A revisão não pertence mais a um Não fez'';\n'
    || E'      end if;\n';

  v_revision_context :=
    v_revision_marker
    || E'\n      perform set_config(''app.resolucao_revisao_ocorrencia'', ''on'', true);\n';

  if position(E'perform set_config(''app.resolucao_revisao_ocorrencia''' in v_ddl)=0 then
    if position(v_revision_marker in v_ddl)=0 then
      raise exception 'Ponto de validação da revisão exata não localizado';
    end if;
    v_ddl := replace(v_ddl, v_revision_marker, v_revision_context);
  end if;

  execute v_ddl;
end;
$$;
