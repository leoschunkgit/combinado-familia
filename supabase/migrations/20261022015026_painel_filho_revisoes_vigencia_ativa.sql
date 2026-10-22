create or replace function public.montar_painel_app_filho(
  p_id_usuario_pai bigint,
  p_id_filho bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_painel jsonb;
  v_estrelas jsonb;
  v_solicitacoes jsonb;
  v_revisoes jsonb;
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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'id_ocorrencia', r.id_ocorrencia,
        'id_filho_tarefa', r.id_filho_tarefa,
        'data_referencia', r.data_referencia,
        'observacao', r.observacao,
        'status', r.status,
        'created_at', r.created_at,
        'resolvido_em', r.resolvido_em
      )
      order by r.created_at desc
    ),
    '[]'::jsonb
  )
  into v_revisoes
  from public.t_revisao_tarefa_filho r
  join public.t_filho_tarefa ft
    on ft.id = r.id_filho_tarefa
  join public.t_vigencia v
    on v.id = ft.id_vigencia
   and v.id_usuario_pai = ft.id_usuario_pai
  where ft.id_usuario_pai = p_id_usuario_pai
    and ft.id_filho = p_id_filho
    and now() between v.data_inicio and v.data_fim;

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
    'revisoes',
    coalesce(v_revisoes, '[]'::jsonb),
    'comunicacao',
    coalesce(v_comunicacao, jsonb_build_object(
      'mensagem_global_ativa', false,
      'mensagem_global', null
    ))
  );
end;
$$;
