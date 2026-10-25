
do $$
begin
  if exists (
    select 1
    from public.t_filho
    where tem_mesada is distinct from coalesce(tem_mesada_opcional, false)
  ) then
    raise exception 'Migração abortada: há divergência entre tem_mesada e tem_mesada_opcional';
  end if;
end;
$$;

drop trigger if exists sincronizar_mesada_vigencia_filho_after_change on public.t_filho;
drop trigger if exists validar_mesada_filho_vigencia_before_change on public.t_filho;

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
      'tem_mesada', coalesce(f.tem_mesada, false) and f.valor_mesada is not null,
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
$function$;

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
    coalesce(f.tem_mesada, false) and f.valor_mesada is not null,
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

CREATE OR REPLACE FUNCTION public.sincronizar_mesada_vigencia_atribuicao_interno()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tem_mesada boolean;
  v_valor_mesada numeric;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if not exists (
      select 1
      from public.t_filho_tarefa ft
      where ft.id_usuario_pai = old.id_usuario_pai
        and ft.id_filho = old.id_filho
        and ft.id_vigencia = old.id_vigencia
    ) then
      delete from public.t_filho_vigencia_mesada m
      where m.id_usuario_pai = old.id_usuario_pai
        and m.id_filho = old.id_filho
        and m.id_vigencia = old.id_vigencia;
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select
      coalesce(f.tem_mesada, false) and f.valor_mesada is not null,
      case
        when coalesce(f.tem_mesada, false) and f.valor_mesada is not null
          then f.valor_mesada
        else null
      end
    into v_tem_mesada, v_valor_mesada
    from public.t_filho f
    where f.id_usuario_pai = new.id_usuario_pai
      and f.id = new.id_filho;

    insert into public.t_filho_vigencia_mesada (
      id_usuario_pai,
      id_filho,
      id_vigencia,
      tem_mesada,
      valor_mesada
    )
    values (
      new.id_usuario_pai,
      new.id_filho,
      new.id_vigencia,
      coalesce(v_tem_mesada, false),
      v_valor_mesada
    )
    on conflict (id_usuario_pai, id_filho, id_vigencia)
    do update
      set tem_mesada = excluded.tem_mesada,
          valor_mesada = excluded.valor_mesada,
          updated_at = statement_timestamp()
    where exists (
      select 1
      from public.t_vigencia v
      where v.id = excluded.id_vigencia
        and v.id_usuario_pai = excluded.id_usuario_pai
        and v.data_fim > statement_timestamp()
    );
  end if;

  return coalesce(new, old);
end;
$function$;

CREATE OR REPLACE FUNCTION public.sincronizar_mesada_vigencia_filho_interno()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tem_mesada boolean;
  v_valor_mesada numeric;
begin
  v_tem_mesada :=
    coalesce(new.tem_mesada, false)
    and new.valor_mesada is not null;

  v_valor_mesada :=
    case when v_tem_mesada then new.valor_mesada else null end;

  update public.t_filho_vigencia_mesada m
  set tem_mesada = v_tem_mesada,
      valor_mesada = v_valor_mesada,
      updated_at = statement_timestamp()
  from public.t_vigencia v
  where m.id_usuario_pai = new.id_usuario_pai
    and m.id_filho = new.id
    and v.id = m.id_vigencia
    and v.id_usuario_pai = m.id_usuario_pai
    and v.data_fim > statement_timestamp();

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.validar_desconto_mesada_vigencia_interno()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_id_filho bigint;
  v_id_vigencia bigint;
  v_mesada_ativa boolean;
  v_valor_mesada numeric;
  v_total_outros numeric;
  v_ignorar_id bigint;
begin
  if new.tipo is distinct from 'DESCONTO'
     or new.status is distinct from 'APLICADO' then
    return new;
  end if;

  select
    ft.id_filho,
    ft.id_vigencia,
    coalesce(f.tem_mesada, false) and f.valor_mesada is not null,
    f.valor_mesada
  into
    v_id_filho,
    v_id_vigencia,
    v_mesada_ativa,
    v_valor_mesada
  from public.t_ocorrencia o
  join public.t_filho_tarefa ft
    on ft.id = o.id_filho_tarefa
   and ft.id_usuario_pai = o.id_usuario_pai
  join public.t_filho f
    on f.id = ft.id_filho
   and f.id_usuario_pai = ft.id_usuario_pai
  where o.id = new.id_ocorrencia
    and o.id_usuario_pai = new.id_usuario_pai;

  if not found then
    raise exception 'Não foi possível identificar o filho e a vigência da consequência';
  end if;

  if not v_mesada_ativa then
    raise exception 'Desconto de mesada só pode ser aplicado a filho com mesada cadastrada';
  end if;

  if new.desconto_valor is null or new.desconto_valor <= 0 then
    raise exception 'Informe um valor de desconto válido';
  end if;

  v_ignorar_id := case when tg_op = 'UPDATE' then old.id else null end;

  v_total_outros :=
    public.total_descontos_aplicados_filho_vigencia_interno(
      new.id_usuario_pai,
      v_id_filho,
      v_id_vigencia,
      v_ignorar_id
    );

  if v_total_outros + new.desconto_valor > v_valor_mesada then
    raise exception
      'O total de descontos aplicados na vigência não pode ultrapassar a mesada atual (R$ %).',
      trim(to_char(v_valor_mesada, 'FM9999999990D00'));
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.validar_mesada_filho_vigencia_interno()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_id_vigencia bigint;
  v_total_descontos numeric;
  v_mesada_ativa boolean;
begin
  v_mesada_ativa :=
    coalesce(new.tem_mesada, false)
    and new.valor_mesada is not null;

  if not v_mesada_ativa then
    return new;
  end if;

  for v_id_vigencia in
    select distinct ft.id_vigencia
    from public.t_filho_tarefa ft
    join public.t_vigencia v
      on v.id = ft.id_vigencia
     and v.id_usuario_pai = ft.id_usuario_pai
    where ft.id_usuario_pai = new.id_usuario_pai
      and ft.id_filho = new.id
      and now() between v.data_inicio and v.data_fim
  loop
    v_total_descontos :=
      public.total_descontos_aplicados_filho_vigencia_interno(
        new.id_usuario_pai,
        new.id,
        v_id_vigencia,
        null
      );

    if new.valor_mesada < v_total_descontos then
      raise exception
        'A mesada não pode ser menor que o total de descontos aplicados na vigência atual (R$ %).',
        trim(to_char(v_total_descontos, 'FM9999999990D00'));
    end if;
  end loop;

  return new;
end;
$function$;

create trigger sincronizar_mesada_vigencia_filho_after_change
after update of tem_mesada, valor_mesada
on public.t_filho
for each row
when (
  old.tem_mesada is distinct from new.tem_mesada
  or old.valor_mesada is distinct from new.valor_mesada
)
execute function public.sincronizar_mesada_vigencia_filho_interno();

create trigger validar_mesada_filho_vigencia_before_change
before insert or update of tem_mesada, valor_mesada
on public.t_filho
for each row
execute function public.validar_mesada_filho_vigencia_interno();

alter table public.t_filho
  drop constraint if exists t_filho_mesada_opcional_valida,
  drop constraint if exists t_filho_mesada_coerente,
  drop constraint if exists t_filho_mesada_valida;

alter table public.t_filho
  add constraint t_filho_mesada_coerente_chk
  check (
    (tem_mesada = false and valor_mesada is null)
    or
    (tem_mesada = true and valor_mesada is not null and valor_mesada > 0)
  );

alter table public.t_filho
  drop column tem_mesada_opcional;
