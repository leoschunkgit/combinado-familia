-- 0088 - Conclusao unica e central de recompensa para filho e responsavel.
-- Pai e filho apenas autenticam sua porta de entrada; toda regra de conclusao,
-- marco de estrelas, data e persistencia do ciclo vive em uma unica funcao interna.

alter table public.t_recompensa_resgate
  add column if not exists confirmado_por text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 't_recompensa_resgate_confirmado_por_chk'
      and conrelid = 'public.t_recompensa_resgate'::regclass
  ) then
    alter table public.t_recompensa_resgate
      add constraint t_recompensa_resgate_confirmado_por_chk
      check (confirmado_por is null or confirmado_por in ('FILHO', 'RESPONSAVEL'));
  end if;
end
$$;

create or replace function public.proteger_resgate_estrela_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
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

  if new.id_usuario_pai is distinct from old.id_usuario_pai
     or new.id_filho is distinct from old.id_filho
     or new.id_recompensa is distinct from old.id_recompensa
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
$function$;

revoke all on function public.proteger_resgate_estrela_snapshot()
from public, anon, authenticated, service_role;

create or replace function public.concluir_ciclo_recompensa_interno(
  p_id_usuario_pai bigint,
  p_id_filho bigint,
  p_id_recompensa bigint,
  p_confirmado_por text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
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

  perform public.garantir_conquista_recompensa_estrelas_interno(
    p_id_usuario_pai,
    p_id_filho,
    p_id_recompensa
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
$function$;

revoke all on function public.concluir_ciclo_recompensa_interno(bigint,bigint,bigint,text)
from public, anon, authenticated, service_role;

create or replace function public.concluir_recompensa_filho_interno(
  p_token text,
  p_id_recompensa bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
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
      'nome_filho', v_nome_filho
    );
  end if;

  return v_resultado;
end;
$function$;

revoke all on function public.concluir_recompensa_filho_interno(text,bigint)
from public, anon, authenticated, service_role;
grant execute on function public.concluir_recompensa_filho_interno(text,bigint)
to service_role;

create or replace function public.confirmar_recompensa_aproveitada(
  p_id_recompensa bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pai_id bigint;
  v_filho_id bigint;
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

  return public.concluir_ciclo_recompensa_interno(
    v_pai_id,
    v_filho_id,
    p_id_recompensa,
    'RESPONSAVEL'
  );
end;
$function$;

revoke all on function public.confirmar_recompensa_aproveitada(bigint)
from public, anon, authenticated, service_role;
grant execute on function public.confirmar_recompensa_aproveitada(bigint)
to authenticated;

create or replace function public.resumo_estrelas_filho_interno(
  p_id_usuario_pai bigint,
  p_id_filho bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
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
        'pode_excluir', (not x.tem_historico),
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
        v_total - coalesce((
          select rr.total_estrelas_no_resgate
          from public.t_recompensa_resgate rr
          where rr.id_usuario_pai = p_id_usuario_pai
            and rr.id_filho = p_id_filho
            and rr.id_recompensa = r.id
            and rr.status = 'ENTREGUE'
            and rr.total_estrelas_no_resgate is not null
          order by rr.entregue_em desc nulls last, rr.id desc
          limit 1
        ), 0),
        0
      )::integer as progresso,
      coalesce((
        select rr.total_estrelas_no_resgate
        from public.t_recompensa_resgate rr
        where rr.id_usuario_pai = p_id_usuario_pai
          and rr.id_filho = p_id_filho
          and rr.id_recompensa = r.id
          and rr.status = 'ENTREGUE'
          and rr.total_estrelas_no_resgate is not null
        order by rr.entregue_em desc nulls last, rr.id desc
        limit 1
      ), 0)::integer as marco_estrelas,
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
$function$;


comment on function public.resumo_estrelas_filho_interno(bigint,bigint) is
'Contrato central de estrelas e recompensas para responsável e filho. O banco decide estado, capacidades, confirmação do ciclo, campos de exibição e semântica do histórico; snapshots permanecem para auditoria.';
