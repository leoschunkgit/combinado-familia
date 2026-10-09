-- 0040 - Corrige a clonagem de vigencia apos a penalidade passar a ser informada
-- somente quando o limite de "Nao fez" for atingido.
--
-- A assinatura da RPC e mantida por compatibilidade com o front atual, mas
-- p_penalidade deixa de ser exigida/copiada. A nova vigencia sempre nasce sem
-- penalidade aplicada, como exige a regra atual.

CREATE OR REPLACE FUNCTION public.duplicar_vigencia_com_atribuicoes(
  p_modelo_id bigint,
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_penalidade text,
  p_qtd_ocorrencia integer,
  p_valor_debito numeric
)
RETURNS TABLE(id_vigencia bigint, qtd_atribuicoes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pai_id bigint;
  v_modelo_fim timestamptz;
  v_nova_id bigint;
  v_qtd integer;
BEGIN
  SELECT p.id
    INTO v_pai_id
  FROM public.t_usuario_pai p
  WHERE p.auth_user_id = auth.uid();

  IF v_pai_id IS NULL THEN
    RAISE EXCEPTION 'Responsável não encontrado';
  END IF;

  SELECT v.data_fim
    INTO v_modelo_fim
  FROM public.t_vigencia v
  WHERE v.id = p_modelo_id
    AND v.id_usuario_pai = v_pai_id;

  IF v_modelo_fim IS NULL THEN
    RAISE EXCEPTION 'Vigência modelo não encontrada';
  END IF;

  IF p_data_fim <= p_data_inicio THEN
    RAISE EXCEPTION 'A data/hora fim deve ser posterior à data/hora início';
  END IF;

  IF p_data_inicio <= v_modelo_fim THEN
    RAISE EXCEPTION 'A nova vigência deve começar depois do término da vigência modelo';
  END IF;

  IF p_qtd_ocorrencia < 1 OR p_qtd_ocorrencia > 31 THEN
    RAISE EXCEPTION 'Quantidade de Não fez inválida';
  END IF;

  IF p_valor_debito IS NULL OR p_valor_debito <= 0 THEN
    RAISE EXCEPTION 'Valor de desconto inválido';
  END IF;

  INSERT INTO public.t_vigencia (
    id_usuario_pai,
    data_inicio,
    data_fim,
    penalidade,
    qtd_ocorrencia,
    tipo_penalidade,
    valor_debito
  )
  VALUES (
    v_pai_id,
    p_data_inicio,
    p_data_fim,
    NULL,
    p_qtd_ocorrencia,
    'texto',
    p_valor_debito
  )
  RETURNING id INTO v_nova_id;

  INSERT INTO public.t_filho_tarefa (
    id_usuario_pai,
    id_vigencia,
    id_filho,
    id_tarefa
  )
  SELECT
    v_pai_id,
    v_nova_id,
    ft.id_filho,
    ft.id_tarefa
  FROM public.t_filho_tarefa ft
  WHERE ft.id_usuario_pai = v_pai_id
    AND ft.id_vigencia = p_modelo_id;

  GET DIAGNOSTICS v_qtd = ROW_COUNT;

  RETURN QUERY SELECT v_nova_id, v_qtd;
END;
$$;

REVOKE ALL ON FUNCTION public.duplicar_vigencia_com_atribuicoes(bigint, timestamptz, timestamptz, text, integer, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.duplicar_vigencia_com_atribuicoes(bigint, timestamptz, timestamptz, text, integer, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.duplicar_vigencia_com_atribuicoes(bigint, timestamptz, timestamptz, text, integer, numeric) TO authenticated;
