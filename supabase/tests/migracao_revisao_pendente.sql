-- Teste psql em DEV ANTES de aplicar a migration. Tudo revertido no final.
begin;
create temporary table fixture_revisao(id bigint) on commit drop;
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
  resposta := public.criar_revisao_ocorrencia_filho_interno(token,ocorrencia,null);
  if resposta->>'ok' is distinct from 'true' then raise exception 'Fixture de revisão não criada: %',resposta; end if;
  if not exists(select 1 from public.t_ocorrencia_consequencia where id_ocorrencia=ocorrencia and status='SUSPENSA_REVISAO') then raise exception 'Fixture não suspendeu penalidade'; end if;
  insert into fixture_revisao values(ocorrencia);
end;
$test$;
\ir ../migrations/20261022122141_retirar_fluxo_revisao.sql
do $test$
declare occ bigint;
begin
  select id into occ from fixture_revisao;
  if not exists(select 1 from public.t_revisao_tarefa_filho where id_ocorrencia=occ and status='ENCERRADA_RECURSO_REMOVIDO' and resolvido_em is not null) then raise exception 'Histórico não arquivado'; end if;
  if not exists(select 1 from public.t_ocorrencia_consequencia where id_ocorrencia=occ and status='PENDENTE') then raise exception 'Penalidade não retomada'; end if;
  if not exists(select 1 from public.t_ocorrencia where id=occ and tipo='NAO_FEZ') then raise exception 'Resultado alterado pela retirada'; end if;
end;
$test$;
select 'MIGRACAO_REVISAO_PENDENTE_APROVADA' as resultado;
rollback;
