-- Corrige a chamada interna do recálculo após o hardening da 0031.
-- A função continua sem EXECUTE público; triggers podem executá-la com privilégio do owner.

CREATE OR REPLACE FUNCTION public.recalcular_estado_atribuicao(p_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_filho bigint;
  v_vigencia bigint;
  v_qtd integer;
  v_total integer;
  v_limite integer;
  v_mesada boolean;
BEGIN
  SELECT ft.id_filho, ft.id_vigencia
    INTO v_filho, v_vigencia
  FROM public.t_filho_tarefa ft
  WHERE ft.id = p_id;

  IF v_filho IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*)::integer
    INTO v_qtd
  FROM public.t_ocorrencia o
  WHERE o.id_filho_tarefa = p_id
    AND o.tipo = 'NAO_FEZ';

  UPDATE public.t_filho_tarefa
  SET qtd_nao_fez = v_qtd
  WHERE id = p_id;

  SELECT count(o.id)::integer,
         v.qtd_ocorrencia,
         COALESCE(f.tem_mesada_opcional, false) AND f.valor_mesada IS NOT NULL
    INTO v_total, v_limite, v_mesada
  FROM public.t_filho_tarefa ft
  JOIN public.t_vigencia v ON v.id = ft.id_vigencia
  JOIN public.t_filho f ON f.id = ft.id_filho
  LEFT JOIN public.t_ocorrencia o
    ON o.id_filho_tarefa = ft.id
   AND o.tipo = 'NAO_FEZ'
  WHERE ft.id_filho = v_filho
    AND ft.id_vigencia = v_vigencia
  GROUP BY v.qtd_ocorrencia, f.tem_mesada_opcional, f.valor_mesada;

  UPDATE public.t_filho_tarefa
  SET feito = CASE
    WHEN NOT v_mesada AND v_total >= v_limite THEN 'N'
    ELSE NULL
  END
  WHERE id_filho = v_filho
    AND id_vigencia = v_vigencia;
END;
$$;

REVOKE ALL ON FUNCTION public.recalcular_estado_atribuicao(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalcular_estado_atribuicao(bigint) FROM anon;
REVOKE ALL ON FUNCTION public.recalcular_estado_atribuicao(bigint) FROM authenticated;
