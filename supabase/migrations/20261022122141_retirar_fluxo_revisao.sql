-- Revisão retirada do produto. Preserva registros anteriores como arquivo.
-- Executar em DEV primeiro; não altera regras de estrelas/recompensas.
-- RPCs antigas abaixo são apenas respostas de recurso removido para apps instalados.
-- A assinatura de reconciliar_ocorrencia mantém p_id_revisao para evitar quebrar
-- chamadas legadas com NULL; qualquer valor ou ação de revisão é rejeitado.
-- t_revisao_tarefa_filho e id_revisao na auditoria são arquivo, nunca estado ativo.
lock table public.t_revisao_tarefa_filho in access exclusive mode;
alter table public.t_revisao_tarefa_filho drop constraint t_revisao_tarefa_filho_status_chk;
alter table public.t_revisao_tarefa_filho add constraint t_revisao_tarefa_filho_status_chk
check (status in ('PENDENTE','MANTEVE_NAO_FEZ','ALTERADO_PARA_FEZ','ALTERADO_PARA_NAO_PRECISOU','MARCACAO_DESFEITA','ENCERRADA_RECURSO_REMOVIDO'));
update public.t_revisao_tarefa_filho
set status='ENCERRADA_RECURSO_REMOVIDO', resolvido_em=now()
where status='PENDENTE';
-- Retoma somente penalidades suspensas, mantendo o resultado do responsável.
update public.t_ocorrencia_consequencia c
set status=case when o.tipo='NAO_FEZ' then 'PENDENTE' else 'CANCELADA' end,
    cancelada_em=case when o.tipo='NAO_FEZ' then null else coalesce(c.cancelada_em,now()) end,
    updated_at=now()
from public.t_ocorrencia o
where o.id=c.id_ocorrencia and c.status='SUSPENSA_REVISAO';
alter table public.t_ocorrencia_consequencia add constraint consequencia_sem_revisao check (status <> 'SUSPENSA_REVISAO');
alter table public.t_revisao_tarefa_filho add constraint revisao_apenas_historico check (status <> 'PENDENTE');
revoke insert, update on public.t_revisao_tarefa_filho from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.criar_revisao_ocorrencia_filho_interno(p_token text, p_id_ocorrencia bigint, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
begin
  raise exception 'Recurso de revisão removido' using errcode='0A000';
end;
$function$;

CREATE OR REPLACE FUNCTION public.resolver_revisao_tarefa_filho(p_id_revisao bigint, p_decisao text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
begin
  raise exception 'Recurso de revisão removido' using errcode='0A000';
end;
$function$;

CREATE OR REPLACE FUNCTION public.reconciliar_ocorrencia(p_acao text, p_id_ocorrencia bigint DEFAULT NULL::bigint, p_id_filho_tarefa bigint DEFAULT NULL::bigint, p_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_novo_tipo text DEFAULT NULL::text, p_consequencia_tipo text DEFAULT NULL::text, p_desconto_valor numeric DEFAULT NULL::numeric, p_penalidade_descricao text DEFAULT NULL::text, p_id_revisao bigint DEFAULT NULL::bigint, p_motivo text DEFAULT NULL::text)
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
  if p_id_revisao is not null then
    raise exception 'Recurso de revisão removido' using errcode='0A000';
  end if;
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
      id_revisao, estado_anterior, estado_novo, motivo
    ) values (
      v_pai_id, v_id_ocorrencia, v_id_filho_tarefa, 'DESFAZER',
      'RESPONSAVEL',
      p_id_revisao,
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
    id_revisao,
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
    p_id_revisao,
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
$function$;

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
$function$;

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
$function$;

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
$function$;

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
$function$;

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
$function$;
