-- 0076 - Permite pedir revisão de Não fez mesmo quando já houve um aviso "Terminei" no dia.
--
-- Regra:
-- - o aviso "Terminei" não consome o direito de revisão;
-- - a revisão continua limitada a uma única solicitação por atribuição/data;
-- - a revisão só pode ser criada quando o estado oficial atual é NAO_FEZ.

create or replace function public.criar_revisao_tarefa_filho_interno(
  p_token text,
  p_id_filho_tarefa bigint,
  p_observacao text default null
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
  v_vigencia_id bigint;
  v_tarefa_id bigint;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_nome_filho text;
  v_nome_tarefa text;
  v_data date;
  v_observacao text;
  v_ocorrencia_tipo text;
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_id_filho_tarefa::text || ':' || v_data::text,
      0
    )
  );

  select o.tipo
    into v_ocorrencia_tipo
  from public.t_ocorrencia o
  where o.id_filho_tarefa = p_id_filho_tarefa
    and timezone('America/Sao_Paulo', o.created_at)::date = v_data
  order by o.created_at desc
  limit 1
  for update;

  if v_ocorrencia_tipo is null or v_ocorrencia_tipo <> 'NAO_FEZ' then
    return jsonb_build_object('ok', false, 'codigo', 'REVISAO_INDISPONIVEL');
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

  insert into public.t_revisao_tarefa_filho (
    id_filho_tarefa,
    data_referencia,
    observacao
  )
  values (
    p_id_filho_tarefa,
    v_data,
    v_observacao
  )
  on conflict (id_filho_tarefa, data_referencia) do nothing
  returning id, status, created_at, resolvido_em
    into v_id, v_status, v_created_at, v_resolvido_em;

  if v_id is null then
    select r.id, r.status, r.created_at, r.resolvido_em, r.observacao
      into v_id, v_status, v_created_at, v_resolvido_em, v_observacao
    from public.t_revisao_tarefa_filho r
    where r.id_filho_tarefa = p_id_filho_tarefa
      and r.data_referencia = v_data;

    return jsonb_build_object(
      'ok', true,
      'criada', false,
      'id_usuario_pai', v_pai_id,
      'id_filho', v_filho_id,
      'nome_filho', v_nome_filho,
      'nome_tarefa', v_nome_tarefa,
      'revisao', jsonb_build_object(
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
    'revisao', jsonb_build_object(
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
