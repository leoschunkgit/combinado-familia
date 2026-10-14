CREATE OR REPLACE FUNCTION public.admin_feedback_excluir(
  p_feedback_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_admin_id bigint;
  v_nivel text;
  v_feedback public.t_feedback%ROWTYPE;
BEGIN
  v_admin_id := public.current_admin_id();

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado'
      USING ERRCODE = '42501';
  END IF;

  SELECT a.nivel
  INTO v_nivel
  FROM public.t_admin a
  WHERE a.id = v_admin_id
    AND a.ativo = true;

  IF v_nivel IS DISTINCT FROM 'MASTER' THEN
    RAISE EXCEPTION 'Somente o administrador MASTER pode excluir feedbacks'
      USING ERRCODE = '42501';
  END IF;

  SELECT f.*
  INTO v_feedback
  FROM public.t_feedback f
  WHERE f.id = p_feedback_id;

  IF v_feedback.id IS NULL THEN
    RAISE EXCEPTION 'Feedback não encontrado';
  END IF;

  PERFORM public.admin_auditar(
    'FEEDBACK_EXCLUIDO',
    'feedback',
    v_feedback.id::text,
    jsonb_build_object(
      'id_usuario_pai', v_feedback.id_usuario_pai,
      'tipo', v_feedback.tipo,
      'assunto', v_feedback.assunto,
      'created_at', v_feedback.created_at
    )
  );

  DELETE FROM public.t_feedback
  WHERE id = v_feedback.id;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_feedback_excluir(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_feedback_excluir(bigint) TO authenticated;
