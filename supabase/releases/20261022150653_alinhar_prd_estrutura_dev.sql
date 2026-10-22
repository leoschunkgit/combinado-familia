-- Alinha a estrutura da aplicação à DEV sem copiar registros da DEV.
-- Preserva valores removidos em schema privado exclusivo da PRD.
set local lock_timeout = '10s';
lock table public."t_filho_tarefa", public."t_ocorrencia", public."t_vigencia", public."t_revisao_tarefa_filho", public."t_recompensa_resgate", public."t_solicitacao_tarefa_filho", public."t_push_resposta_filho", public."t_filho" in access exclusive mode;
do $preconditions$ begin
if exists(select 1 from public.t_ocorrencia) or exists(select 1 from public.t_recompensa_estrela) or exists(select 1 from public.t_revisao_tarefa_filho) or exists(select 1 from public.t_push_resposta_filho where tipo_interacao='REVISAO') then
 raise exception 'Estado da PRD mudou: necessária migração de registros antes do alinhamento'; end if;
end; $preconditions$;
create temporary table alinhamento_fingerprints(tabela text primary key, checksum text) on commit drop;
insert into alinhamento_fingerprints select 't_push_dispositivo', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_push_dispositivo" t;
insert into alinhamento_fingerprints select 't_app_config', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_app_config" t;
insert into alinhamento_fingerprints select 't_app_feature_flag', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_app_feature_flag" t;
insert into alinhamento_fingerprints select 't_admin_auditoria', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_admin_auditoria" t;
insert into alinhamento_fingerprints select 't_push_envio', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_push_envio" t;
insert into alinhamento_fingerprints select 't_admin', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_admin" t;
insert into alinhamento_fingerprints select 't_app_telemetria', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_app_telemetria" t;
insert into alinhamento_fingerprints select 't_app_config_signal', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_app_config_signal" t;
insert into alinhamento_fingerprints select 't_usuario_pai', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_usuario_pai" t;
insert into alinhamento_fingerprints select 't_feedback', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_feedback" t;
insert into alinhamento_fingerprints select 't_filho_tarefa', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY['feito','qtd_nao_fez']::text[])::text),'' order by md5((to_jsonb(t) - ARRAY['feito','qtd_nao_fez']::text[])::text)),'')) from public."t_filho_tarefa" t;
insert into alinhamento_fingerprints select 'app_cron_config', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."app_cron_config" t;
insert into alinhamento_fingerprints select 't_ocorrencia', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY['bonificacao_tipo','bonificacao_descricao','bonificacao_valor']::text[])::text),'' order by md5((to_jsonb(t) - ARRAY['bonificacao_tipo','bonificacao_descricao','bonificacao_valor']::text[])::text)),'')) from public."t_ocorrencia" t;
insert into alinhamento_fingerprints select 't_filho', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_filho" t;
insert into alinhamento_fingerprints select 't_filho_acesso_publico', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_filho_acesso_publico" t;
insert into alinhamento_fingerprints select 't_tarefa', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_tarefa" t;
insert into alinhamento_fingerprints select 't_vigencia', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY['penalidade','qtd_ocorrencia','tipo_penalidade','valor_debito']::text[])::text),'' order by md5((to_jsonb(t) - ARRAY['penalidade','qtd_ocorrencia','tipo_penalidade','valor_debito']::text[])::text)),'')) from public."t_vigencia" t;
insert into alinhamento_fingerprints select 't_filho_acesso_app_tentativa', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_filho_acesso_app_tentativa" t;
insert into alinhamento_fingerprints select 't_filho_acesso_app_chave', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_filho_acesso_app_chave" t;
insert into alinhamento_fingerprints select 't_filho_acesso_app', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_filho_acesso_app" t;
insert into alinhamento_fingerprints select 't_estrela_movimento', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_estrela_movimento" t;
insert into alinhamento_fingerprints select 't_recompensa_estrela', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_recompensa_estrela" t;
insert into alinhamento_fingerprints select 't_recompensa_resgate', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_recompensa_resgate" t;
insert into alinhamento_fingerprints select 't_push_dispositivo_filho', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_push_dispositivo_filho" t;
insert into alinhamento_fingerprints select 't_push_envio_filho', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_push_envio_filho" t;
insert into alinhamento_fingerprints select 't_solicitacao_tarefa_filho', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_solicitacao_tarefa_filho" t;
insert into alinhamento_fingerprints select 't_push_resposta_filho', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_push_resposta_filho" t;
insert into alinhamento_fingerprints select 't_estrela_concessao', md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) from public."t_estrela_concessao" t;
create schema if not exists preservacao_prd;
revoke all on schema preservacao_prd from public,anon,authenticated,service_role;
create table preservacao_prd.estrutura_anterior_20261022 (
 tabela text not null, registro jsonb not null, preservado_em timestamptz not null default now()
);
alter table preservacao_prd.estrutura_anterior_20261022 enable row level security;
revoke all on preservacao_prd.estrutura_anterior_20261022 from public,anon,authenticated,service_role;
insert into preservacao_prd.estrutura_anterior_20261022(tabela,registro) select 't_filho_tarefa',to_jsonb(t) from public."t_filho_tarefa" t;
insert into preservacao_prd.estrutura_anterior_20261022(tabela,registro) select 't_ocorrencia',to_jsonb(t) from public."t_ocorrencia" t;
insert into preservacao_prd.estrutura_anterior_20261022(tabela,registro) select 't_vigencia',to_jsonb(t) from public."t_vigencia" t;
insert into preservacao_prd.estrutura_anterior_20261022(tabela,registro) select 't_revisao_tarefa_filho',to_jsonb(t) from public."t_revisao_tarefa_filho" t;
drop trigger "trg_recalcular_estado_atribuicao" on public."t_ocorrencia";
drop trigger "trg_guard_nao_fez_limit" on public."t_ocorrencia";
drop trigger "trg_recalcular_estado_filho_regra" on public."t_filho";
drop trigger "trg_recalcular_estado_vigencia_regra" on public."t_vigencia";
drop trigger "trg_recalcular_penalidade_ocorrencia" on public."t_ocorrencia";
drop trigger "trg_recalcular_penalidade_atribuicao" on public."t_filho_tarefa";
drop trigger "trg_recalcular_penalidade_filho" on public."t_filho";
drop trigger "trg_recalcular_penalidade_vigencia" on public."t_vigencia";
drop trigger "resolver_revisao_ao_marcar_fez" on public."t_ocorrencia";
drop trigger "resolver_solicitacao_tarefa_ao_marcar" on public."t_ocorrencia";
drop trigger "encerrar_revisao_ao_desfazer_marcacao" on public."t_ocorrencia";
drop trigger "trg_concessao_estrela_ocorrencia" on public."t_ocorrencia";
drop trigger "guard_validity_history_before_change" on public."t_vigencia";
alter table public."t_vigencia" drop constraint "t_vigencia_tipo_penalidade_check";
alter table public."t_vigencia" drop constraint "t_vigencia_valor_debito_positive";
alter table public."t_ocorrencia" drop constraint "t_ocorrencia_bonificacao_tipo_check";
alter table public."t_ocorrencia" drop constraint "t_ocorrencia_bonificacao_valor_check";
alter table public."t_ocorrencia" drop constraint "t_ocorrencia_bonificacao_somente_fez_check";
alter table public."t_ocorrencia" drop constraint "t_ocorrencia_bonificacao_consistente_check";
alter table public."t_vigencia" drop constraint "t_vigencia_qtd_ocorrencia_valida_check";
alter table public."t_vigencia" drop constraint "t_vigencia_penalidade_tamanho_check";
alter table public."t_revisao_tarefa_filho" drop constraint "t_revisao_tarefa_filho_observacao_chk";
alter table public."t_recompensa_resgate" drop constraint "t_recompensa_resgate_same_recompensa_fk";
alter table public."t_revisao_tarefa_filho" drop constraint "t_revisao_tarefa_filho_resolucao_chk";
alter table public."t_revisao_tarefa_filho" drop constraint "t_revisao_tarefa_filho_pkey";
alter table public."t_revisao_tarefa_filho" drop constraint "t_revisao_tarefa_filho_unica_tarefa_dia";
alter table public."t_revisao_tarefa_filho" drop constraint "t_revisao_tarefa_filho_id_filho_tarefa_fkey";
alter table public."t_revisao_tarefa_filho" drop constraint "t_revisao_tarefa_filho_status_chk";
alter table public."t_recompensa_resgate" drop constraint "t_recompensa_resgate_id_recompensa_fkey";
alter table public."t_ocorrencia" drop constraint "t_ocorrencia_tipo_check";
alter table public."t_solicitacao_tarefa_filho" drop constraint "t_solicitacao_tarefa_filho_status_chk";
alter table public."t_push_resposta_filho" drop constraint "t_push_resposta_filho_tipo_interacao_check";
drop function public.guard_mesada_assignment(), public.recalcular_penalidade_por_vigencia_trigger(), public.duplicar_vigencia_com_atribuicoes(bigint,timestamp with time zone,timestamp with time zone,text,integer,numeric), public.recalcular_penalidade_por_atribuicao_trigger(), public.recalcular_penalidade_por_filho_trigger(), public.recalcular_penalidade_por_ocorrencia_trigger(), public.recalcular_penalidade_vigencia(bigint), public.registrar_nao_fez_com_penalidade(bigint,timestamp with time zone,bigint,text), public.existe_filho_sem_mesada_no_limite(bigint), public.guard_nao_fez_limit(), public.recalcular_estado_atribuicao(bigint), public.recalcular_estado_atribuicao_trigger(), public.recalcular_estado_por_regra_trigger(), public.criar_revisao_tarefa_filho_interno(text,bigint,text), public.resolver_revisao_tarefa_filho(bigint,text), public.resolver_revisao_ao_marcar_fez(), public.resolver_solicitacao_tarefa_ao_marcar(), public.encerrar_revisao_ao_desfazer_marcacao(), public.guard_mesada_child(), public.guard_mesada_validity(), public.registrar_concessao_estrela_ocorrencia();
drop table public."t_revisao_tarefa_filho";
alter table public."t_filho_tarefa" drop column "feito";
alter table public."t_filho_tarefa" drop column "qtd_nao_fez";
alter table public."t_ocorrencia" drop column "bonificacao_tipo";
alter table public."t_ocorrencia" drop column "bonificacao_descricao";
alter table public."t_ocorrencia" drop column "bonificacao_valor";
alter table public."t_vigencia" drop column "penalidade";
alter table public."t_vigencia" drop column "qtd_ocorrencia";
alter table public."t_vigencia" drop column "tipo_penalidade";
alter table public."t_vigencia" drop column "valor_debito";
create table public."t_ocorrencia_reconciliacao" ("id" bigint generated by default as identity not null,
"id_usuario_pai" bigint not null,
"id_ocorrencia" bigint,
"id_filho_tarefa" bigint not null,
"acao" text not null,
"origem" text default 'RESPONSAVEL'::text not null,
"estado_anterior" jsonb,
"estado_novo" jsonb,
"motivo" text,
"created_at" timestamp with time zone default now() not null);
alter table public."t_ocorrencia_reconciliacao" enable row level security;
create table public."t_ocorrencia_consequencia" ("id" bigint generated by default as identity not null,
"id_usuario_pai" bigint not null,
"id_ocorrencia" bigint not null,
"tipo" text not null,
"desconto_valor" numeric,
"penalidade_descricao" text,
"status" text not null,
"cumprida_em" timestamp with time zone,
"cancelada_em" timestamp with time zone,
"created_at" timestamp with time zone default now() not null,
"updated_at" timestamp with time zone default now() not null);
alter table public."t_ocorrencia_consequencia" enable row level security;
alter table public."t_recompensa_estrela" add column "marco_inicial_estrelas" integer not null;
alter table public."t_recompensa_resgate" alter column "id_recompensa" drop not null;
alter table public."t_ocorrencia_consequencia" add constraint "t_ocorrencia_consequencia_id_ocorrencia_key" UNIQUE (id_ocorrencia);
alter table public."t_recompensa_resgate" add constraint "t_recompensa_resgate_pendente_recompensa_chk" CHECK (((status <> 'PENDENTE'::text) OR (id_recompensa IS NOT NULL)));
alter table public."t_recompensa_estrela" add constraint "t_recompensa_estrela_marco_inicial_chk" CHECK ((marco_inicial_estrelas >= 0));
alter table public."t_ocorrencia_consequencia" add constraint "t_ocorrencia_consequencia_tipo_check" CHECK ((tipo = ANY (ARRAY['DESCONTO'::text, 'PENALIDADE'::text])));
alter table public."t_ocorrencia_consequencia" add constraint "t_ocorrencia_consequencia_desconto_valor_check" CHECK (((desconto_valor IS NULL) OR (desconto_valor > (0)::numeric)));
alter table public."t_ocorrencia_consequencia" add constraint "t_ocorrencia_consequencia_pkey" PRIMARY KEY (id);
alter table public."t_ocorrencia_reconciliacao" add constraint "t_ocorrencia_reconciliacao_pkey" PRIMARY KEY (id);
alter table public."t_ocorrencia" add constraint "t_ocorrencia_pai_id_uniq" UNIQUE (id_usuario_pai, id);
alter table public."t_ocorrencia_reconciliacao" add constraint "t_ocorrencia_reconciliacao_origem_check" CHECK ((origem = ANY (ARRAY['RESPONSAVEL'::text, 'SISTEMA'::text])));
alter table public."t_ocorrencia_reconciliacao" add constraint "t_ocorrencia_reconciliacao_acao_check" CHECK ((acao = ANY (ARRAY['CRIAR'::text, 'ALTERAR'::text, 'DESFAZER'::text, 'CUMPRIR_PENALIDADE'::text])));
alter table public."t_ocorrencia_consequencia" add constraint "t_ocorrencia_consequencia_coerencia_chk" CHECK ((((tipo = 'DESCONTO'::text) AND (desconto_valor IS NOT NULL) AND (penalidade_descricao IS NULL) AND (status = ANY (ARRAY['APLICADO'::text, 'ESTORNADO'::text])) AND (cumprida_em IS NULL)) OR ((tipo = 'PENALIDADE'::text) AND (desconto_valor IS NULL) AND (penalidade_descricao IS NOT NULL) AND ((char_length(btrim(penalidade_descricao)) >= 2) AND (char_length(btrim(penalidade_descricao)) <= 200)) AND (status = ANY (ARRAY['PENDENTE'::text, 'CUMPRIDA'::text, 'CANCELADA'::text])))));
alter table public."t_ocorrencia_consequencia" add constraint "t_ocorrencia_consequencia_status_check" CHECK ((status = ANY (ARRAY['APLICADO'::text, 'PENDENTE'::text, 'CUMPRIDA'::text, 'CANCELADA'::text, 'ESTORNADO'::text])));
alter table public."t_ocorrencia" add constraint "t_ocorrencia_tipo_check" CHECK ((tipo = ANY (ARRAY['FEZ'::text, 'NAO_FEZ'::text, 'NAO_PRECISOU'::text])));
alter table public."t_solicitacao_tarefa_filho" add constraint "t_solicitacao_tarefa_filho_status_chk" CHECK ((status = ANY (ARRAY['PENDENTE'::text, 'RESOLVIDA_FEZ'::text, 'RESOLVIDA_NAO_FEZ'::text, 'RESOLVIDA_NAO_PRECISOU'::text])));
alter table public."t_push_resposta_filho" add constraint "t_push_resposta_filho_tipo_interacao_check" CHECK ((tipo_interacao = 'SOLICITACAO'::text));
alter table public."t_ocorrencia_consequencia" add constraint "t_ocorrencia_consequencia_id_usuario_pai_fkey" FOREIGN KEY (id_usuario_pai) REFERENCES t_usuario_pai(id) ON DELETE CASCADE;
alter table public."t_ocorrencia_consequencia" add constraint "t_ocorrencia_consequencia_id_ocorrencia_fkey" FOREIGN KEY (id_ocorrencia) REFERENCES t_ocorrencia(id) ON DELETE CASCADE;
alter table public."t_ocorrencia_reconciliacao" add constraint "t_ocorrencia_reconciliacao_id_usuario_pai_fkey" FOREIGN KEY (id_usuario_pai) REFERENCES t_usuario_pai(id) ON DELETE CASCADE;
alter table public."t_ocorrencia_consequencia" add constraint "t_ocorrencia_consequencia_mesmo_pai_fk" FOREIGN KEY (id_usuario_pai, id_ocorrencia) REFERENCES t_ocorrencia(id_usuario_pai, id) ON DELETE CASCADE;
alter table public."t_recompensa_resgate" add constraint "t_recompensa_resgate_id_recompensa_fkey" FOREIGN KEY (id_recompensa) REFERENCES t_recompensa_estrela(id) ON DELETE SET NULL;
CREATE INDEX idx_ocorrencia_reconciliacao_pai_data ON public.t_ocorrencia_reconciliacao USING btree (id_usuario_pai, created_at DESC);
CREATE INDEX idx_ocorrencia_reconciliacao_ocorrencia ON public.t_ocorrencia_reconciliacao USING btree (id_ocorrencia);
CREATE INDEX idx_ocorrencia_consequencia_pai ON public.t_ocorrencia_consequencia USING btree (id_usuario_pai);
CREATE INDEX idx_ocorrencia_consequencia_status ON public.t_ocorrencia_consequencia USING btree (id_usuario_pai, status);
CREATE OR REPLACE FUNCTION public.concluir_ciclo_recompensa_interno(p_id_usuario_pai bigint, p_id_filho bigint, p_id_recompensa bigint, p_confirmado_por text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_recompensa_nome text;
  v_resgate_id bigint;
  v_meta integer;
  v_total integer;
  v_ultimo_id bigint;
  v_ultimo_total integer;
  v_ultimo_entregue_em timestamptz;
  v_ultimo_confirmado_por text;
begin
  if p_confirmado_por not in ('FILHO', 'RESPONSAVEL') then
    return jsonb_build_object('ok', false, 'codigo', 'ORIGEM_CONFIRMACAO_INVALIDA');
  end if;

  if p_id_recompensa is null or p_id_recompensa <= 0 then
    return jsonb_build_object('ok', false, 'codigo', 'RECOMPENSA_INVALIDA');
  end if;

  perform 1
  from public.t_filho f
  where f.id = p_id_filho
    and f.id_usuario_pai = p_id_usuario_pai
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'codigo', 'RECOMPENSA_INVALIDA');
  end if;

  select r.nome
    into v_recompensa_nome
  from public.t_recompensa_estrela r
  where r.id = p_id_recompensa
    and r.id_usuario_pai = p_id_usuario_pai
    and r.id_filho = p_id_filho
    and r.ativo = true;

  if v_recompensa_nome is null then
    return jsonb_build_object('ok', false, 'codigo', 'RECOMPENSA_INVALIDA');
  end if;

  perform public.reconciliar_recompensas_estrelas_filho_interno(
    p_id_usuario_pai,
    p_id_filho
  );

  select
    rr.id,
    coalesce(rr.meta_estrelas_no_resgate, rr.estrelas_utilizadas)
    into v_resgate_id, v_meta
  from public.t_recompensa_resgate rr
  where rr.id_usuario_pai = p_id_usuario_pai
    and rr.id_filho = p_id_filho
    and rr.id_recompensa = p_id_recompensa
    and rr.status = 'PENDENTE'
  order by rr.created_at desc, rr.id desc
  limit 1
  for update;

  v_total := public.estrelas_total_conquistado_interno(
    p_id_usuario_pai,
    p_id_filho
  );

  if v_resgate_id is null then
    select
      rr.id,
      rr.total_estrelas_no_resgate,
      rr.entregue_em,
      rr.confirmado_por
      into
        v_ultimo_id,
        v_ultimo_total,
        v_ultimo_entregue_em,
        v_ultimo_confirmado_por
    from public.t_recompensa_resgate rr
    where rr.id_usuario_pai = p_id_usuario_pai
      and rr.id_filho = p_id_filho
      and rr.id_recompensa = p_id_recompensa
      and rr.status = 'ENTREGUE'
    order by rr.entregue_em desc nulls last, rr.id desc
    limit 1;

    if v_ultimo_id is not null
       and v_ultimo_total = v_total
       and v_ultimo_entregue_em >= now() - interval '2 minutes' then
      return jsonb_build_object(
        'ok', true,
        'concluida', false,
        'ja_concluida', true,
        'id_usuario_pai', p_id_usuario_pai,
        'id_filho', p_id_filho,
        'confirmado_por', v_ultimo_confirmado_por,
        'recompensa', jsonb_build_object(
          'id', p_id_recompensa,
          'nome', v_recompensa_nome,
          'id_ciclo', v_ultimo_id
        )
      );
    end if;

    return jsonb_build_object('ok', false, 'codigo', 'RECOMPENSA_INDISPONIVEL');
  end if;

  update public.t_recompensa_resgate
  set status = 'ENTREGUE',
      total_estrelas_no_resgate = v_total,
      entregue_em = now(),
      cancelado_em = null,
      confirmado_por = p_confirmado_por,
      updated_at = now()
  where id = v_resgate_id
    and id_usuario_pai = p_id_usuario_pai
    and id_filho = p_id_filho;

  return jsonb_build_object(
    'ok', true,
    'concluida', true,
    'ja_concluida', false,
    'id_usuario_pai', p_id_usuario_pai,
    'id_filho', p_id_filho,
    'confirmado_por', p_confirmado_por,
    'recompensa', jsonb_build_object(
      'id', p_id_recompensa,
      'nome', v_recompensa_nome,
      'meta_estrelas', v_meta,
      'total_estrelas_na_conclusao', v_total,
      'id_ciclo', v_resgate_id
    )
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.concluir_recompensa_filho_interno(p_token text, p_id_recompensa bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_token_hash text;
  v_pai_id bigint;
  v_filho_id bigint;
  v_nome_filho text;
  v_resultado jsonb;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'codigo', 'SESSAO_INVALIDA');
  end if;

  v_token_hash := pg_catalog.encode(
    extensions.digest(lower(p_token), 'sha256'),
    'hex'
  );

  select a.id_usuario_pai, a.id_filho, f.nome
    into v_pai_id, v_filho_id, v_nome_filho
  from public.t_filho_acesso_app a
  join public.t_filho f
    on f.id = a.id_filho
   and f.id_usuario_pai = a.id_usuario_pai
  where a.token_hash = v_token_hash
    and a.ativo = true
  limit 1;

  if v_pai_id is null or v_filho_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'SESSAO_INVALIDA');
  end if;

  v_resultado := public.concluir_ciclo_recompensa_interno(
    v_pai_id,
    v_filho_id,
    p_id_recompensa,
    'FILHO'
  );

  if coalesce((v_resultado->>'ok')::boolean, false) then
    update public.t_filho_acesso_app
    set ultimo_acesso_em = now(),
        updated_at = now()
    where token_hash = v_token_hash
      and ativo = true;

    return v_resultado || jsonb_build_object(
      'nome_filho', v_nome_filho,
      'estrelas', public.resumo_estrelas_filho_interno(v_pai_id, v_filho_id)
    );
  end if;

  return v_resultado;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.confirmar_recompensa_aproveitada(p_id_recompensa bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_pai_id bigint;
  v_filho_id bigint;
  v_resultado jsonb;
begin
  select p.id
    into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  select r.id_filho
    into v_filho_id
  from public.t_recompensa_estrela r
  where r.id = p_id_recompensa
    and r.id_usuario_pai = v_pai_id
    and r.ativo = true;

  if v_filho_id is null then
    raise exception 'Recompensa não encontrada';
  end if;

  v_resultado := public.concluir_ciclo_recompensa_interno(
    v_pai_id,
    v_filho_id,
    p_id_recompensa,
    'RESPONSAVEL'
  );

  if coalesce((v_resultado->>'ok')::boolean, false) then
    return v_resultado || jsonb_build_object(
      'resumo',
      public.resumo_estrelas_filho_interno(v_pai_id, v_filho_id)
    );
  end if;

  return v_resultado;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.contar_nao_fez_filho_vigencia(p_id_filho bigint, p_id_vigencia bigint)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select count(*)::integer
  from public.t_ocorrencia o
  join public.t_filho_tarefa ft
    on ft.id = o.id_filho_tarefa
   and ft.id_usuario_pai = o.id_usuario_pai
  where o.id_usuario_pai = public.current_pai_id()
    and ft.id_filho = p_id_filho
    and ft.id_vigencia = p_id_vigencia
    and o.tipo = 'NAO_FEZ';
$function$
;
CREATE OR REPLACE FUNCTION public.criar_solicitacao_tarefa_filho_interno(p_token text, p_id_filho_tarefa bigint, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_token_hash text;
  v_pai_id bigint;
  v_filho_id bigint;
  v_vigencia_id bigint;
  v_tarefa_id bigint;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_nome_filho text;
  v_nome_tarefa text;
  v_data date;
  v_observacao text;
  v_id bigint;
  v_status text;
  v_created_at timestamptz;
  v_resolvido_em timestamptz;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'codigo', 'SESSAO_INVALIDA');
  end if;

  if p_id_filho_tarefa is null or p_id_filho_tarefa <= 0 then
    return jsonb_build_object('ok', false, 'codigo', 'TAREFA_INVALIDA');
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

  select ft.id_vigencia, ft.id_tarefa
    into v_vigencia_id, v_tarefa_id
  from public.t_filho_tarefa ft
  where ft.id = p_id_filho_tarefa
    and ft.id_usuario_pai = v_pai_id
    and ft.id_filho = v_filho_id
  for key share;

  if v_vigencia_id is null then
    return jsonb_build_object('ok', false, 'codigo', 'TAREFA_INVALIDA');
  end if;

  select v.data_inicio, v.data_fim
    into v_inicio, v_fim
  from public.t_vigencia v
  where v.id = v_vigencia_id
    and v.id_usuario_pai = v_pai_id
  for key share;

  if v_inicio is null or v_fim is null then
    return jsonb_build_object('ok', false, 'codigo', 'TAREFA_INVALIDA');
  end if;

  if now() < v_inicio or now() > v_fim then
    return jsonb_build_object('ok', false, 'codigo', 'VIGENCIA_INATIVA');
  end if;

  v_data := timezone('America/Sao_Paulo', now())::date;

  if v_data < timezone('America/Sao_Paulo', v_inicio)::date
     or v_data > timezone('America/Sao_Paulo', v_fim)::date then
    return jsonb_build_object('ok', false, 'codigo', 'VIGENCIA_INATIVA');
  end if;

  -- Mesma chave usada pelo fluxo de Fez/Não fez: evita corrida entre
  -- nova solicitação e uma marcação criada no mesmo instante.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_id_filho_tarefa::text || ':' || v_data::text,
      0
    )
  );


  if exists (
    select 1
    from public.t_ocorrencia o
    where o.id_filho_tarefa = p_id_filho_tarefa
      and timezone('America/Sao_Paulo', o.created_at)::date = v_data
  ) then
    return jsonb_build_object('ok', false, 'codigo', 'JA_MARCADA');
  end if;

  select f.nome, t.nome
    into v_nome_filho, v_nome_tarefa
  from public.t_filho f
  join public.t_tarefa t
    on t.id = v_tarefa_id
   and t.id_usuario_pai = v_pai_id
  where f.id = v_filho_id
    and f.id_usuario_pai = v_pai_id;

  if v_nome_filho is null or v_nome_tarefa is null then
    return jsonb_build_object('ok', false, 'codigo', 'TAREFA_INVALIDA');
  end if;

  -- Idempotência vale apenas para a pendência atual.
  -- Uma solicitação já resolvida é histórico e não impede um novo ciclo.
  select s.id, s.status, s.created_at, s.resolvido_em, s.observacao
    into v_id, v_status, v_created_at, v_resolvido_em, v_observacao
  from public.t_solicitacao_tarefa_filho s
  where s.id_filho_tarefa = p_id_filho_tarefa
    and s.data_referencia = v_data
    and s.status = 'PENDENTE'
  order by s.created_at desc, s.id desc
  limit 1;

  if v_id is not null then
    return jsonb_build_object(
      'ok', true,
      'criada', false,
      'id_usuario_pai', v_pai_id,
      'id_filho', v_filho_id,
      'nome_filho', v_nome_filho,
      'nome_tarefa', v_nome_tarefa,
      'solicitacao', jsonb_build_object(
        'id', v_id,
        'id_filho_tarefa', p_id_filho_tarefa,
        'data_referencia', v_data,
        'observacao', v_observacao,
        'status', v_status,
        'created_at', v_created_at,
        'resolvido_em', v_resolvido_em
      )
    );
  end if;

  insert into public.t_solicitacao_tarefa_filho (
    id_filho_tarefa,
    data_referencia,
    observacao
  )
  values (
    p_id_filho_tarefa,
    v_data,
    v_observacao
  )
  returning id, status, created_at, resolvido_em
    into v_id, v_status, v_created_at, v_resolvido_em;

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
    'solicitacao', jsonb_build_object(
      'id', v_id,
      'id_filho_tarefa', p_id_filho_tarefa,
      'data_referencia', v_data,
      'observacao', v_observacao,
      'status', v_status,
      'created_at', v_created_at,
      'resolvido_em', v_resolvido_em
    )
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.desfazer_ocorrencias(p_ids bigint[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_pai_id bigint;
  v_ids bigint[];
  v_id bigint;
  v_resultados jsonb := '[]'::jsonb;
  v_ids_desfeitos bigint[] := '{}';
  v_ids_preservados bigint[] := '{}';
begin
  v_pai_id := public.current_pai_id();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  select array_agg(distinct x.id order by x.id)
    into v_ids
  from unnest(p_ids) x(id)
  where x.id is not null;

  if v_ids is null or coalesce(array_length(v_ids,1),0)=0 then
    raise exception 'Informe ao menos uma ocorrência';
  end if;

  if exists (
    select 1
    from unnest(v_ids) x(id)
    left join public.t_ocorrencia o
      on o.id=x.id
     and o.id_usuario_pai=v_pai_id
    where o.id is null
  ) then
    raise exception 'Uma ou mais ocorrências não pertencem ao responsável';
  end if;

  foreach v_id in array v_ids
  loop
    if public.motivo_bloqueio_desfazer_ocorrencia_interno(v_pai_id,v_id)
       = 'PENALIDADE_CUMPRIDA' then
      v_ids_preservados := array_append(v_ids_preservados,v_id);
      continue;
    end if;

    v_resultados := v_resultados || jsonb_build_array(
      public.reconciliar_ocorrencia(
        p_acao => 'DESFAZER',
        p_id_ocorrencia => v_id,
        p_motivo => 'Desfazer marcação'
      )
    );

    v_ids_desfeitos := array_append(v_ids_desfeitos,v_id);
  end loop;

  return jsonb_build_object(
    'ok',true,
    'quantidade_solicitada',coalesce(array_length(v_ids,1),0),
    'quantidade_desfeita',coalesce(array_length(v_ids_desfeitos,1),0),
    'quantidade_preservada',coalesce(array_length(v_ids_preservados,1),0),
    'ids_desfeitos',to_jsonb(v_ids_desfeitos),
    'ids_preservados',to_jsonb(v_ids_preservados),
    'resultados',v_resultados
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.duplicar_vigencia_com_atribuicoes(p_modelo_id bigint, p_data_inicio timestamp with time zone, p_data_fim timestamp with time zone)
 RETURNS TABLE(id_vigencia bigint, qtd_atribuicoes integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_pai_id bigint;
  v_modelo_fim timestamptz;
  v_nova_id bigint;
  v_qtd integer;
begin
  select p.id into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  select v.data_fim into v_modelo_fim
  from public.t_vigencia v
  where v.id = p_modelo_id
    and v.id_usuario_pai = v_pai_id;

  if v_modelo_fim is null then
    raise exception 'Vigência modelo não encontrada';
  end if;

  if p_data_fim <= p_data_inicio then
    raise exception 'A data/hora fim deve ser posterior à data/hora início';
  end if;

  if p_data_inicio <= v_modelo_fim then
    raise exception 'A nova vigência deve começar depois do término da vigência modelo';
  end if;

  insert into public.t_vigencia (
    id_usuario_pai, data_inicio, data_fim
  )
  values (
    v_pai_id, p_data_inicio, p_data_fim
  )
  returning id into v_nova_id;

  insert into public.t_filho_tarefa (
    id_usuario_pai, id_vigencia, id_filho, id_tarefa
  )
  select
    v_pai_id, v_nova_id, ft.id_filho, ft.id_tarefa
  from public.t_filho_tarefa ft
  where ft.id_usuario_pai = v_pai_id
    and ft.id_vigencia = p_modelo_id;

  get diagnostics v_qtd = row_count;
  return query select v_nova_id, v_qtd;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.excluir_recompensa_estrelas(p_id_recompensa bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_pai_id bigint;
  v_count integer;
begin
  select p.id
    into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  perform 1
  from public.t_recompensa_estrela r
  where r.id = p_id_recompensa
    and r.id_usuario_pai = v_pai_id
  for update;

  if not found then
    raise exception 'Recompensa não encontrada';
  end if;

  if exists (
    select 1
    from public.t_recompensa_resgate rr
    where rr.id_recompensa = p_id_recompensa
      and rr.id_usuario_pai = v_pai_id
      and rr.status = 'PENDENTE'
  ) then
    raise exception 'Esta recompensa está conquistada e aguardando confirmação; conclua o ciclo antes de excluir';
  end if;

  delete from public.t_recompensa_estrela
  where id = p_id_recompensa
    and id_usuario_pai = v_pai_id;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.excluir_vigencia_com_regra(p_id_vigencia bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_pai_id bigint;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_tem_atribuicoes boolean;
  v_tem_historico boolean;
begin
  select p.id
    into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  select v.data_inicio, v.data_fim
    into v_inicio, v_fim
  from public.t_vigencia v
  where v.id = p_id_vigencia
    and v.id_usuario_pai = v_pai_id;

  if v_inicio is null or v_fim is null then
    raise exception 'Vigência não encontrada';
  end if;

  perform 1
  from public.t_filho_tarefa ft
  where ft.id_vigencia = p_id_vigencia
    and ft.id_usuario_pai = v_pai_id
  for update;

  select exists (
    select 1
    from public.t_filho_tarefa ft
    where ft.id_vigencia = p_id_vigencia
      and ft.id_usuario_pai = v_pai_id
  ) into v_tem_atribuicoes;

  select
    exists (
      select 1
      from public.t_ocorrencia o
      join public.t_filho_tarefa ft
        on ft.id = o.id_filho_tarefa
       and ft.id_usuario_pai = o.id_usuario_pai
      where ft.id_vigencia = p_id_vigencia
        and ft.id_usuario_pai = v_pai_id
    )
    or exists (
      select 1
      from public.t_solicitacao_tarefa_filho s
      join public.t_filho_tarefa ft
        on ft.id = s.id_filho_tarefa
      where ft.id_vigencia = p_id_vigencia
        and ft.id_usuario_pai = v_pai_id
        and s.status = 'PENDENTE'
    )

  into v_tem_historico;

  if v_tem_historico then
    raise exception 'Vigência com resultados ou pedido pendente do filho não pode ser excluída';
  end if;

  if now() >= v_inicio
     and now() <= v_fim
     and v_tem_atribuicoes then
    raise exception 'Vigência em andamento com atribuições não pode ser excluída';
  end if;

  delete from public.t_filho_tarefa ft
  where ft.id_vigencia = p_id_vigencia
    and ft.id_usuario_pai = v_pai_id;

  delete from public.t_vigencia v
  where v.id = p_id_vigencia
    and v.id_usuario_pai = v_pai_id;

  return true;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.garantir_conquista_recompensa_estrelas_interno(p_id_usuario_pai bigint, p_id_filho bigint, p_id_recompensa bigint DEFAULT NULL::bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_total integer;
  v_marco integer;
  v_recompensa record;
begin
  perform 1
  from public.t_filho f
  where f.id = p_id_filho
    and f.id_usuario_pai = p_id_usuario_pai
  for update;

  if not found then return; end if;

  v_total := public.estrelas_total_conquistado_interno(p_id_usuario_pai, p_id_filho);

  for v_recompensa in
    select r.id, r.nome, r.descricao, r.estrelas_necessarias
    from public.t_recompensa_estrela r
    where r.id_usuario_pai = p_id_usuario_pai
      and r.id_filho = p_id_filho
      and r.ativo = true
      and (p_id_recompensa is null or r.id = p_id_recompensa)
    order by r.id
    for update
  loop
    if exists (
      select 1
      from public.t_recompensa_resgate rr
      where rr.id_usuario_pai = p_id_usuario_pai
        and rr.id_filho = p_id_filho
        and rr.id_recompensa = v_recompensa.id
        and rr.status = 'PENDENTE'
    ) then
      continue;
    end if;

    v_marco := public.marco_recompensa_estrelas_interno(
      p_id_usuario_pai,
      p_id_filho,
      v_recompensa.id
    );

    if greatest(v_total - v_marco, 0) < v_recompensa.estrelas_necessarias then
      continue;
    end if;

    insert into public.t_recompensa_resgate (
      id_usuario_pai, id_filho, id_recompensa, recompensa_nome,
      recompensa_descricao_no_resgate, estrelas_utilizadas,
      meta_estrelas_no_resgate, total_estrelas_no_resgate, status
    )
    values (
      p_id_usuario_pai, p_id_filho, v_recompensa.id, v_recompensa.nome,
      v_recompensa.descricao, v_recompensa.estrelas_necessarias,
      v_recompensa.estrelas_necessarias, v_total, 'PENDENTE'
    );
  end loop;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.guard_assignment_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_parentes_existentes boolean;
  v_tem_ocorrencia boolean;
  v_tem_solicitacao boolean;
  v_tem_solicitacao_pendente boolean;
begin
  select exists (
    select 1
    from public.t_ocorrencia o
    where o.id_filho_tarefa = old.id
  ) into v_tem_ocorrencia;

  select
    exists (
      select 1
      from public.t_solicitacao_tarefa_filho s
      where s.id_filho_tarefa = old.id
    ),
    exists (
      select 1
      from public.t_solicitacao_tarefa_filho s
      where s.id_filho_tarefa = old.id
        and s.status = 'PENDENTE'
    )
  into v_tem_solicitacao, v_tem_solicitacao_pendente;

  if tg_op = 'DELETE' then
    select
      exists (select 1 from public.t_filho f where f.id = old.id_filho)
      and exists (select 1 from public.t_tarefa t where t.id = old.id_tarefa)
      and exists (select 1 from public.t_vigencia v where v.id = old.id_vigencia)
    into v_parentes_existentes;

    if v_parentes_existentes
       and (v_tem_ocorrencia or v_tem_solicitacao_pendente) then
      if v_tem_ocorrencia then
        raise exception 'Atribuicao com resultados nao pode ser excluida diretamente';
      end if;
      raise exception 'Atribuicao com aviso pendente do filho nao pode ser excluida diretamente';
    end if;

    return old;
  end if;

  -- Edicao continua bloqueada por qualquer historico do filho, mesmo resolvido:
  -- alterar o vinculo mudaria retroativamente o significado do aviso.
  if v_tem_ocorrencia then
    raise exception 'Atribuicao com resultados nao pode ser editada';
  end if;
  if v_tem_solicitacao then
    raise exception 'Atribuicao com aviso do filho nao pode ser editada';
  end if;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.guard_occurrence_active_validity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_assignment_id bigint;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_ocorrencia timestamptz;
  v_hoje date;
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

  if now() < v_inicio or now() > v_fim then
    raise exception 'Resultados só podem ser alterados em vigência em andamento';
  end if;

  if tg_op <> 'DELETE' then
    v_hoje := (now() at time zone 'America/Sao_Paulo')::date;

    if (v_ocorrencia at time zone 'America/Sao_Paulo')::date
         < (v_inicio at time zone 'America/Sao_Paulo')::date
       or (v_ocorrencia at time zone 'America/Sao_Paulo')::date
         > (v_fim at time zone 'America/Sao_Paulo')::date then
      raise exception 'A data do resultado deve estar dentro da vigência';
    end if;

    if (v_ocorrencia at time zone 'America/Sao_Paulo')::date > v_hoje then
      raise exception 'Não é permitido registrar resultado em data futura';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.guard_solicitacao_tarefa_filho_imutavel()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.id is distinct from old.id
     or new.id_filho_tarefa is distinct from old.id_filho_tarefa
     or new.data_referencia is distinct from old.data_referencia
     or new.observacao is distinct from old.observacao
     or new.created_at is distinct from old.created_at then
    raise exception 'Conteudo da solicitacao do filho nao pode ser alterado';
  end if;

  if new.status not in ('PENDENTE', 'RESOLVIDA_FEZ', 'RESOLVIDA_NAO_FEZ', 'RESOLVIDA_NAO_PRECISOU') then
    raise exception 'Status da solicitacao do filho invalido';
  end if;

  if (new.status = 'PENDENTE' and new.resolvido_em is not null)
     or (new.status <> 'PENDENTE' and new.resolvido_em is null) then
    raise exception 'Estado de resolucao da solicitacao do filho invalido';
  end if;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.guard_validity_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1 from public.t_usuario_pai p where p.id = old.id_usuario_pai
    )
    and exists (
      select 1 from public.t_filho_tarefa ft where ft.id_vigencia = old.id
    ) then
      raise exception 'Vigência com atribuições não pode ser excluída';
    end if;
    return old;
  end if;

  if new.data_fim <= new.data_inicio then
    raise exception 'A data/hora fim deve ser posterior à data/hora início';
  end if;

  if (
       new.data_inicio is distinct from old.data_inicio
       or new.data_fim is distinct from old.data_fim
     )
     and exists (
       select 1
       from public.t_ocorrencia o
       join public.t_filho_tarefa ft on ft.id = o.id_filho_tarefa
       where ft.id_vigencia = old.id
         and (
           timezone('America/Sao_Paulo', o.created_at)::date
             < timezone('America/Sao_Paulo', new.data_inicio)::date
           or timezone('America/Sao_Paulo', o.created_at)::date
             > timezone('America/Sao_Paulo', new.data_fim)::date
         )
     ) then
    raise exception 'Há resultados fora do novo período da vigência';
  end if;

  if (
       new.data_inicio is distinct from old.data_inicio
       or new.data_fim is distinct from old.data_fim
     )
     and exists (
       select 1
       from public.t_solicitacao_tarefa_filho s
       join public.t_filho_tarefa ft on ft.id = s.id_filho_tarefa
       where ft.id_vigencia = old.id
         and (
           s.data_referencia < timezone('America/Sao_Paulo', new.data_inicio)::date
           or s.data_referencia > timezone('America/Sao_Paulo', new.data_fim)::date
         )
     ) then
    raise exception 'Há avisos do filho fora do novo período da vigência';
  end if;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.marco_recompensa_estrelas_interno(p_id_usuario_pai bigint, p_id_filho bigint, p_id_recompensa bigint)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(
    (
      select rr.total_estrelas_no_resgate
      from public.t_recompensa_resgate rr
      where rr.id_usuario_pai = p_id_usuario_pai
        and rr.id_filho = p_id_filho
        and rr.id_recompensa = p_id_recompensa
        and rr.status = 'ENTREGUE'
        and rr.total_estrelas_no_resgate is not null
      order by rr.entregue_em desc nulls last, rr.id desc
      limit 1
    ),
    (
      select r.marco_inicial_estrelas
      from public.t_recompensa_estrela r
      where r.id = p_id_recompensa
        and r.id_usuario_pai = p_id_usuario_pai
        and r.id_filho = p_id_filho
    ),
    0
  )::integer;
$function$
;
CREATE OR REPLACE FUNCTION public.montar_painel_app_filho(p_id_usuario_pai bigint, p_id_filho bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_painel jsonb;
  v_estrelas jsonb;
  v_solicitacoes jsonb;
  v_comunicacao jsonb;
  v_hoje date;
begin
  v_painel := public.montar_painel_filho(p_id_usuario_pai, p_id_filho);

  if v_painel is null then
    return null;
  end if;

  v_estrelas := public.resumo_estrelas_filho_interno(
    p_id_usuario_pai,
    p_id_filho
  );

  select jsonb_build_object(
    'mensagem_global_ativa', c.mensagem_global_ativa,
    'mensagem_global', c.mensagem_global
  )
  into v_comunicacao
  from public.t_app_config c
  where c.id = 1;

  v_hoje := timezone('America/Sao_Paulo', now())::date;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'id_filho_tarefa', s.id_filho_tarefa,
        'data_referencia', s.data_referencia,
        'observacao', s.observacao,
        'status', s.status,
        'created_at', s.created_at,
        'resolvido_em', s.resolvido_em
      )
      order by s.created_at desc
    ),
    '[]'::jsonb
  )
  into v_solicitacoes
  from public.t_solicitacao_tarefa_filho s
  join public.t_filho_tarefa ft
    on ft.id = s.id_filho_tarefa
  where ft.id_usuario_pai = p_id_usuario_pai
    and ft.id_filho = p_id_filho
    and s.data_referencia = v_hoje;

  return v_painel || jsonb_build_object(
    'estrelas',
    coalesce(v_estrelas, jsonb_build_object(
      'hoje', 0,
      'vigencia_atual', 0,
      'saldo', 0,
      'total_conquistado', 0,
      'recompensas', '[]'::jsonb,
      'resgates', '[]'::jsonb
    )),
    'solicitacoes_hoje',
    coalesce(v_solicitacoes, '[]'::jsonb),
    'comunicacao',
    coalesce(v_comunicacao, jsonb_build_object(
      'mensagem_global_ativa', false,
      'mensagem_global', null
    ))
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.montar_painel_filho(p_id_usuario_pai bigint, p_id_filho bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_result jsonb;
begin
  if not exists (
    select 1
    from public.t_filho f
    where f.id = p_id_filho
      and f.id_usuario_pai = p_id_usuario_pai
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'responsavel', jsonb_build_object('nome', p.nome),
    'filho', jsonb_build_object(
      'nome', f.nome,
      'cor', f.cor,
      'avatar', f.avatar,
      'tem_mesada', coalesce(f.tem_mesada_opcional, false) and f.valor_mesada is not null,
      'valor_mesada', f.valor_mesada
    ),
    'vigencias', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'data_inicio', v.data_inicio,
          'data_fim', v.data_fim,
          'qtd_nao_fez', (
            select count(*)::integer
            from public.t_ocorrencia o_count
            join public.t_filho_tarefa ft_count
              on ft_count.id = o_count.id_filho_tarefa
            where ft_count.id_usuario_pai = p_id_usuario_pai
              and ft_count.id_filho = p_id_filho
              and ft_count.id_vigencia = v.id
              and o_count.tipo = 'NAO_FEZ'
          ),
          'qtd_nao_precisou', (
            select count(*)::integer
            from public.t_ocorrencia o_count
            join public.t_filho_tarefa ft_count
              on ft_count.id = o_count.id_filho_tarefa
            where ft_count.id_usuario_pai = p_id_usuario_pai
              and ft_count.id_filho = p_id_filho
              and ft_count.id_vigencia = v.id
              and o_count.tipo = 'NAO_PRECISOU'
          ),
          'tarefas', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', ft.id,
                'nome', t.nome,
                'ocorrencias', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'id', o.id,
                      'tipo', o.tipo,
                      'data', o.created_at,
                      'consequencia',
                        case when c.id is null then null else
                          jsonb_build_object(
                            'tipo', c.tipo,
                            'desconto_valor', c.desconto_valor,
                            'penalidade_descricao', c.penalidade_descricao,
                            'status', c.status,
                            'cumprida_em', c.cumprida_em,
                            'cancelada_em', c.cancelada_em
                          )
                        end
                    )
                    order by o.created_at desc
                  )
                  from public.t_ocorrencia o
                  left join public.t_ocorrencia_consequencia c
                    on c.id_ocorrencia = o.id
                   and c.id_usuario_pai = o.id_usuario_pai
                  where o.id_filho_tarefa = ft.id
                    and o.id_usuario_pai = p_id_usuario_pai
                ), '[]'::jsonb)
              )
              order by t.nome
            )
            from public.t_filho_tarefa ft
            join public.t_tarefa t
              on t.id = ft.id_tarefa
             and t.id_usuario_pai = p_id_usuario_pai
            where ft.id_vigencia = v.id
              and ft.id_filho = p_id_filho
              and ft.id_usuario_pai = p_id_usuario_pai
          ), '[]'::jsonb)
        )
        order by
          case
            when now() between v.data_inicio and v.data_fim then 0
            when now() < v.data_inicio then 1
            else 2
          end,
          case when now() < v.data_inicio then v.data_inicio end asc,
          case when now() > v.data_fim then v.data_inicio end desc,
          v.data_inicio asc
      )
      from public.t_vigencia v
      where v.id_usuario_pai = p_id_usuario_pai
        and exists (
          select 1
          from public.t_filho_tarefa ft
          where ft.id_vigencia = v.id
            and ft.id_filho = p_id_filho
            and ft.id_usuario_pai = p_id_usuario_pai
        )
    ), '[]'::jsonb),
    'atualizado_em', now()
  )
  into v_result
  from public.t_filho f
  join public.t_usuario_pai p on p.id = p_id_usuario_pai
  where f.id = p_id_filho
    and f.id_usuario_pai = p_id_usuario_pai;

  return v_result;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.motivo_bloqueio_desfazer_ocorrencia_interno(p_id_usuario_pai bigint, p_id_ocorrencia bigint)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when exists (
      select 1
      from public.t_ocorrencia_consequencia c
      where c.id_usuario_pai = p_id_usuario_pai
        and c.id_ocorrencia = p_id_ocorrencia
        and c.tipo = 'PENALIDADE'
        and c.status = 'CUMPRIDA'
    )
    then 'PENALIDADE_CUMPRIDA'
    else null
  end;
$function$
;
CREATE OR REPLACE FUNCTION public.proteger_exclusao_recompensa_com_pendencia()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if exists (
    select 1
    from public.t_recompensa_resgate rr
    where rr.id_recompensa = old.id
      and rr.id_usuario_pai = old.id_usuario_pai
      and rr.id_filho = old.id_filho
      and rr.status = 'PENDENTE'
  ) then
    raise exception 'Esta recompensa está conquistada e aguardando confirmação; conclua o ciclo antes de excluir';
  end if;

  return old;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.proteger_marco_inicial_recompensa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.marco_inicial_estrelas is distinct from old.marco_inicial_estrelas then
    raise exception 'O marco inicial da recompensa é imutável';
  end if;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.proteger_resgate_estrela_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' then
    if new.id_recompensa is null
       or not exists (
         select 1
         from public.t_recompensa_estrela r
         where r.id = new.id_recompensa
           and r.id_usuario_pai = new.id_usuario_pai
           and r.id_filho = new.id_filho
       ) then
      raise exception 'Recompensa do ciclo inválida';
    end if;

    if new.status <> 'PENDENTE' then
      raise exception 'Novo ciclo de recompensa deve iniciar como PENDENTE';
    end if;

    if new.meta_estrelas_no_resgate is null
       or new.total_estrelas_no_resgate is null then
      raise exception 'Ciclo de recompensa exige snapshot da meta e do total de estrelas';
    end if;

    if new.estrelas_utilizadas <> new.meta_estrelas_no_resgate then
      raise exception 'Meta histórica da recompensa inconsistente';
    end if;

    if new.entregue_em is not null
       or new.cancelado_em is not null
       or new.confirmado_por is not null then
      raise exception 'Novo ciclo não pode nascer concluído, cancelado ou confirmado';
    end if;

    return new;
  end if;

  if new.id_recompensa is distinct from old.id_recompensa then
    if not (
      old.id_recompensa is not null
      and new.id_recompensa is null
      and old.status <> 'PENDENTE'
      and new.status = old.status
    ) then
      raise exception 'Referência da recompensa do ciclo é imutável';
    end if;
  end if;

  if new.id_usuario_pai is distinct from old.id_usuario_pai
     or new.id_filho is distinct from old.id_filho
     or new.recompensa_nome is distinct from old.recompensa_nome
     or new.recompensa_descricao_no_resgate is distinct from old.recompensa_descricao_no_resgate
     or new.estrelas_utilizadas is distinct from old.estrelas_utilizadas
     or new.meta_estrelas_no_resgate is distinct from old.meta_estrelas_no_resgate
     or new.created_at is distinct from old.created_at then
    raise exception 'Snapshot da recompensa é imutável';
  end if;

  if new.total_estrelas_no_resgate is distinct from old.total_estrelas_no_resgate then
    if old.status <> 'PENDENTE'
       or new.status <> 'ENTREGUE'
       or new.total_estrelas_no_resgate is null
       or new.total_estrelas_no_resgate < old.total_estrelas_no_resgate then
      raise exception 'Marco de estrelas da recompensa só pode avançar na conclusão do ciclo';
    end if;
  end if;

  if new.confirmado_por is distinct from old.confirmado_por then
    if old.status <> 'PENDENTE'
       or new.status <> 'ENTREGUE'
       or old.confirmado_por is not null
       or new.confirmado_por not in ('FILHO', 'RESPONSAVEL') then
      raise exception 'Origem da confirmação só pode ser definida na conclusão do ciclo';
    end if;
  end if;

  if old.status <> 'PENDENTE' and new.status is distinct from old.status then
    raise exception 'Ciclo de recompensa finalizado não pode mudar de status';
  end if;

  if new.status = 'PENDENTE' then
    if new.entregue_em is not null
       or new.cancelado_em is not null
       or new.confirmado_por is not null then
      raise exception 'Ciclo pendente não pode possuir conclusão, cancelamento ou confirmação';
    end if;
  elsif new.status = 'ENTREGUE' then
    if new.entregue_em is null or new.cancelado_em is not null then
      raise exception 'Ciclo concluído exige data de conclusão e não pode estar cancelado';
    end if;

    if old.status = 'PENDENTE' and new.confirmado_por is null then
      raise exception 'Ciclo concluído exige origem da confirmação';
    end if;
  elsif new.status = 'CANCELADO' then
    if new.cancelado_em is null
       or new.entregue_em is not null
       or new.confirmado_por is not null then
      raise exception 'Ciclo cancelado exige data de cancelamento e não pode estar concluído ou confirmado';
    end if;
  else
    raise exception 'Status de ciclo de recompensa inválido';
  end if;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.reconciliar_ocorrencia(p_acao text, p_id_ocorrencia bigint DEFAULT NULL::bigint, p_id_filho_tarefa bigint DEFAULT NULL::bigint, p_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_novo_tipo text DEFAULT NULL::text, p_consequencia_tipo text DEFAULT NULL::text, p_desconto_valor numeric DEFAULT NULL::numeric, p_penalidade_descricao text DEFAULT NULL::text, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_pai_id bigint;
  v_id_ocorrencia bigint;
  v_id_filho_tarefa bigint;
  v_id_filho bigint;
  v_id_vigencia bigint;
  v_id_tarefa bigint;
  v_tem_mesada boolean;
  v_valor_mesada numeric;
  v_created_at timestamptz;
  v_created_at_original timestamptz;
  v_tipo_anterior text;
  v_estado_anterior jsonb;
  v_estado_novo jsonb;
  v_conseq_anterior jsonb;
  v_conseq_nova jsonb;
  v_contador integer;
  v_acao text;
  v_novo_tipo text;
  v_consequencia text;
  v_desconto_efetivo numeric;
  v_penalidade_efetiva text;
  v_data date;
begin
  v_acao := upper(btrim(coalesce(p_acao, '')));
  if v_acao not in ('SALVAR','DESFAZER','CUMPRIR_PENALIDADE') then
    raise exception 'Ação de reconciliação inválida';
  end if;

  select p.id
    into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  if p_id_ocorrencia is not null then
    select
      o.id,
      o.id_filho_tarefa,
      o.created_at,
      o.created_at,
      o.tipo,
      jsonb_build_object(
        'id', o.id,
        'id_filho_tarefa', o.id_filho_tarefa,
        'tipo', o.tipo,
        'created_at', o.created_at
      )
    into
      v_id_ocorrencia,
      v_id_filho_tarefa,
      v_created_at,
      v_created_at_original,
      v_tipo_anterior,
      v_estado_anterior
    from public.t_ocorrencia o
    where o.id = p_id_ocorrencia
      and o.id_usuario_pai = v_pai_id
    for update;

    if v_id_ocorrencia is null then
      raise exception 'Ocorrência não encontrada';
    end if;
  else
    v_id_filho_tarefa := p_id_filho_tarefa;
    v_created_at := coalesce(p_created_at, now());
  end if;

  if p_id_filho_tarefa is not null
     and v_id_filho_tarefa is distinct from p_id_filho_tarefa then
    raise exception 'Não é permitido mover uma ocorrência para outra atribuição';
  end if;

  if v_id_filho_tarefa is null then
    raise exception 'Informe a atribuição';
  end if;

  if v_id_ocorrencia is not null
     and p_created_at is not null
     and timezone('America/Sao_Paulo', p_created_at)::date
         is distinct from timezone('America/Sao_Paulo', v_created_at_original)::date then
    raise exception 'Para mudar a data, desfaça a marcação e registre uma nova ocorrência';
  end if;

  if p_created_at is not null then
    v_created_at := p_created_at;
  end if;

  v_data := timezone('America/Sao_Paulo', v_created_at)::date;

  select
    ft.id_filho,
    ft.id_vigencia,
    ft.id_tarefa,
    coalesce(f.tem_mesada_opcional, false) and f.valor_mesada is not null,
    f.valor_mesada
  into
    v_id_filho,
    v_id_vigencia,
    v_id_tarefa,
    v_tem_mesada,
    v_valor_mesada
  from public.t_filho_tarefa ft
  join public.t_filho f
    on f.id = ft.id_filho
   and f.id_usuario_pai = ft.id_usuario_pai
  where ft.id = v_id_filho_tarefa
    and ft.id_usuario_pai = v_pai_id
  for key share of ft, f;

  if v_id_filho is null then
    raise exception 'Atribuição não encontrada para este responsável';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_id_filho_tarefa::text || ':' || v_data::text,
      0
    )
  );

  if v_id_ocorrencia is not null then
    select jsonb_build_object(
      'tipo', c.tipo,
      'desconto_valor', c.desconto_valor,
      'penalidade_descricao', c.penalidade_descricao,
      'status', c.status,
      'cumprida_em', c.cumprida_em,
      'cancelada_em', c.cancelada_em
    )
    into v_conseq_anterior
    from public.t_ocorrencia_consequencia c
    where c.id_ocorrencia = v_id_ocorrencia
      and c.id_usuario_pai = v_pai_id
    for update;
  end if;

  -- Penalidade cumprida consolida o resultado como histórico imutável.
  if v_id_ocorrencia is not null
     and v_conseq_anterior->>'tipo' = 'PENALIDADE'
     and v_conseq_anterior->>'status' = 'CUMPRIDA'
     and v_acao in ('SALVAR','DESFAZER') then
    raise exception 'Não é possível alterar este resultado porque a penalidade já foi cumprida';
  end if;

  if v_acao = 'CUMPRIR_PENALIDADE' then
    if v_id_ocorrencia is null then
      raise exception 'Informe a ocorrência da penalidade';
    end if;

    update public.t_ocorrencia_consequencia
    set status = 'CUMPRIDA',
        cumprida_em = coalesce(cumprida_em, now()),
        cancelada_em = null,
        updated_at = now()
    where id_usuario_pai = v_pai_id
      and id_ocorrencia = v_id_ocorrencia
      and tipo = 'PENALIDADE'
      and status = 'PENDENTE';

    if not found then
      raise exception 'Penalidade pendente não encontrada';
    end if;

  elsif v_acao = 'DESFAZER' then
    if v_id_ocorrencia is null then
      raise exception 'Informe a ocorrência a desfazer';
    end if;

    delete from public.t_estrela_concessao
    where id_usuario_pai = v_pai_id
      and id_ocorrencia_origem = v_id_ocorrencia;

    delete from public.t_ocorrencia
    where id = v_id_ocorrencia
      and id_usuario_pai = v_pai_id;

    perform public.reconciliar_recompensas_estrelas_filho_interno(
      v_pai_id,
      v_id_filho
    );

    insert into public.t_ocorrencia_reconciliacao (
      id_usuario_pai, id_ocorrencia, id_filho_tarefa, acao, origem,
      estado_anterior, estado_novo, motivo
    ) values (
      v_pai_id, v_id_ocorrencia, v_id_filho_tarefa, 'DESFAZER',
      'RESPONSAVEL',
      v_estado_anterior || jsonb_build_object('consequencia', v_conseq_anterior),
      null,
      nullif(btrim(coalesce(p_motivo,'')), '')
    );

    v_contador := public.contar_nao_fez_filho_vigencia(
      v_id_filho,
      v_id_vigencia
    );

    return jsonb_build_object(
      'ok', true,
      'acao', 'DESFAZER',
      'id_ocorrencia', v_id_ocorrencia,
      'id_filho', v_id_filho,
      'id_vigencia', v_id_vigencia,
      'contador_nao_fez_vigencia', v_contador
    );

  else
    v_novo_tipo := upper(btrim(coalesce(p_novo_tipo, '')));
    if v_novo_tipo not in ('FEZ','NAO_FEZ','NAO_PRECISOU') then
      raise exception 'Tipo de ocorrência inválido';
    end if;

    if v_novo_tipo in ('FEZ','NAO_PRECISOU') then
      if p_consequencia_tipo is not null
         or p_desconto_valor is not null
         or nullif(btrim(coalesce(p_penalidade_descricao,'')), '') is not null then
        raise exception 'Este resultado não pode receber consequência de Não fez';
      end if;

    else
      if p_consequencia_tipo is null
         and v_id_ocorrencia is not null
         and v_tipo_anterior = 'NAO_FEZ' then
        if v_conseq_anterior is null then
          v_consequencia := 'NENHUMA';
        else
          v_consequencia := upper(v_conseq_anterior->>'tipo');
          v_desconto_efetivo := nullif(v_conseq_anterior->>'desconto_valor','')::numeric;
          v_penalidade_efetiva := nullif(v_conseq_anterior->>'penalidade_descricao','');
        end if;
      else
        v_consequencia := upper(btrim(coalesce(p_consequencia_tipo, 'NENHUMA')));
        v_desconto_efetivo := p_desconto_valor;
        v_penalidade_efetiva := nullif(btrim(coalesce(p_penalidade_descricao,'')), '');
      end if;

      if v_consequencia not in ('NENHUMA','DESCONTO','PENALIDADE') then
        raise exception 'Consequência do Não fez inválida';
      end if;

      if v_consequencia = 'DESCONTO' then
        if not v_tem_mesada then
          raise exception 'Desconto de mesada só pode ser aplicado a filho com mesada cadastrada';
        end if;

        if v_desconto_efetivo is null or v_desconto_efetivo <= 0 then
          raise exception 'Informe um valor de desconto válido';
        end if;

      elsif v_consequencia = 'PENALIDADE' then
        if v_penalidade_efetiva is null
           or char_length(v_penalidade_efetiva) not between 2 and 200 then
          raise exception 'Informe uma penalidade entre 2 e 200 caracteres';
        end if;
      end if;
    end if;

    if v_id_ocorrencia is null then
      insert into public.t_ocorrencia (
        id_usuario_pai,
        id_filho_tarefa,
        tipo,
        created_at
      )
      values (
        v_pai_id,
        v_id_filho_tarefa,
        v_novo_tipo,
        v_created_at
      )
      returning id, created_at
        into v_id_ocorrencia, v_created_at;

      v_estado_anterior := null;
      v_tipo_anterior := null;
    else
      update public.t_ocorrencia
      set tipo = v_novo_tipo,
          created_at = v_created_at
      where id = v_id_ocorrencia
        and id_usuario_pai = v_pai_id;
    end if;


    if v_novo_tipo in ('FEZ','NAO_PRECISOU') then
      update public.t_ocorrencia_consequencia
      set status =
            case
              when tipo='DESCONTO' and status='APLICADO' then 'ESTORNADO'
              when tipo='PENALIDADE' and status = 'PENDENTE' then 'CANCELADA'
              else status
            end,
          cancelada_em =
            case
              when tipo='PENALIDADE' and status = 'PENDENTE' then now()
              else cancelada_em
            end,
          updated_at = now()
      where id_usuario_pai = v_pai_id
        and id_ocorrencia = v_id_ocorrencia;

    elsif v_consequencia = 'NENHUMA' then
      delete from public.t_ocorrencia_consequencia
      where id_usuario_pai = v_pai_id
        and id_ocorrencia = v_id_ocorrencia;

    elsif v_consequencia = 'DESCONTO' then
      insert into public.t_ocorrencia_consequencia (
        id_usuario_pai,
        id_ocorrencia,
        tipo,
        desconto_valor,
        penalidade_descricao,
        status,
        cumprida_em,
        cancelada_em
      )
      values (
        v_pai_id,
        v_id_ocorrencia,
        'DESCONTO',
        v_desconto_efetivo,
        null,
        'APLICADO',
        null,
        null
      )
      on conflict (id_ocorrencia) do update
      set tipo = 'DESCONTO',
          desconto_valor = excluded.desconto_valor,
          penalidade_descricao = null,
          status = 'APLICADO',
          cumprida_em = null,
          cancelada_em = null,
          updated_at = now();

    else
      if p_consequencia_tipo is null
         and v_tipo_anterior = 'NAO_FEZ'
         and v_conseq_anterior->>'tipo' = 'PENALIDADE'
         and v_conseq_anterior->>'status' = 'CUMPRIDA' then
        null;
      else
        insert into public.t_ocorrencia_consequencia (
          id_usuario_pai,
          id_ocorrencia,
          tipo,
          desconto_valor,
          penalidade_descricao,
          status,
          cumprida_em,
          cancelada_em
        )
        values (
          v_pai_id,
          v_id_ocorrencia,
          'PENALIDADE',
          null,
          v_penalidade_efetiva,
          'PENDENTE',
          null,
          null
        )
        on conflict (id_ocorrencia) do update
        set tipo = 'PENALIDADE',
            desconto_valor = null,
            penalidade_descricao = excluded.penalidade_descricao,
            status = 'PENDENTE',
            cumprida_em = null,
            cancelada_em = null,
            updated_at = now();
      end if;
    end if;

    update public.t_solicitacao_tarefa_filho s
    set status = case
          when v_novo_tipo='FEZ' then 'RESOLVIDA_FEZ'
          when v_novo_tipo='NAO_PRECISOU' then 'RESOLVIDA_NAO_PRECISOU'
          else 'RESOLVIDA_NAO_FEZ'
        end,
        resolvido_em = now()
    where s.id_filho_tarefa = v_id_filho_tarefa
      and s.data_referencia = v_data
      and s.status = 'PENDENTE';

    perform public.sincronizar_estrela_ocorrencia_interno(
      v_pai_id,
      v_id_ocorrencia
    );

    perform public.reconciliar_recompensas_estrelas_filho_interno(
      v_pai_id,
      v_id_filho
    );
  end if;

  select jsonb_build_object(
    'id', o.id,
    'id_filho_tarefa', o.id_filho_tarefa,
    'tipo', o.tipo,
    'created_at', o.created_at
  )
  into v_estado_novo
  from public.t_ocorrencia o
  where o.id = v_id_ocorrencia;

  select jsonb_build_object(
    'tipo', c.tipo,
    'desconto_valor', c.desconto_valor,
    'penalidade_descricao', c.penalidade_descricao,
    'status', c.status,
    'cumprida_em', c.cumprida_em,
    'cancelada_em', c.cancelada_em
  )
  into v_conseq_nova
  from public.t_ocorrencia_consequencia c
  where c.id_ocorrencia = v_id_ocorrencia
    and c.id_usuario_pai = v_pai_id;

  insert into public.t_ocorrencia_reconciliacao (
    id_usuario_pai,
    id_ocorrencia,
    id_filho_tarefa,
    acao,
    origem,
    estado_anterior,
    estado_novo,
    motivo
  )
  values (
    v_pai_id,
    v_id_ocorrencia,
    v_id_filho_tarefa,
    case
      when v_acao='CUMPRIR_PENALIDADE' then 'CUMPRIR_PENALIDADE'
      when v_estado_anterior is null then 'CRIAR'
      else 'ALTERAR'
    end,
    'RESPONSAVEL',
    case
      when v_estado_anterior is null then null
      else v_estado_anterior || jsonb_build_object('consequencia', v_conseq_anterior)
    end,
    v_estado_novo || jsonb_build_object('consequencia', v_conseq_nova),
    nullif(btrim(coalesce(p_motivo,'')), '')
  );

  v_contador := public.contar_nao_fez_filho_vigencia(
    v_id_filho,
    v_id_vigencia
  );

  return jsonb_build_object(
    'ok', true,
    'acao', v_acao,
    'id_ocorrencia', v_id_ocorrencia,
    'id_filho', v_id_filho,
    'id_vigencia', v_id_vigencia,
    'contador_nao_fez_vigencia', v_contador,
    'ocorrencia', v_estado_novo,
    'consequencia', v_conseq_nova,
    'estrelas', public.resumo_estrelas_filho_interno(v_pai_id, v_id_filho)
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.reconciliar_recompensas_estrelas_filho_interno(p_id_usuario_pai bigint, p_id_filho bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_total integer;
  v_marco integer;
  v_ciclo record;
begin
  perform 1
  from public.t_filho f
  where f.id = p_id_filho
    and f.id_usuario_pai = p_id_usuario_pai
  for update;

  if not found then
    return;
  end if;

  v_total := public.estrelas_total_conquistado_interno(
    p_id_usuario_pai,
    p_id_filho
  );

  for v_ciclo in
    select
      rr.id,
      rr.id_recompensa,
      coalesce(rr.meta_estrelas_no_resgate, rr.estrelas_utilizadas) as meta
    from public.t_recompensa_resgate rr
    where rr.id_usuario_pai = p_id_usuario_pai
      and rr.id_filho = p_id_filho
      and rr.status = 'PENDENTE'
    order by rr.id
    for update
  loop
    v_marco := public.marco_recompensa_estrelas_interno(
      p_id_usuario_pai,
      p_id_filho,
      v_ciclo.id_recompensa
    );

    if greatest(v_total - v_marco, 0) < v_ciclo.meta then
      update public.t_recompensa_resgate
      set status = 'CANCELADO',
          cancelado_em = now(),
          entregue_em = null,
          confirmado_por = null,
          updated_at = now()
      where id = v_ciclo.id
        and status = 'PENDENTE';
    end if;
  end loop;

  perform public.garantir_conquista_recompensa_estrelas_interno(
    p_id_usuario_pai,
    p_id_filho,
    null
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.resumo_estrelas_filho_interno(p_id_usuario_pai bigint, p_id_filho bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_total integer;
  v_hoje integer;
  v_vigencia_id bigint;
  v_vigencia integer;
  v_recompensas jsonb;
  v_resgates jsonb;
begin
  if not exists (
    select 1 from public.t_filho f
    where f.id = p_id_filho and f.id_usuario_pai = p_id_usuario_pai
  ) then
    return null;
  end if;

  v_total := public.estrelas_total_conquistado_interno(p_id_usuario_pai, p_id_filho);

  -- Estrelas do dia são mérito já concedido e não dependem da ocorrência continuar existindo.
  select count(*)::integer into v_hoje
  from public.t_estrela_concessao ec
  where ec.id_usuario_pai = p_id_usuario_pai
    and ec.id_filho = p_id_filho
    and ec.data_referencia = timezone('America/Sao_Paulo', now())::date;

  select v.id into v_vigencia_id
  from public.t_vigencia v
  where v.id_usuario_pai = p_id_usuario_pai
    and now() between v.data_inicio and v.data_fim
    and exists (
      select 1 from public.t_filho_tarefa ft
      where ft.id_usuario_pai = p_id_usuario_pai
        and ft.id_filho = p_id_filho
        and ft.id_vigencia = v.id
    )
  order by v.data_inicio desc
  limit 1;

  if v_vigencia_id is null then
    v_vigencia := 0;
  else
    -- Mesma regra para a vigência: conta concessões permanentes daquela vigência.
    select count(*)::integer into v_vigencia
    from public.t_estrela_concessao ec
    where ec.id_usuario_pai = p_id_usuario_pai
      and ec.id_filho = p_id_filho
      and ec.id_vigencia = v_vigencia_id;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'nome', r.nome,
        'descricao', r.descricao,
        'nome_exibicao', r.nome,
        'descricao_exibicao', r.descricao,
        'estrelas_necessarias', r.estrelas_necessarias,
        'progresso', x.progresso,
        'faltam', greatest(r.estrelas_necessarias - x.progresso, 0),
        'disponivel', (not x.tem_pendente and x.progresso >= r.estrelas_necessarias),
        'pendente', x.tem_pendente,
        'conquistada', (x.tem_pendente or x.progresso >= r.estrelas_necessarias),
        'meta_exibicao',
          case
            when x.tem_pendente then coalesce(x.pendente_meta, r.estrelas_necessarias)
            else r.estrelas_necessarias
          end,
        'progresso_exibicao',
          case
            when x.tem_pendente then coalesce(x.pendente_meta, r.estrelas_necessarias)
            when x.progresso >= r.estrelas_necessarias then r.estrelas_necessarias
            else least(x.progresso, r.estrelas_necessarias)
          end,
        'faltam_exibicao',
          case
            when x.tem_pendente or x.progresso >= r.estrelas_necessarias then 0
            else greatest(r.estrelas_necessarias - x.progresso, 0)
          end,
        'pode_editar', (not x.tem_pendente),
        'pode_excluir', (not x.tem_pendente),
        'pode_desativar', (not x.tem_pendente),
        'pode_confirmar_aproveitada', x.tem_pendente,
        'marco_estrelas', x.marco_estrelas,
        'conquista_id', x.pendente_id,
        'conquista_nome', x.pendente_nome,
        'conquista_descricao', x.pendente_descricao,
        'conquista_meta', x.pendente_meta
      )
      order by r.estrelas_necessarias, r.nome
    ),
    '[]'::jsonb
  ) into v_recompensas
  from public.t_recompensa_estrela r
  cross join lateral (
    select
      greatest(
        v_total - public.marco_recompensa_estrelas_interno(
          p_id_usuario_pai,
          p_id_filho,
          r.id
        ),
        0
      )::integer as progresso,
      public.marco_recompensa_estrelas_interno(
        p_id_usuario_pai,
        p_id_filho,
        r.id
      )::integer as marco_estrelas,
      (p.id is not null) as tem_pendente,
      exists (
        select 1
        from public.t_recompensa_resgate rr_hist
        where rr_hist.id_usuario_pai = p_id_usuario_pai
          and rr_hist.id_filho = p_id_filho
          and rr_hist.id_recompensa = r.id
      ) as tem_historico,
      p.id as pendente_id,
      p.recompensa_nome as pendente_nome,
      p.recompensa_descricao_no_resgate as pendente_descricao,
      coalesce(p.meta_estrelas_no_resgate, p.estrelas_utilizadas) as pendente_meta
    from (
      select rr.id, rr.recompensa_nome, rr.recompensa_descricao_no_resgate,
             rr.meta_estrelas_no_resgate, rr.estrelas_utilizadas
      from public.t_recompensa_resgate rr
      where rr.id_usuario_pai = p_id_usuario_pai
        and rr.id_filho = p_id_filho
        and rr.id_recompensa = r.id
        and rr.status = 'PENDENTE'
      order by rr.created_at desc, rr.id desc
      limit 1
    ) p
    right join (select 1 as chave) base on true
  ) x
  where r.id_usuario_pai = p_id_usuario_pai
    and r.id_filho = p_id_filho
    and r.ativo = true;

  select coalesce(jsonb_agg(x.item order by x.ordem desc), '[]'::jsonb)
    into v_resgates
  from (
    select rr.created_at as ordem,
      jsonb_build_object(
        'id', rr.id,
        'id_recompensa', rr.id_recompensa,
        -- Snapshot tecnico preservado para auditoria/compatibilidade.
        'recompensa_nome', rr.recompensa_nome,
        'recompensa_descricao_no_resgate', rr.recompensa_descricao_no_resgate,
        'estrelas_utilizadas', rr.estrelas_utilizadas,
        'meta_estrelas_no_resgate', coalesce(rr.meta_estrelas_no_resgate, rr.estrelas_utilizadas),
        'total_estrelas_no_resgate', rr.total_estrelas_no_resgate,
        -- Contrato semantico consumido pelas telas.
        'nome_exibicao',
          case when r.id is not null then r.nome else rr.recompensa_nome end,
        'descricao_exibicao',
          case when r.id is not null then r.descricao else rr.recompensa_descricao_no_resgate end,
        'quantidade_estrelas_conquista',
          coalesce(rr.meta_estrelas_no_resgate, rr.estrelas_utilizadas),
        'conquistou_em', rr.created_at,
        'aproveitou_em',
          case when rr.status = 'ENTREGUE' then rr.entregue_em else null end,
        'contagem_recomecou_em',
          case when rr.status = 'ENTREGUE' then rr.entregue_em else null end,
        'confirmado_por', rr.confirmado_por,
        'status', rr.status,
        'created_at', rr.created_at,
        'entregue_em', rr.entregue_em,
        'cancelado_em', rr.cancelado_em
      ) as item
    from public.t_recompensa_resgate rr
    left join public.t_recompensa_estrela r
      on r.id = rr.id_recompensa
     and r.id_usuario_pai = rr.id_usuario_pai
     and r.id_filho = rr.id_filho
    where rr.id_usuario_pai = p_id_usuario_pai
      and rr.id_filho = p_id_filho
    order by rr.created_at desc
    limit 20
  ) x;

  return jsonb_build_object(
    'hoje', v_hoje,
    'vigencia_atual', v_vigencia,
    'saldo', v_total,
    'total_conquistado', v_total,
    'recompensas', v_recompensas,
    'resgates', v_resgates
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.salvar_recompensa_estrelas(p_id_filho bigint, p_nome text, p_descricao text, p_estrelas_necessarias integer, p_id_recompensa bigint DEFAULT NULL::bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_pai_id bigint;
  v_id bigint;
  v_nome text;
  v_descricao text;
  v_marco_inicial integer;
begin
  select p.id into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then raise exception 'Responsável não encontrado'; end if;

  perform 1
  from public.t_filho f
  where f.id = p_id_filho
    and f.id_usuario_pai = v_pai_id
  for update;

  if not found then raise exception 'Filho não encontrado para este responsável'; end if;

  v_nome := btrim(coalesce(p_nome, ''));
  v_descricao := nullif(btrim(coalesce(p_descricao, '')), '');

  if char_length(v_nome) < 2 or char_length(v_nome) > 100 then
    raise exception 'Informe uma recompensa entre 2 e 100 caracteres';
  end if;
  if v_descricao is not null and char_length(v_descricao) > 300 then
    raise exception 'A descrição da recompensa deve ter no máximo 300 caracteres';
  end if;
  if p_estrelas_necessarias is null or p_estrelas_necessarias < 1 or p_estrelas_necessarias > 100000 then
    raise exception 'Informe uma quantidade válida de estrelas';
  end if;

  if p_id_recompensa is null then
    v_marco_inicial := public.estrelas_total_conquistado_interno(
      v_pai_id,
      p_id_filho
    );

    insert into public.t_recompensa_estrela (
      id_usuario_pai,
      id_filho,
      nome,
      descricao,
      estrelas_necessarias,
      marco_inicial_estrelas,
      ativo
    )
    values (
      v_pai_id,
      p_id_filho,
      v_nome,
      v_descricao,
      p_estrelas_necessarias,
      v_marco_inicial,
      true
    )
    returning id into v_id;
  else
    perform 1
    from public.t_recompensa_estrela r
    where r.id = p_id_recompensa
      and r.id_usuario_pai = v_pai_id
      and r.id_filho = p_id_filho
    for update;

    if not found then
      raise exception 'Recompensa não encontrada';
    end if;

    if exists (
      select 1
      from public.t_recompensa_resgate rr
      where rr.id_usuario_pai = v_pai_id
        and rr.id_filho = p_id_filho
        and rr.id_recompensa = p_id_recompensa
        and rr.status = 'PENDENTE'
    ) then
      raise exception 'A recompensa conquistada não pode ser editada antes de ser marcada como aproveitada';
    end if;

    update public.t_recompensa_estrela
    set nome = v_nome,
        descricao = v_descricao,
        estrelas_necessarias = p_estrelas_necessarias,
        updated_at = now()
    where id = p_id_recompensa
      and id_usuario_pai = v_pai_id
      and id_filho = p_id_filho
    returning id into v_id;

    if v_id is null then raise exception 'Recompensa não encontrada'; end if;
  end if;

  perform public.garantir_conquista_recompensa_estrelas_interno(
    v_pai_id,
    p_id_filho,
    v_id
  );

  return v_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.sincronizar_estrela_ocorrencia_interno(p_id_usuario_pai bigint, p_id_ocorrencia bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tipo text;
  v_filho_id bigint;
  v_vigencia_id bigint;
  v_tarefa_id bigint;
  v_filho_tarefa_id bigint;
  v_tarefa_nome text;
  v_data date;
begin
  select
    o.tipo,
    ft.id_filho,
    ft.id_vigencia,
    ft.id_tarefa,
    ft.id,
    t.nome,
    timezone('America/Sao_Paulo', o.created_at)::date
  into
    v_tipo,
    v_filho_id,
    v_vigencia_id,
    v_tarefa_id,
    v_filho_tarefa_id,
    v_tarefa_nome,
    v_data
  from public.t_ocorrencia o
  join public.t_filho_tarefa ft
    on ft.id = o.id_filho_tarefa
   and ft.id_usuario_pai = o.id_usuario_pai
  join public.t_tarefa t
    on t.id = ft.id_tarefa
   and t.id_usuario_pai = ft.id_usuario_pai
  where o.id = p_id_ocorrencia
    and o.id_usuario_pai = p_id_usuario_pai;

  if v_tipo is null or v_tipo <> 'FEZ' then
    delete from public.t_estrela_concessao c
    where c.id_usuario_pai = p_id_usuario_pai
      and c.id_ocorrencia_origem = p_id_ocorrencia;
    return;
  end if;

  insert into public.t_estrela_concessao (
    id_usuario_pai,
    id_filho,
    id_vigencia,
    id_tarefa,
    id_filho_tarefa_origem,
    id_ocorrencia_origem,
    tarefa_nome_snapshot,
    data_referencia,
    created_at
  )
  values (
    p_id_usuario_pai,
    v_filho_id,
    v_vigencia_id,
    v_tarefa_id,
    v_filho_tarefa_id,
    p_id_ocorrencia,
    v_tarefa_nome,
    v_data,
    now()
  )
  on conflict do nothing;
end;
$function$
;
CREATE TRIGGER trg_proteger_exclusao_recompensa_com_pendencia BEFORE DELETE ON public.t_recompensa_estrela FOR EACH ROW EXECUTE FUNCTION proteger_exclusao_recompensa_com_pendencia();
CREATE TRIGGER trg_proteger_marco_inicial_recompensa BEFORE UPDATE OF marco_inicial_estrelas ON public.t_recompensa_estrela FOR EACH ROW EXECUTE FUNCTION proteger_marco_inicial_recompensa();
CREATE TRIGGER guard_validity_history_before_change BEFORE DELETE OR UPDATE OF data_inicio, data_fim ON public.t_vigencia FOR EACH ROW EXECUTE FUNCTION guard_validity_history();
create policy "ocorrencia_consequencia_select_own" on public."t_ocorrencia_consequencia" as PERMISSIVE for SELECT to "public" using ((id_usuario_pai = current_pai_id()));
create policy "ocorrencia_reconciliacao_select_own" on public."t_ocorrencia_reconciliacao" as PERMISSIVE for SELECT to "public" using ((id_usuario_pai = current_pai_id()));
revoke all on function public.sincronizar_estrela_ocorrencia_interno(bigint,bigint) from public,anon,authenticated,service_role;
revoke all on function public.reconciliar_recompensas_estrelas_filho_interno(bigint,bigint) from public,anon,authenticated,service_role;
revoke all on function public.proteger_exclusao_recompensa_com_pendencia() from public,anon,authenticated,service_role;
revoke all on function public.marco_recompensa_estrelas_interno(bigint,bigint,bigint) from public,anon,authenticated,service_role;
revoke all on function public.proteger_marco_inicial_recompensa() from public,anon,authenticated,service_role;
revoke all on function public.contar_nao_fez_filho_vigencia(bigint,bigint) from public,anon,authenticated,service_role;
grant execute on function public.contar_nao_fez_filho_vigencia(bigint,bigint) to "anon";
grant execute on function public.contar_nao_fez_filho_vigencia(bigint,bigint) to "authenticated";
grant execute on function public.contar_nao_fez_filho_vigencia(bigint,bigint) to "service_role";
revoke all on function public.duplicar_vigencia_com_atribuicoes(bigint,timestamp with time zone,timestamp with time zone) from public,anon,authenticated,service_role;
grant execute on function public.duplicar_vigencia_com_atribuicoes(bigint,timestamp with time zone,timestamp with time zone) to "anon";
grant execute on function public.duplicar_vigencia_com_atribuicoes(bigint,timestamp with time zone,timestamp with time zone) to "authenticated";
grant execute on function public.duplicar_vigencia_com_atribuicoes(bigint,timestamp with time zone,timestamp with time zone) to "service_role";
revoke all on function public.motivo_bloqueio_desfazer_ocorrencia_interno(bigint,bigint) from public,anon,authenticated,service_role;
revoke all on function public.desfazer_ocorrencias(bigint[]) from public,anon,authenticated,service_role;
grant execute on function public.desfazer_ocorrencias(bigint[]) to "authenticated";
revoke all on function public.reconciliar_ocorrencia(text,bigint,bigint,timestamp with time zone,text,text,numeric,text,text) from public,anon,authenticated,service_role;
grant execute on function public.reconciliar_ocorrencia(text,bigint,bigint,timestamp with time zone,text,text,numeric,text,text) to "authenticated";
revoke all on function public.excluir_recompensa_estrelas(bigint) from public,anon,authenticated,service_role;
grant execute on function public.excluir_recompensa_estrelas(bigint) to "authenticated";
revoke all on function public.guard_solicitacao_tarefa_filho_imutavel() from public,anon,authenticated,service_role;
revoke all on function public.criar_solicitacao_tarefa_filho_interno(text,bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.criar_solicitacao_tarefa_filho_interno(text,bigint,text) to "service_role";
revoke all on function public.montar_painel_app_filho(bigint,bigint) from public,anon,authenticated,service_role;
revoke all on function public.excluir_vigencia_com_regra(bigint) from public,anon,authenticated,service_role;
grant execute on function public.excluir_vigencia_com_regra(bigint) to "authenticated";
revoke all on function public.proteger_resgate_estrela_snapshot() from public,anon,authenticated,service_role;
revoke all on function public.resumo_estrelas_filho_interno(bigint,bigint) from public,anon,authenticated,service_role;
revoke all on function public.garantir_conquista_recompensa_estrelas_interno(bigint,bigint,bigint) from public,anon,authenticated,service_role;
revoke all on function public.concluir_ciclo_recompensa_interno(bigint,bigint,bigint,text) from public,anon,authenticated,service_role;
revoke all on function public.confirmar_recompensa_aproveitada(bigint) from public,anon,authenticated,service_role;
grant execute on function public.confirmar_recompensa_aproveitada(bigint) to "authenticated";
revoke all on function public.concluir_recompensa_filho_interno(text,bigint) from public,anon,authenticated,service_role;
grant execute on function public.concluir_recompensa_filho_interno(text,bigint) to "service_role";
revoke all on function public.salvar_recompensa_estrelas(bigint,text,text,integer,bigint) from public,anon,authenticated,service_role;
grant execute on function public.salvar_recompensa_estrelas(bigint,text,text,integer,bigint) to "authenticated";
revoke all on function public.montar_painel_filho(bigint,bigint) from public,anon,authenticated,service_role;
revoke all on function public.guard_assignment_history() from public,anon,authenticated,service_role;
revoke all on function public.guard_validity_history() from public,anon,authenticated,service_role;
revoke all on function public.guard_occurrence_active_validity() from public,anon,authenticated,service_role;
revoke all on table public."t_ocorrencia_reconciliacao" from public,anon,authenticated,service_role;
grant SELECT,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table public."t_ocorrencia_reconciliacao" to "anon";
grant SELECT,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table public."t_ocorrencia_reconciliacao" to "authenticated";
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table public."t_ocorrencia_reconciliacao" to "service_role";
revoke all on table public."t_ocorrencia_consequencia" from public,anon,authenticated,service_role;
grant SELECT,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table public."t_ocorrencia_consequencia" to "anon";
grant SELECT,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table public."t_ocorrencia_consequencia" to "authenticated";
grant INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN on table public."t_ocorrencia_consequencia" to "service_role";
notify pgrst, 'reload schema';
do $verify$ declare atual text; begin
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_push_dispositivo" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_push_dispositivo') then raise exception 'Registros alterados em t_push_dispositivo'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_app_config" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_app_config') then raise exception 'Registros alterados em t_app_config'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_app_feature_flag" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_app_feature_flag') then raise exception 'Registros alterados em t_app_feature_flag'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_admin_auditoria" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_admin_auditoria') then raise exception 'Registros alterados em t_admin_auditoria'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_push_envio" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_push_envio') then raise exception 'Registros alterados em t_push_envio'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_admin" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_admin') then raise exception 'Registros alterados em t_admin'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_app_telemetria" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_app_telemetria') then raise exception 'Registros alterados em t_app_telemetria'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_app_config_signal" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_app_config_signal') then raise exception 'Registros alterados em t_app_config_signal'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_usuario_pai" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_usuario_pai') then raise exception 'Registros alterados em t_usuario_pai'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_feedback" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_feedback') then raise exception 'Registros alterados em t_feedback'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY['feito','qtd_nao_fez']::text[])::text),'' order by md5((to_jsonb(t) - ARRAY['feito','qtd_nao_fez']::text[])::text)),'')) into atual from public."t_filho_tarefa" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_filho_tarefa') then raise exception 'Registros alterados em t_filho_tarefa'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."app_cron_config" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='app_cron_config') then raise exception 'Registros alterados em app_cron_config'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY['bonificacao_tipo','bonificacao_descricao','bonificacao_valor']::text[])::text),'' order by md5((to_jsonb(t) - ARRAY['bonificacao_tipo','bonificacao_descricao','bonificacao_valor']::text[])::text)),'')) into atual from public."t_ocorrencia" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_ocorrencia') then raise exception 'Registros alterados em t_ocorrencia'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_filho" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_filho') then raise exception 'Registros alterados em t_filho'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_filho_acesso_publico" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_filho_acesso_publico') then raise exception 'Registros alterados em t_filho_acesso_publico'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_tarefa" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_tarefa') then raise exception 'Registros alterados em t_tarefa'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY['penalidade','qtd_ocorrencia','tipo_penalidade','valor_debito']::text[])::text),'' order by md5((to_jsonb(t) - ARRAY['penalidade','qtd_ocorrencia','tipo_penalidade','valor_debito']::text[])::text)),'')) into atual from public."t_vigencia" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_vigencia') then raise exception 'Registros alterados em t_vigencia'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_filho_acesso_app_tentativa" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_filho_acesso_app_tentativa') then raise exception 'Registros alterados em t_filho_acesso_app_tentativa'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_filho_acesso_app_chave" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_filho_acesso_app_chave') then raise exception 'Registros alterados em t_filho_acesso_app_chave'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_filho_acesso_app" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_filho_acesso_app') then raise exception 'Registros alterados em t_filho_acesso_app'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_estrela_movimento" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_estrela_movimento') then raise exception 'Registros alterados em t_estrela_movimento'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_recompensa_estrela" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_recompensa_estrela') then raise exception 'Registros alterados em t_recompensa_estrela'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_recompensa_resgate" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_recompensa_resgate') then raise exception 'Registros alterados em t_recompensa_resgate'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_push_dispositivo_filho" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_push_dispositivo_filho') then raise exception 'Registros alterados em t_push_dispositivo_filho'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_push_envio_filho" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_push_envio_filho') then raise exception 'Registros alterados em t_push_envio_filho'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_solicitacao_tarefa_filho" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_solicitacao_tarefa_filho') then raise exception 'Registros alterados em t_solicitacao_tarefa_filho'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_push_resposta_filho" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_push_resposta_filho') then raise exception 'Registros alterados em t_push_resposta_filho'; end if;
select md5(coalesce(string_agg(md5((to_jsonb(t) - ARRAY[]::text[])::text),'' order by md5((to_jsonb(t) - ARRAY[]::text[])::text)),'')) into atual from public."t_estrela_concessao" t;
if atual is distinct from (select checksum from alinhamento_fingerprints where tabela='t_estrela_concessao') then raise exception 'Registros alterados em t_estrela_concessao'; end if;
end; $verify$;
