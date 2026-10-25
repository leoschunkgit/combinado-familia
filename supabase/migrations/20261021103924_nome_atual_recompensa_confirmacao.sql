-- 0087 - Mantem o nome atual da recompensa em toda apresentacao e notificacao.
-- O snapshot do ciclo continua imutavel e reservado para auditoria.

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

  select r.nome
    into v_recompensa_nome
  from public.t_recompensa_estrela r
  where r.id = p_id_recompensa
    and r.id_usuario_pai = v_pai_id
    and r.id_filho = v_filho_id
    and r.ativo = true;

  if v_recompensa_nome is null then
    return jsonb_build_object('ok', false, 'codigo', 'RECOMPENSA_INVALIDA');
  end if;

  perform public.garantir_conquista_recompensa_estrelas_interno(
    v_pai_id,
    v_filho_id,
    p_id_recompensa
  );

  select
    rr.id,
    coalesce(rr.meta_estrelas_no_resgate, rr.estrelas_utilizadas)
    into v_resgate_id, v_meta
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
      rr.entregue_em
      into v_ultimo_id, v_ultimo_total, v_ultimo_entregue_em
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
          'nome', v_recompensa_nome,
          'id_ciclo', v_ultimo_id
        )
      );
    end if;

    return jsonb_build_object(
      'ok', false,
      'codigo', 'RECOMPENSA_INDISPONIVEL'
    );
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

comment on function public.concluir_recompensa_filho_interno(text,bigint) is
'Conclui o ciclo pelo filho. Nome exibido/notificado vem do cadastro atual; snapshot do ciclo permanece imutavel para auditoria.';
