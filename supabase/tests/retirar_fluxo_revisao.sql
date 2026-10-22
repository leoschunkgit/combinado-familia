begin;
do $schema_test$
begin
  if to_regclass('public.t_revisao_tarefa_filho') is not null then
    raise exception 'Tabela obsoleta ainda existe';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and column_name='id_revisao') then
    raise exception 'Coluna obsoleta ainda existe';
  end if;
  if to_regnamespace('arquivo_interno') is not null then
    raise exception 'Arquivo histórico de revisão ainda existe';
  end if;
end;
$schema_test$;
-- Execute após a migration, dentro de BEGIN/ROLLBACK. Nenhum dado de teste persiste.
do $test$
declare
  u uuid := gen_random_uuid();
  pai bigint; filho bigint; tarefa bigint; vigencia bigint; atribuicao bigint;
  ocorrencia bigint; resposta jsonb; token text := encode(extensions.gen_random_bytes(32),'hex');
  bloqueou boolean;
begin
  insert into auth.users(id,email,raw_user_meta_data)
  values (u,'teste-revisao-'||u::text||'@example.invalid','{"nome":"Teste transacional"}'::jsonb);
  select id into pai from public.t_usuario_pai where auth_user_id=u;
  if pai is null then
    insert into public.t_usuario_pai(auth_user_id,nome,email)
    values(u,'Teste transacional','teste-'||u::text||'@example.invalid') returning id into pai;
  end if;
  perform set_config('request.jwt.claim.sub',u::text,true);
  insert into public.t_filho(id_usuario_pai,nome,tem_mesada_opcional) values(pai,'Teste sem revisão',false) returning id into filho;
  insert into public.t_tarefa(id_usuario_pai,nome) values(pai,'Tarefa teste') returning id into tarefa;
  insert into public.t_vigencia(id_usuario_pai,data_inicio,data_fim) values(pai,now()-interval '1 day',now()+interval '1 day') returning id into vigencia;
  insert into public.t_filho_tarefa(id_usuario_pai,id_filho,id_tarefa,id_vigencia) values(pai,filho,tarefa,vigencia) returning id into atribuicao;
  insert into public.t_filho_acesso_app(id_usuario_pai,id_filho,token_hash) values(pai,filho,encode(extensions.digest(token,'sha256'),'hex'));

  resposta := public.criar_solicitacao_tarefa_filho_interno(token,atribuicao,null);
  if resposta->>'ok' <> 'true' then raise exception 'Terminei falhou: %', resposta; end if;
  resposta := public.reconciliar_ocorrencia(p_acao=>'SALVAR',p_id_filho_tarefa=>atribuicao,p_novo_tipo=>'NAO_FEZ',p_consequencia_tipo=>'PENALIDADE',p_penalidade_descricao=>'Organizar o quarto');
  ocorrencia := (resposta->>'id_ocorrencia')::bigint;
  if not exists(select 1 from public.t_solicitacao_tarefa_filho where id_filho_tarefa=atribuicao and status='RESOLVIDA_NAO_FEZ') then raise exception 'Aviso não resolvido'; end if;
  if public.montar_painel_app_filho(pai,filho) ? 'revisoes' then raise exception 'Painel ainda retorna revisões'; end if;

  bloqueou:=false;
  begin perform public.criar_revisao_ocorrencia_filho_interno(token,ocorrencia,null);
  exception when undefined_function then bloqueou:=true; end;
  if not bloqueou then raise exception 'Criação de revisão liberada'; end if;
  bloqueou:=false;
  begin perform public.resolver_revisao_tarefa_filho(1,'MANTER_NAO_FEZ');
  exception when undefined_function then bloqueou:=true; end;
  if not bloqueou then raise exception 'Resolução liberada'; end if;
  bloqueou:=false;
  begin perform public.reconciliar_ocorrencia(p_acao=>'SOLICITAR_REVISAO',p_id_ocorrencia=>ocorrencia);
  exception when raise_exception then bloqueou:=true; end;
  if not bloqueou then raise exception 'Ação antiga liberada'; end if;
  bloqueou:=false;
  begin perform public.reconciliar_ocorrencia(p_acao=>'SALVAR',p_id_ocorrencia=>ocorrencia,p_novo_tipo=>'FEZ',p_id_revisao=>1);
  exception when undefined_function then bloqueou:=true; end;
  if not bloqueou then raise exception 'Parâmetro antigo liberado'; end if;

  perform public.reconciliar_ocorrencia(p_acao=>'SALVAR',p_id_ocorrencia=>ocorrencia,p_novo_tipo=>'FEZ');
  if not exists(select 1 from public.t_ocorrencia_consequencia where id_ocorrencia=ocorrencia and status='CANCELADA') then raise exception 'Consequência não cancelada'; end if;
  perform public.reconciliar_ocorrencia(p_acao=>'SALVAR',p_id_ocorrencia=>ocorrencia,p_novo_tipo=>'NAO_PRECISOU');
  perform public.desfazer_ocorrencias(array[ocorrencia]);
  resposta := public.reconciliar_ocorrencia(p_acao=>'SALVAR',p_id_filho_tarefa=>atribuicao,p_novo_tipo=>'NAO_FEZ',p_consequencia_tipo=>'PENALIDADE',p_penalidade_descricao=>'Organizar o quarto');
  ocorrencia := (resposta->>'id_ocorrencia')::bigint;
  perform public.reconciliar_ocorrencia(p_acao=>'CUMPRIR_PENALIDADE',p_id_ocorrencia=>ocorrencia);
  bloqueou:=false;
  begin perform public.reconciliar_ocorrencia(p_acao=>'SALVAR',p_id_ocorrencia=>ocorrencia,p_novo_tipo=>'FEZ');
  exception when raise_exception then bloqueou:=true; end;
  if not bloqueou then raise exception 'Penalidade cumprida perdeu proteção'; end if;
end;
$test$;
select 'RETIRADA_REVISAO_APROVADA' as resultado;

rollback;
