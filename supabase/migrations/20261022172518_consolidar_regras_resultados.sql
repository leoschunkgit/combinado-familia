-- Consolida e endurece o contrato de FEZ / NAO_FEZ / NAO_PRECISOU.
-- Regras funcionais já aprovadas:
--   FEZ: resolve o dia, concede 1 estrela e reconcilia recompensas.
--   NAO_FEZ: resolve o dia, conta por vigência e pode ter Nada/Desconto/Penalidade.
--   NAO_PRECISOU: resolve o dia sem estrela e sem consequência ativa.
--   Penalidade CUMPRIDA torna o resultado imutável.
--   Resultado não é apagado; correções são feitas por troca entre os três estados.

create or replace function public.motivo_bloqueio_alteracao_resultado_interno(
  p_id_usuario_pai bigint,
  p_id_ocorrencia bigint
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
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
$$;

revoke all on function public.motivo_bloqueio_alteracao_resultado_interno(bigint,bigint)
  from public, anon, authenticated;
grant execute on function public.motivo_bloqueio_alteracao_resultado_interno(bigint,bigint)
  to service_role;

create or replace function public.guard_occurrence_active_validity()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_assignment_id bigint;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_ocorrencia timestamptz;
  v_hoje date;
begin
  -- Cascades de FK são limpeza estrutural, não uma ação "desfazer".
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  -- O produto não possui mais "Desfazer marcação".
  -- Exclusão direta de resultado é bloqueada no próprio banco.
  if tg_op = 'DELETE' then
    raise exception 'Resultados não podem ser excluídos; altere para Fez, Não fez ou Não precisou';
  end if;

  -- Penalidade cumprida congela o resultado mesmo fora da RPC oficial.
  if tg_op = 'UPDATE'
     and public.motivo_bloqueio_alteracao_resultado_interno(
       old.id_usuario_pai,
       old.id
     ) = 'PENALIDADE_CUMPRIDA' then
    raise exception 'Não é possível alterar este resultado porque a penalidade já foi cumprida';
  end if;

  v_assignment_id := new.id_filho_tarefa;
  v_ocorrencia := new.created_at;

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

  return new;
end;
$$;

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
  if v_acao not in ('SALVAR','CUMPRIR_PENALIDADE') then
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
    raise exception 'Não é permitido alterar a data de uma ocorrência existente';
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

  -- A regra de bloqueio fica centralizada no helper também usado pelo trigger.
  if v_id_ocorrencia is not null
     and v_acao = 'SALVAR'
     and public.motivo_bloqueio_alteracao_resultado_interno(
       v_pai_id,
       v_id_ocorrencia
     ) = 'PENALIDADE_CUMPRIDA' then
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


create or replace function public.guard_consequencia_resultado_interno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo_resultado text;
begin
  -- Consequências encerradas permanecem como histórico de uma transição.
  if new.status not in ('APLICADO','PENDENTE','CUMPRIDA') then
    return new;
  end if;

  select o.tipo
    into v_tipo_resultado
  from public.t_ocorrencia o
  where o.id = new.id_ocorrencia
    and o.id_usuario_pai = new.id_usuario_pai;

  if v_tipo_resultado is distinct from 'NAO_FEZ' then
    raise exception 'Consequência ativa só pode existir em resultado Não fez';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_consequencia_resultado_interno()
  from public, anon, authenticated;

drop trigger if exists guard_consequencia_resultado_before_change
  on public.t_ocorrencia_consequencia;

create trigger guard_consequencia_resultado_before_change
before insert or update on public.t_ocorrencia_consequencia
for each row execute function public.guard_consequencia_resultado_interno();

create or replace function public.guard_estrela_concessao_origem_interno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo text;
  v_id_filho bigint;
  v_id_vigencia bigint;
  v_id_tarefa bigint;
  v_id_filho_tarefa bigint;
  v_data date;
begin
  if new.id_ocorrencia_origem is null
     or new.id_filho_tarefa_origem is null then
    raise exception 'Toda estrela deve ter origem em um resultado Fez';
  end if;

  select
    o.tipo,
    ft.id_filho,
    ft.id_vigencia,
    ft.id_tarefa,
    ft.id,
    timezone('America/Sao_Paulo', o.created_at)::date
  into
    v_tipo,
    v_id_filho,
    v_id_vigencia,
    v_id_tarefa,
    v_id_filho_tarefa,
    v_data
  from public.t_ocorrencia o
  join public.t_filho_tarefa ft
    on ft.id = o.id_filho_tarefa
   and ft.id_usuario_pai = o.id_usuario_pai
  where o.id = new.id_ocorrencia_origem
    and o.id_usuario_pai = new.id_usuario_pai;

  if v_tipo is distinct from 'FEZ' then
    raise exception 'Estrela só pode ser concedida por resultado Fez';
  end if;

  if new.id_filho is distinct from v_id_filho
     or new.id_vigencia is distinct from v_id_vigencia
     or new.id_tarefa is distinct from v_id_tarefa
     or new.id_filho_tarefa_origem is distinct from v_id_filho_tarefa
     or new.data_referencia is distinct from v_data then
    raise exception 'Origem da estrela não corresponde ao resultado Fez';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_estrela_concessao_origem_interno()
  from public, anon, authenticated;

alter table public.t_estrela_concessao
  alter column id_ocorrencia_origem set not null,
  alter column id_filho_tarefa_origem set not null;

drop trigger if exists guard_estrela_concessao_origem_before_insert
  on public.t_estrela_concessao;

create trigger guard_estrela_concessao_origem_before_insert
before insert on public.t_estrela_concessao
for each row execute function public.guard_estrela_concessao_origem_interno();

-- App autenticado usa RPCs; não precisa de privilégios estruturais perigosos.
revoke truncate, trigger, references
  on table public.t_ocorrencia
  from authenticated;

revoke truncate, trigger, references
  on table public.t_ocorrencia_consequencia
  from anon, authenticated;

revoke execute on function public.contar_nao_fez_filho_vigencia(bigint,bigint)
  from anon;

comment on function public.reconciliar_ocorrencia(
  text,bigint,bigint,timestamp with time zone,text,text,numeric,text,text
) is
'Ponto central de escrita dos resultados FEZ, NAO_FEZ e NAO_PRECISOU e de cumprimento de penalidade.';

comment on function public.sincronizar_estrela_ocorrencia_interno(bigint,bigint) is
'Sincroniza a estrela com o estado atual do resultado: FEZ mantém 1 concessão; NAO_FEZ/NAO_PRECISOU removem a concessão.';

comment on function public.contar_nao_fez_filho_vigencia(bigint,bigint) is
'Conta apenas resultados NAO_FEZ atuais do filho dentro da vigência informada; nova vigência começa sua própria contagem.';

comment on table public.t_estrela_concessao is
'Concessões de estrelas originadas exclusivamente de resultados FEZ. O total atravessa vigências e alimenta recompensas.';

comment on table public.t_ocorrencia_consequencia is
'Consequência individual de NAO_FEZ. Estados ativos exigem resultado NAO_FEZ; ESTORNADO/CANCELADA preservam histórico de transição.';
