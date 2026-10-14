CREATE OR REPLACE FUNCTION public.admin_definir_status(
  p_admin_id bigint,
  p_ativo boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_admin_atual bigint;
  v_alvo public.t_admin%ROWTYPE;
  v_ativos integer;
  v_usuario public.t_usuario_pai%ROWTYPE;
BEGIN
  v_admin_atual := public.current_admin_id();
  IF v_admin_atual IS NULL THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado'
      USING ERRCODE = '42501';
  END IF;

  SELECT a.*
  INTO v_alvo
  FROM public.t_admin a
  WHERE a.id = p_admin_id;

  IF v_alvo.id IS NULL THEN
    RAISE EXCEPTION 'Administrador não encontrado';
  END IF;

  IF p_ativo = false AND p_admin_id = v_admin_atual THEN
    RAISE EXCEPTION 'Você não pode desativar o próprio acesso administrativo';
  END IF;

  IF p_ativo = false AND v_alvo.ativo = true THEN
    SELECT count(*)
    INTO v_ativos
    FROM public.t_admin
    WHERE ativo = true;

    IF v_ativos <= 1 THEN
      RAISE EXCEPTION 'Não é possível desativar o último administrador ativo';
    END IF;
  END IF;

  SELECT p.*
  INTO v_usuario
  FROM public.t_usuario_pai p
  WHERE p.id = v_alvo.id_usuario_pai;

  UPDATE public.t_admin
  SET ativo = p_ativo
  WHERE id = p_admin_id;

  PERFORM public.admin_auditar(
    CASE WHEN p_ativo THEN 'ADMIN_ATIVADO' ELSE 'ADMIN_DESATIVADO' END,
    'admin',
    p_admin_id::text,
    jsonb_build_object(
      'id_usuario_pai', v_alvo.id_usuario_pai,
      'nome', v_usuario.nome,
      'email', v_usuario.email,
      'ativo_anterior', v_alvo.ativo,
      'ativo_novo', p_ativo
    )
  );

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_definir_status(bigint, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_definir_status(bigint, boolean) TO authenticated;
