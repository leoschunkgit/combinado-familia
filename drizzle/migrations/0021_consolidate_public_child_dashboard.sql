-- Consolida o RPC publico do painel do filho.
-- Mantem apenas leitura via token, inclui responsavel, Fez/Nao fez e bonificacoes,
-- e calcula qtd_nao_fez pelas ocorrencias reais.

CREATE OR REPLACE FUNCTION public.obter_painel_publico_filho(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pai_id bigint;
  v_filho_id bigint;
  v_result jsonb;
BEGIN
  SELECT a.id_usuario_pai, a.id_filho
    INTO v_pai_id, v_filho_id
  FROM public.t_filho_acesso_publico a
  JOIN public.t_filho f
    ON f.id = a.id_filho
   AND f.id_usuario_pai = a.id_usuario_pai
  WHERE a.token = p_token
    AND a.ativo = true
  LIMIT 1;

  IF v_pai_id IS NULL OR v_filho_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'responsavel', jsonb_build_object('nome', p.nome),
    'filho', jsonb_build_object(
      'nome', f.nome,
      'tem_mesada', COALESCE(f.tem_mesada_opcional, false) AND f.valor_mesada IS NOT NULL,
      'valor_mesada', f.valor_mesada
    ),
    'vigencias', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'data_inicio', v.data_inicio,
          'data_fim', v.data_fim,
          'penalidade', v.penalidade,
          'qtd_ocorrencia', v.qtd_ocorrencia,
          'tipo_penalidade', v.tipo_penalidade,
          'valor_debito', v.valor_debito,
          'tarefas', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', ft.id,
                'nome', t.nome,
                'feito', ft.feito,
                'qtd_nao_fez', (
                  SELECT count(*)::integer
                  FROM public.t_ocorrencia oc
                  WHERE oc.id_filho_tarefa = ft.id
                    AND oc.id_usuario_pai = v_pai_id
                    AND oc.tipo <> 'FEZ'
                ),
                'ocorrencias', COALESCE((
                  SELECT jsonb_agg(
                    jsonb_build_object(
                      'tipo', o.tipo,
                      'data', o.created_at,
                      'bonificacao_tipo', o.bonificacao_tipo,
                      'bonificacao_descricao', o.bonificacao_descricao,
                      'bonificacao_valor', o.bonificacao_valor
                    )
                    ORDER BY o.created_at DESC
                  )
                  FROM public.t_ocorrencia o
                  WHERE o.id_filho_tarefa = ft.id
                    AND o.id_usuario_pai = v_pai_id
                ), '[]'::jsonb)
              )
              ORDER BY t.nome
            )
            FROM public.t_filho_tarefa ft
            JOIN public.t_tarefa t
              ON t.id = ft.id_tarefa
             AND t.id_usuario_pai = v_pai_id
            WHERE ft.id_vigencia = v.id
              AND ft.id_filho = v_filho_id
              AND ft.id_usuario_pai = v_pai_id
          ), '[]'::jsonb)
        )
        ORDER BY
          CASE
            WHEN now() BETWEEN v.data_inicio AND v.data_fim THEN 0
            WHEN now() < v.data_inicio THEN 1
            ELSE 2
          END,
          CASE WHEN now() < v.data_inicio THEN v.data_inicio END ASC,
          CASE WHEN now() > v.data_fim THEN v.data_inicio END DESC,
          v.data_inicio ASC
      )
      FROM public.t_vigencia v
      WHERE v.id_usuario_pai = v_pai_id
        AND EXISTS (
          SELECT 1
          FROM public.t_filho_tarefa ft
          WHERE ft.id_vigencia = v.id
            AND ft.id_filho = v_filho_id
            AND ft.id_usuario_pai = v_pai_id
        )
    ), '[]'::jsonb),
    'atualizado_em', now()
  )
  INTO v_result
  FROM public.t_filho f
  JOIN public.t_usuario_pai p ON p.id = v_pai_id
  WHERE f.id = v_filho_id
    AND f.id_usuario_pai = v_pai_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.obter_painel_publico_filho(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_painel_publico_filho(uuid) TO anon, authenticated;
