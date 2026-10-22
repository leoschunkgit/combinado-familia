-- Remove estruturas do recurso descontinuado. Históricos ficam fora da API.
create schema if not exists arquivo_interno;
revoke all on schema arquivo_interno from public, anon, authenticated, service_role;
create table if not exists arquivo_interno.registros_retirados (
  id bigint generated always as identity primary key,
  recurso text not null,
  tabela_origem text not null,
  registro jsonb not null,
  arquivado_em timestamptz not null default now()
);
alter table arquivo_interno.registros_retirados enable row level security;
revoke all on arquivo_interno.registros_retirados from public, anon, authenticated, service_role;
lock table public.t_revisao_tarefa_filho, public.t_ocorrencia_reconciliacao, public.t_push_resposta_filho in access exclusive mode;
insert into arquivo_interno.registros_retirados(recurso,tabela_origem,registro)
select 'revisao','t_revisao_tarefa_filho',to_jsonb(t) from public.t_revisao_tarefa_filho t;
insert into arquivo_interno.registros_retirados(recurso,tabela_origem,registro)
select 'revisao','t_ocorrencia_reconciliacao',to_jsonb(t) from public.t_ocorrencia_reconciliacao t
where id_revisao is not null or origem='REVISAO' or acao in ('SOLICITAR_REVISAO','RESOLVER_REVISAO');
insert into arquivo_interno.registros_retirados(recurso,tabela_origem,registro)
select 'revisao','t_push_resposta_filho',to_jsonb(t) from public.t_push_resposta_filho t where tipo_interacao='REVISAO';
delete from public.t_ocorrencia_reconciliacao where id_revisao is not null or origem='REVISAO' or acao in ('SOLICITAR_REVISAO','RESOLVER_REVISAO');
delete from public.t_push_resposta_filho where tipo_interacao='REVISAO';
drop function public.criar_revisao_ocorrencia_filho_interno(text,bigint,text);
drop function public.resolver_revisao_tarefa_filho(bigint,text);
drop function public.reconciliar_ocorrencia(text,bigint,bigint,timestamptz,text,text,numeric,text,bigint,text);
drop table public.t_revisao_tarefa_filho;
alter table public.t_ocorrencia_reconciliacao drop column id_revisao;
alter table public.t_ocorrencia_reconciliacao drop constraint t_ocorrencia_reconciliacao_origem_check;
alter table public.t_ocorrencia_reconciliacao add constraint t_ocorrencia_reconciliacao_origem_check check (origem in ('RESPONSAVEL','SISTEMA'));
alter table public.t_ocorrencia_reconciliacao drop constraint t_ocorrencia_reconciliacao_acao_check;
alter table public.t_ocorrencia_reconciliacao add constraint t_ocorrencia_reconciliacao_acao_check check (acao in ('CRIAR','ALTERAR','DESFAZER','CUMPRIR_PENALIDADE'));
alter table public.t_push_resposta_filho drop constraint t_push_resposta_filho_tipo_interacao_check;
alter table public.t_push_resposta_filho add constraint t_push_resposta_filho_tipo_interacao_check check (tipo_interacao='SOLICITACAO');
alter table public.t_ocorrencia_consequencia drop constraint consequencia_sem_revisao;
-- Conserva integralmente as demais regras de coerência.
do $cleanup$
declare c record;
begin
  for c in select conname, pg_get_constraintdef(oid) as def from pg_constraint
    where conrelid='public.t_ocorrencia_consequencia'::regclass and contype='c'
      and pg_get_constraintdef(oid) like '%SUSPENSA_REVISAO%'
  loop
    execute format('alter table public.t_ocorrencia_consequencia drop constraint %I',c.conname);
    execute format('alter table public.t_ocorrencia_consequencia add constraint %I %s',c.conname,replace(c.def,', ''SUSPENSA_REVISAO''::text',''));
  end loop;
end;
$cleanup$;
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
$function$;


revoke all on function public.reconciliar_ocorrencia(text,bigint,bigint,timestamptz,text,text,numeric,text,text) from public,anon,service_role;
grant execute on function public.reconciliar_ocorrencia(text,bigint,bigint,timestamptz,text,text,numeric,text,text) to authenticated;
notify pgrst, 'reload schema';
