
do $$
declare
  v_ddl text;
  v_old text;
  v_new text;
  v_branch text;
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
    E'  select p.id\n'
    || E'    into v_pai_id\n'
    || E'  from public.t_usuario_pai p\n'
    || E'  where p.auth_user_id = auth.uid();\n\n'
    || E'  if v_pai_id is null then\n'
    || E'    raise exception ''Responsável não encontrado'';\n'
    || E'  end if;\n\n'
    || E'  v_acao := upper(btrim(coalesce(p_acao, '''')));\n'
    || E'  if v_acao not in (''SALVAR'',''DESFAZER'',''CUMPRIR_PENALIDADE'',''RESOLVER_REVISAO'') then\n'
    || E'    raise exception ''Ação de reconciliação inválida'';\n'
    || E'  end if;\n';

  v_new :=
    E'  v_acao := upper(btrim(coalesce(p_acao, '''')));\n'
    || E'  if v_acao not in (''SALVAR'',''DESFAZER'',''CUMPRIR_PENALIDADE'',''SOLICITAR_REVISAO'',''RESOLVER_REVISAO'') then\n'
    || E'    raise exception ''Ação de reconciliação inválida'';\n'
    || E'  end if;\n\n'
    || E'  select p.id\n'
    || E'    into v_pai_id\n'
    || E'  from public.t_usuario_pai p\n'
    || E'  where p.auth_user_id = auth.uid();\n\n'
    || E'  if v_pai_id is null and v_acao = ''SOLICITAR_REVISAO'' then\n'
    || E'    begin\n'
    || E'      v_pai_id := nullif(current_setting(''app.revisao_filho_pai_id'', true), '''')::bigint;\n'
    || E'    exception when invalid_text_representation then\n'
    || E'      v_pai_id := null;\n'
    || E'    end;\n'
    || E'  end if;\n\n'
    || E'  if v_pai_id is null then\n'
    || E'    raise exception ''Responsável não encontrado'';\n'
    || E'  end if;\n';

  if position(v_old in v_ddl)=0 then
    raise exception 'Bloco inicial do reconciliador não localizado';
  end if;
  v_ddl := replace(v_ddl,v_old,v_new);

  v_branch :=
    E'  if v_acao = ''SOLICITAR_REVISAO'' then\n'
    || E'    if p_id_revisao is null or v_id_ocorrencia is null then\n'
    || E'      raise exception ''Informe a revisão e a ocorrência'';\n'
    || E'    end if;\n\n'
    || E'    select r.status, r.id_ocorrencia, r.id_filho_tarefa, r.data_referencia\n'
    || E'      into v_revisao_status, v_revisao_occ, v_revisao_ft, v_revisao_data\n'
    || E'    from public.t_revisao_tarefa_filho r\n'
    || E'    join public.t_filho_tarefa ft\n'
    || E'      on ft.id = r.id_filho_tarefa\n'
    || E'     and ft.id_usuario_pai = v_pai_id\n'
    || E'    where r.id = p_id_revisao\n'
    || E'    for update of r;\n\n'
    || E'    if v_revisao_status is null then\n'
    || E'      raise exception ''Revisão não encontrada'';\n'
    || E'    end if;\n'
    || E'    if v_revisao_status <> ''PENDENTE'' then\n'
    || E'      raise exception ''Esta revisão já foi encerrada'';\n'
    || E'    end if;\n'
    || E'    if v_revisao_occ <> v_id_ocorrencia\n'
    || E'       or v_revisao_ft <> v_id_filho_tarefa\n'
    || E'       or v_revisao_data <> v_data then\n'
    || E'      raise exception ''A revisão não pertence a esta ocorrência'';\n'
    || E'    end if;\n'
    || E'    if v_tipo_anterior <> ''NAO_FEZ'' then\n'
    || E'      raise exception ''A revisão só pode ser solicitada para um Não fez'';\n'
    || E'    end if;\n\n'
    || E'    update public.t_ocorrencia_consequencia\n'
    || E'    set status = ''SUSPENSA_REVISAO'',\n'
    || E'        updated_at = now()\n'
    || E'    where id_usuario_pai = v_pai_id\n'
    || E'      and id_ocorrencia = v_id_ocorrencia\n'
    || E'      and tipo = ''PENALIDADE''\n'
    || E'      and status = ''PENDENTE'';\n\n'
    || E'  elsif v_acao = ''CUMPRIR_PENALIDADE'' then\n';

  if position(E'  if v_acao = ''CUMPRIR_PENALIDADE'' then\n' in v_ddl)=0 then
    raise exception 'Ponto da ação CUMPRIR_PENALIDADE não localizado';
  end if;

  v_ddl := replace(
    v_ddl,
    E'  if v_acao = ''CUMPRIR_PENALIDADE'' then\n',
    v_branch
  );

  v_ddl := replace(
    v_ddl,
    E'      when v_acao=''CUMPRIR_PENALIDADE'' then ''CUMPRIR_PENALIDADE''\n      when v_acao=''RESOLVER_REVISAO'' then ''RESOLVER_REVISAO''',
    E'      when v_acao=''CUMPRIR_PENALIDADE'' then ''CUMPRIR_PENALIDADE''\n      when v_acao=''SOLICITAR_REVISAO'' then ''SOLICITAR_REVISAO''\n      when v_acao=''RESOLVER_REVISAO'' then ''RESOLVER_REVISAO'''
  );

  v_ddl := replace(
    v_ddl,
    E'    case when v_acao=''RESOLVER_REVISAO'' then ''REVISAO'' else ''RESPONSAVEL'' end,',
    E'    case when v_acao in (''SOLICITAR_REVISAO'',''RESOLVER_REVISAO'') then ''REVISAO'' else ''RESPONSAVEL'' end,'
  );

  execute v_ddl;
end;
$$;

create or replace function public.criar_revisao_ocorrencia_filho_interno(
  p_token text,
  p_id_ocorrencia bigint,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_token_hash text;
  v_pai_id bigint;
  v_filho_id bigint;
  v_id_filho_tarefa bigint;
  v_vigencia_id bigint;
  v_tarefa_id bigint;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_nome_filho text;
  v_nome_tarefa text;
  v_data date;
  v_observacao text;
  v_tipo text;
  v_id bigint;
  v_status text;
  v_created_at timestamptz;
  v_resolvido_em timestamptz;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'codigo', 'SESSAO_INVALIDA');
  end if;

  if p_id_ocorrencia is null or p_id_ocorrencia <= 0 then
    return jsonb_build_object('ok', false, 'codigo', 'OCORRENCIA_INVALIDA');
  end if;

  v_observacao := nullif(btrim(coalesce(p_observacao, '')), '');
  if v_observacao is not null and char_length(v_observacao) > 120 then
    return jsonb_build_object('ok', false, 'codigo', 'OBSERVACAO_INVALIDA');
  end if;

  v_token_hash := pg_catalog.encode(
    extensions.digest(lower(p_token), 'sha256'),
    'hex'
  );

  select a.id_usuario_pai, a.id_filho
    into v_pai_id, v_filho_id
  from public.t_filho_acesso_app a
  where a.token_hash = v_token_hash
    and a.ativo = true
  limit 1;

  if v_pai_id is null or v_filho_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SESSAO_INVALIDA');
  end if;

  select
    o.id_filho_tarefa,
    o.tipo,
    timezone('America/Sao_Paulo', o.created_at)::date,
    ft.id_vigencia,
    ft.id_tarefa
  into
    v_id_filho_tarefa,
    v_tipo,
    v_data,
    v_vigencia_id,
    v_tarefa_id
  from public.t_ocorrencia o
  join public.t_filho_tarefa ft
    on ft.id = o.id_filho_tarefa
   and ft.id_usuario_pai = o.id_usuario_pai
  where o.id = p_id_ocorrencia
    and o.id_usuario_pai = v_pai_id
    and ft.id_filho = v_filho_id
  for update of o;

  if v_id_filho_tarefa is null then
    return jsonb_build_object('ok', false, 'codigo', 'OCORRENCIA_INVALIDA');
  end if;

  if v_tipo <> 'NAO_FEZ' then
    return jsonb_build_object('ok', false, 'codigo', 'REVISAO_INDISPONIVEL');
  end if;

  select v.data_inicio, v.data_fim
    into v_inicio, v_fim
  from public.t_vigencia v
  where v.id = v_vigencia_id
    and v.id_usuario_pai = v_pai_id
  for key share;

  if v_inicio is null or v_fim is null then
    return jsonb_build_object('ok', false, 'codigo', 'OCORRENCIA_INVALIDA');
  end if;

  if now() < v_inicio or now() > v_fim then
    return jsonb_build_object('ok', false, 'codigo', 'VIGENCIA_INATIVA');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_id_filho_tarefa::text || ':' || v_data::text,
      0
    )
  );

  select f.nome, t.nome
    into v_nome_filho, v_nome_tarefa
  from public.t_filho f
  join public.t_tarefa t
    on t.id = v_tarefa_id
   and t.id_usuario_pai = v_pai_id
  where f.id = v_filho_id
    and f.id_usuario_pai = v_pai_id;

  if v_nome_filho is null or v_nome_tarefa is null then
    return jsonb_build_object('ok', false, 'codigo', 'OCORRENCIA_INVALIDA');
  end if;

  insert into public.t_revisao_tarefa_filho (
    id_filho_tarefa,
    id_ocorrencia,
    data_referencia,
    observacao
  )
  values (
    v_id_filho_tarefa,
    p_id_ocorrencia,
    v_data,
    v_observacao
  )
  on conflict (id_ocorrencia) do nothing
  returning id, status, created_at, resolvido_em
    into v_id, v_status, v_created_at, v_resolvido_em;

  if v_id is null then
    select r.id, r.status, r.created_at, r.resolvido_em, r.observacao
      into v_id, v_status, v_created_at, v_resolvido_em, v_observacao
    from public.t_revisao_tarefa_filho r
    where r.id_ocorrencia = p_id_ocorrencia;

    return jsonb_build_object(
      'ok', true,
      'criada', false,
      'id_usuario_pai', v_pai_id,
      'id_filho', v_filho_id,
      'nome_filho', v_nome_filho,
      'nome_tarefa', v_nome_tarefa,
      'revisao', jsonb_build_object(
        'id', v_id,
        'id_ocorrencia', p_id_ocorrencia,
        'id_filho_tarefa', v_id_filho_tarefa,
        'data_referencia', v_data,
        'observacao', v_observacao,
        'status', v_status,
        'created_at', v_created_at,
        'resolvido_em', v_resolvido_em
      )
    );
  end if;

  perform set_config('app.revisao_filho_pai_id', v_pai_id::text, true);

  perform public.reconciliar_ocorrencia(
    'SOLICITAR_REVISAO',
    p_id_ocorrencia,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    v_id,
    'Pedido de revisão do filho'
  );

  perform set_config('app.revisao_filho_pai_id', '', true);

  update public.t_filho_acesso_app
  set ultimo_acesso_em = now(),
      updated_at = now()
  where token_hash = v_token_hash
    and ativo = true;

  return jsonb_build_object(
    'ok', true,
    'criada', true,
    'id_usuario_pai', v_pai_id,
    'id_filho', v_filho_id,
    'nome_filho', v_nome_filho,
    'nome_tarefa', v_nome_tarefa,
    'revisao', jsonb_build_object(
      'id', v_id,
      'id_ocorrencia', p_id_ocorrencia,
      'id_filho_tarefa', v_id_filho_tarefa,
      'data_referencia', v_data,
      'observacao', v_observacao,
      'status', v_status,
      'created_at', v_created_at,
      'resolvido_em', v_resolvido_em
    )
  );
end;
$fn$;

-- Corrige qualquer revisão pendente criada antes desta centralização.
update public.t_ocorrencia_consequencia c
set status = 'SUSPENSA_REVISAO',
    updated_at = now()
where c.tipo = 'PENALIDADE'
  and c.status = 'PENDENTE'
  and exists (
    select 1
    from public.t_revisao_tarefa_filho r
    where r.id_ocorrencia = c.id_ocorrencia
      and r.status = 'PENDENTE'
  );

revoke all on function public.criar_revisao_ocorrencia_filho_interno(text,bigint,text)
  from public, anon, authenticated, service_role;
grant execute on function public.criar_revisao_ocorrencia_filho_interno(text,bigint,text)
  to service_role;

revoke all on function public.reconciliar_ocorrencia(
  text,bigint,bigint,timestamptz,text,text,numeric,text,text,text,numeric,bigint,text
) from public, anon, authenticated, service_role;
grant execute on function public.reconciliar_ocorrencia(
  text,bigint,bigint,timestamptz,text,text,numeric,text,text,text,numeric,bigint,text
) to authenticated;

comment on function public.reconciliar_ocorrencia(
  text,bigint,bigint,timestamptz,text,text,numeric,text,text,text,numeric,bigint,text
) is
'Única operação transacional de efeitos de Fez/Não fez: ocorrência, consequência, solicitação/revisão, estrelas, recompensas, contador vivo e auditoria.';
