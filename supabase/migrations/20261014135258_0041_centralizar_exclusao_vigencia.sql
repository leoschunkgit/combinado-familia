-- 0041 - Centraliza a regra de exclusao de vigencia.
--
-- Regras:
-- 1. Qualquer vigencia com ao menos um registro de Fez/Nao fez e historico e nao pode ser excluida.
-- 2. Vigencia em andamento com atribuicoes continua protegida, mesmo sem ocorrencias.
-- 3. Vigencia finalizada sem Fez/Nao fez pode ser excluida, com ou sem atribuicoes.
-- 4. Vigencia futura continua podendo ser excluida; atribuicoes sem historico sao removidas junto.
--
-- A remocao das atribuicoes e da vigencia acontece na mesma transacao da RPC.

CREATE OR REPLACE FUNCTION public.excluir_vigencia_com_regra(
  p_id_vigencia bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pai_id bigint;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_tem_atribuicoes boolean;
  v_tem_historico boolean;
BEGIN
  SELECT p.id
    INTO v_pai_id
  FROM public.t_usuario_pai p
  WHERE p.auth_user_id = auth.uid();

  IF v_pai_id IS NULL THEN
    RAISE EXCEPTION 'Responsável não encontrado';
  END IF;

  SELECT v.data_inicio, v.data_fim
    INTO v_inicio, v_fim
  FROM public.t_vigencia v
  WHERE v.id = p_id_vigencia
    AND v.id_usuario_pai = v_pai_id;

  IF v_inicio IS NULL OR v_fim IS NULL THEN
    RAISE EXCEPTION 'Vigência não encontrada';
  END IF;

  -- Bloqueia as atribuicoes desta vigencia durante a verificacao/exclusao.
  -- Isso evita que um Fez/Nao fez seja criado concorrentemente entre a checagem
  -- de historico e a remocao das atribuicoes.
  PERFORM 1
  FROM public.t_filho_tarefa ft
  WHERE ft.id_vigencia = p_id_vigencia
    AND ft.id_usuario_pai = v_pai_id
  FOR UPDATE;

  SELECT EXISTS (
    SELECT 1
    FROM public.t_filho_tarefa ft
    WHERE ft.id_vigencia = p_id_vigencia
      AND ft.id_usuario_pai = v_pai_id
  )
  INTO v_tem_atribuicoes;

  SELECT EXISTS (
    SELECT 1
    FROM public.t_ocorrencia o
    JOIN public.t_filho_tarefa ft
      ON ft.id = o.id_filho_tarefa
     AND ft.id_usuario_pai = o.id_usuario_pai
    WHERE ft.id_vigencia = p_id_vigencia
      AND ft.id_usuario_pai = v_pai_id
  )
  INTO v_tem_historico;

  IF v_tem_historico THEN
    RAISE EXCEPTION 'Vigência com registros de Fez/Não fez não pode ser excluída';
  END IF;

  IF now() >= v_inicio
     AND now() <= v_fim
     AND v_tem_atribuicoes THEN
    RAISE EXCEPTION 'Vigência em andamento com atribuições não pode ser excluída';
  END IF;

  DELETE FROM public.t_filho_tarefa ft
  WHERE ft.id_vigencia = p_id_vigencia
    AND ft.id_usuario_pai = v_pai_id;

  DELETE FROM public.t_vigencia v
  WHERE v.id = p_id_vigencia
    AND v.id_usuario_pai = v_pai_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_vigencia_com_regra(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.excluir_vigencia_com_regra(bigint) FROM anon;
GRANT EXECUTE ON FUNCTION public.excluir_vigencia_com_regra(bigint) TO authenticated;

COMMENT ON FUNCTION public.excluir_vigencia_com_regra(bigint) IS
  'Exclui vigencia sem historico de Fez/Nao fez; preserva vigencias em andamento que ainda possuem atribuicoes.';
