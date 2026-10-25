-- 0083 - Novo fluxo de recompensas: conquista automatica e confirmacao pelo filho.
-- Regras preservadas:
-- - estrelas sao merito permanente e nunca diminuem;
-- - cada recompensa tem ciclo independente;
-- - ao atingir a meta, o ciclo fica congelado como conquistado;
-- - estrelas ganhas enquanto aguarda a confirmacao continuam apenas no total permanente;
-- - o novo ciclo comeca somente depois de o filho confirmar "Ja aproveitei!".

create or replace function public.garantir_conquista_recompensa_estrelas_interno(
  p_id_usuario_pai bigint,
  p_id_filho bigint,
  p_id_recompensa bigint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
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

  if not found then
    return;
  end if;

  v_total := public.estrelas_total_conquistado_interno(
    p_id_usuario_pai,
    p_id_filho
  );

  for v_recompensa in
    select
      r.id,
      r.nome,
      r.descricao,
      r.estrelas_necessarias
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

    select coalesce((
      select rr.total_estrelas_no_resgate
      from public.t_recompensa_resgate rr
      where rr.id_usuario_pai = p_id_usuario_pai
        and rr.id_filho = p_id_filho
        and rr.id_recompensa = v_recompensa.id
        and rr.status = 'ENTREGUE'
        and rr.total_estrelas_no_resgate is not null
      order by rr.entregue_em desc nulls last, rr.id desc
      limit 1
    ), 0)
    into v_marco;

    if greatest(v_total - v_marco, 0) < v_recompensa.estrelas_necessarias then
      continue;
    end if;

    insert into public.t_recompensa_resgate (
      id_usuario_pai,
      id_filho,
      id_recompensa,
      recompensa_nome,
      recompensa_descricao_no_resgate,
      estrelas_utilizadas,
      meta_estrelas_no_resgate,
      total_estrelas_no_resgate,
      status
    )
    values (
      p_id_usuario_pai,
      p_id_filho,
      v_recompensa.id,
      v_recompensa.nome,
      v_recompensa.descricao,
      v_recompensa.estrelas_necessarias,
      v_recompensa.estrelas_necessarias,
      v_total,
      'PENDENTE'
    );
  end loop;
end;
$function$;

create or replace function public.registrar_concessao_estrela_ocorrencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pai_id bigint;
  v_filho_id bigint;
  v_vigencia_id bigint;
  v_tarefa_id bigint;
  v_tarefa_nome text;
  v_data date;
begin
  if new.tipo <> 'FEZ' then
    return new;
  end if;

  select
    ft.id_usuario_pai,
    ft.id_filho,
    ft.id_vigencia,
    ft.id_tarefa,
    t.nome
  into
    v_pai_id,
    v_filho_id,
    v_vigencia_id,
    v_tarefa_id,
    v_tarefa_nome
  from public.t_filho_tarefa ft
  left join public.t_tarefa t
    on t.id = ft.id_tarefa
   and t.id_usuario_pai = ft.id_usuario_pai
  where ft.id = new.id_filho_tarefa
    and ft.id_usuario_pai = new.id_usuario_pai;

  if v_pai_id is null
     or v_filho_id is null
     or v_vigencia_id is null
     or v_tarefa_id is null then
    return new;
  end if;

  v_data := timezone('America/Sao_Paulo', new.created_at)::date;

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
    v_pai_id,
    v_filho_id,
    v_vigencia_id,
    v_tarefa_id,
    new.id_filho_tarefa,
    new.id,
    v_tarefa_nome,
    v_data,
    now()
  )
  on conflict do nothing;

  perform public.garantir_conquista_recompensa_estrelas_interno(
    v_pai_id,
    v_filho_id,
    null
  );

  return new;
end;
$function$;

create or replace function public.salvar_recompensa_estrelas(
  p_id_filho bigint,
  p_nome text,
  p_descricao text,
  p_estrelas_necessarias integer,
  p_id_recompensa bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pai_id bigint;
  v_id bigint;
  v_nome text;
  v_descricao text;
begin
  select p.id
    into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  perform 1
  from public.t_filho f
  where f.id = p_id_filho
    and f.id_usuario_pai = v_pai_id
  for update;

  if not found then
    raise exception 'Filho não encontrado para este responsável';
  end if;

  v_nome := btrim(coalesce(p_nome, ''));
  v_descricao := nullif(btrim(coalesce(p_descricao, '')), '');

  if char_length(v_nome) < 2 or char_length(v_nome) > 100 then
    raise exception 'Informe uma recompensa entre 2 e 100 caracteres';
  end if;

  if v_descricao is not null and char_length(v_descricao) > 300 then
    raise exception 'A descrição da recompensa deve ter no máximo 300 caracteres';
  end if;

  if p_estrelas_necessarias is null
     or p_estrelas_necessarias < 1
     or p_estrelas_necessarias > 100000 then
    raise exception 'Informe uma quantidade válida de estrelas';
  end if;

  if p_id_recompensa is null then
    insert into public.t_recompensa_estrela (
      id_usuario_pai,
      id_filho,
      nome,
      descricao,
      estrelas_necessarias,
      ativo
    )
    values (
      v_pai_id,
      p_id_filho,
      v_nome,
      v_descricao,
      p_estrelas_necessarias,
      true
    )
    returning id into v_id;
  else
    update public.t_recompensa_estrela
    set nome = v_nome,
        descricao = v_descricao,
        estrelas_necessarias = p_estrelas_necessarias,
        updated_at = now()
    where id = p_id_recompensa
      and id_usuario_pai = v_pai_id
      and id_filho = p_id_filho
    returning id into v_id;

    if v_id is null then
      raise exception 'Recompensa não encontrada';
    end if;
  end if;

  perform public.garantir_conquista_recompensa_estrelas_interno(
    v_pai_id,
    p_id_filho,
    v_id
  );

  return v_id;
end;
$function$;

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

    if new.entregue_em is not null or new.cancelado_em is not null then
      raise exception 'Novo ciclo não pode nascer concluído ou cancelado';
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
      raise exception 'Marco de estrelas da recompensa só pode avançar na confirmação do filho';
    end if;
  end if;

  if old.status <> 'PENDENTE' and new.status is distinct from old.status then
    raise exception 'Ciclo de recompensa finalizado não pode mudar de status';
  end if;

  if new.status = 'PENDENTE' then
    if new.entregue_em is not null or new.cancelado_em is not null then
      raise exception 'Ciclo pendente não pode possuir data de conclusão/cancelamento';
    end if;
  elsif new.status = 'ENTREGUE' then
    if new.entregue_em is null or new.cancelado_em is not null then
      raise exception 'Ciclo concluído exige data de conclusão e não pode estar cancelado';
    end if;
  elsif new.status = 'CANCELADO' then
    if new.cancelado_em is null or new.entregue_em is not null then
      raise exception 'Ciclo cancelado exige data de cancelamento e não pode estar concluído';
    end if;
  else
    raise exception 'Status de ciclo de recompensa inválido';
  end if;

  return new;
end;
$function$;

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
  v_resgate_id bigint;
  v_recompensa_nome text;
  v_meta integer;
  v_total integer;
  v_ultimo_id bigint;
  v_ultimo_total integer;
  v_ultimo_nome text;
  v_ultimo_entregue_em timestamptz;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'codigo', 'SESSAO_INVALIDA');
  end if;

  if p_id_recompensa is null or p_id_recompensa <= 0 then
    return jsonb_build_object('ok', false, 'codigo', 'RECOMPENSA_INVALIDA');
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

  perform 1
  from public.t_filho f
  where f.id = v_filho_id
    and f.id_usuario_pai = v_pai_id
  for update;

  if not exists (
    select 1
    from public.t_recompensa_estrela r
    where r.id = p_id_recompensa
      and r.id_usuario_pai = v_pai_id
      and r.id_filho = v_filho_id
      and r.ativo = true
  ) then
    return jsonb_build_object('ok', false, 'codigo', 'RECOMPENSA_INVALIDA');
  end if;

  perform public.garantir_conquista_recompensa_estrelas_interno(
    v_pai_id,
    v_filho_id,
    p_id_recompensa
  );

  select
    rr.id,
    rr.recompensa_nome,
    coalesce(rr.meta_estrelas_no_resgate, rr.estrelas_utilizadas)
  into
    v_resgate_id,
    v_recompensa_nome,
    v_meta
  from public.t_recompensa_resgate rr
  where rr.id_usuario_pai = v_pai_id
    and rr.id_filho = v_filho_id
    and rr.id_recompensa = p_id_recompensa
    and rr.status = 'PENDENTE'
  order by rr.created_at desc, rr.id desc
  limit 1
  for update;

  v_total := public.estrelas_total_conquistado_interno(v_pai_id, v_filho_id);

  if v_resgate_id is null then
    select
      rr.id,
      rr.total_estrelas_no_resgate,
      rr.recompensa_nome,
      rr.entregue_em
    into
      v_ultimo_id,
      v_ultimo_total,
      v_ultimo_nome,
      v_ultimo_entregue_em
    from public.t_recompensa_resgate rr
    where rr.id_usuario_pai = v_pai_id
      and rr.id_filho = v_filho_id
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
        'id_usuario_pai', v_pai_id,
        'id_filho', v_filho_id,
        'nome_filho', v_nome_filho,
        'recompensa', jsonb_build_object(
          'id', p_id_recompensa,
          'nome', v_ultimo_nome,
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
      updated_at = now()
  where id = v_resgate_id
    and id_usuario_pai = v_pai_id
    and id_filho = v_filho_id;

  update public.t_filho_acesso_app
  set ultimo_acesso_em = now(),
      updated_at = now()
  where token_hash = v_token_hash
    and ativo = true;

  return jsonb_build_object(
    'ok', true,
    'concluida', true,
    'ja_concluida', false,
    'id_usuario_pai', v_pai_id,
    'id_filho', v_filho_id,
    'nome_filho', v_nome_filho,
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
    select 1
    from public.t_filho f
    where f.id = p_id_filho
      and f.id_usuario_pai = p_id_usuario_pai
  ) then
    return null;
  end if;

  v_total := public.estrelas_total_conquistado_interno(
    p_id_usuario_pai,
    p_id_filho
  );

  select count(*)::integer
    into v_hoje
  from public.t_ocorrencia o
  join public.t_filho_tarefa ft
    on ft.id = o.id_filho_tarefa
   and ft.id_usuario_pai = o.id_usuario_pai
  where o.id_usuario_pai = p_id_usuario_pai
    and ft.id_filho = p_id_filho
    and o.tipo = 'FEZ'
    and timezone('America/Sao_Paulo', o.created_at)::date =
        timezone('America/Sao_Paulo', now())::date;

  select v.id
    into v_vigencia_id
  from public.t_vigencia v
  where v.id_usuario_pai = p_id_usuario_pai
    and now() between v.data_inicio and v.data_fim
    and exists (
      select 1
      from public.t_filho_tarefa ft
      where ft.id_usuario_pai = p_id_usuario_pai
        and ft.id_filho = p_id_filho
        and ft.id_vigencia = v.id
    )
  order by v.data_inicio desc
  limit 1;

  if v_vigencia_id is null then
    v_vigencia := 0;
  else
    select count(*)::integer
      into v_vigencia
    from public.t_ocorrencia o
    join public.t_filho_tarefa ft
      on ft.id = o.id_filho_tarefa
     and ft.id_usuario_pai = o.id_usuario_pai
    where o.id_usuario_pai = p_id_usuario_pai
      and ft.id_filho = p_id_filho
      and ft.id_vigencia = v_vigencia_id
      and o.tipo = 'FEZ';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'nome', r.nome,
        'descricao', r.descricao,
        'estrelas_necessarias', r.estrelas_necessarias,
        'progresso', x.progresso,
        'faltam', greatest(r.estrelas_necessarias - x.progresso, 0),
        'disponivel', (not x.tem_pendente and x.progresso >= r.estrelas_necessarias),
        'pendente', x.tem_pendente,
        'marco_estrelas', x.marco_estrelas,
        'conquista_id', x.pendente_id,
        'conquista_nome', x.pendente_nome,
        'conquista_descricao', x.pendente_descricao,
        'conquista_meta', x.pendente_meta
      )
      order by r.estrelas_necessarias, r.nome
    ),
    '[]'::jsonb
  )
  into v_recompensas
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
      p.id as pendente_id,
      p.recompensa_nome as pendente_nome,
      p.recompensa_descricao_no_resgate as pendente_descricao,
      coalesce(p.meta_estrelas_no_resgate, p.estrelas_utilizadas) as pendente_meta
    from (
      select
        rr.id,
        rr.recompensa_nome,
        rr.recompensa_descricao_no_resgate,
        rr.meta_estrelas_no_resgate,
        rr.estrelas_utilizadas
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
    select
      rr.created_at as ordem,
      jsonb_build_object(
        'id', rr.id,
        'id_recompensa', rr.id_recompensa,
        'recompensa_nome', rr.recompensa_nome,
        'recompensa_descricao_no_resgate', rr.recompensa_descricao_no_resgate,
        'estrelas_utilizadas', rr.estrelas_utilizadas,
        'meta_estrelas_no_resgate', coalesce(rr.meta_estrelas_no_resgate, rr.estrelas_utilizadas),
        'total_estrelas_no_resgate', rr.total_estrelas_no_resgate,
        'status', rr.status,
        'created_at', rr.created_at,
        'entregue_em', rr.entregue_em,
        'cancelado_em', rr.cancelado_em
      ) as item
    from public.t_recompensa_resgate rr
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

create or replace function public.alterar_status_resgate_estrelas(
  p_id_resgate bigint,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pai_id bigint;
  v_filho_id bigint;
  v_status_atual text;
begin
  select p.id
    into v_pai_id
  from public.t_usuario_pai p
  where p.auth_user_id = auth.uid();

  if v_pai_id is null then
    raise exception 'Responsável não encontrado';
  end if;

  if p_status = 'ENTREGUE' then
    raise exception 'A conclusão da recompensa deve ser confirmada pelo filho';
  end if;

  if p_status <> 'CANCELADO' then
    raise exception 'Status de recompensa inválido';
  end if;

  select rr.id_filho, rr.status
    into v_filho_id, v_status_atual
  from public.t_recompensa_resgate rr
  where rr.id = p_id_resgate
    and rr.id_usuario_pai = v_pai_id
  for update;

  if v_filho_id is null then
    raise exception 'Recompensa não encontrada';
  end if;

  perform 1
  from public.t_filho f
  where f.id = v_filho_id
    and f.id_usuario_pai = v_pai_id
  for update;

  if v_status_atual = 'ENTREGUE' then
    raise exception 'Recompensa já concluída não pode ser cancelada';
  end if;

  if v_status_atual = 'CANCELADO' then
    return true;
  end if;

  update public.t_recompensa_resgate
  set status = 'CANCELADO',
      cancelado_em = coalesce(cancelado_em, now()),
      updated_at = now()
  where id = p_id_resgate
    and id_usuario_pai = v_pai_id;

  return true;
end;
$function$;

revoke all on function public.garantir_conquista_recompensa_estrelas_interno(bigint,bigint,bigint)
from public, anon, authenticated, service_role;

revoke all on function public.concluir_recompensa_filho_interno(text,bigint)
from public, anon, authenticated, service_role;
grant execute on function public.concluir_recompensa_filho_interno(text,bigint)
to service_role;

do $$
declare
  v_filho record;
begin
  for v_filho in
    select f.id_usuario_pai, f.id
    from public.t_filho f
    order by f.id_usuario_pai, f.id
  loop
    perform public.garantir_conquista_recompensa_estrelas_interno(
      v_filho.id_usuario_pai,
      v_filho.id,
      null
    );
  end loop;
end
$$;

comment on function public.garantir_conquista_recompensa_estrelas_interno(bigint,bigint,bigint) is
'Abre automaticamente um ciclo conquistado quando a recompensa atinge a meta. Enquanto PENDENTE, não existe próximo ciclo para a recompensa.';

comment on function public.concluir_recompensa_filho_interno(text,bigint) is
'Confirma pelo token do filho que a recompensa foi aproveitada. O marco do próximo ciclo passa a ser o total permanente existente no momento da confirmação.';
