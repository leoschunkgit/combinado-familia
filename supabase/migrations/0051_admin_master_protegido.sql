ALTER TABLE public.t_admin
ADD COLUMN IF NOT EXISTS nivel text NOT NULL DEFAULT 'ADMIN';

ALTER TABLE public.t_admin
DROP CONSTRAINT IF EXISTS t_admin_nivel_check;

ALTER TABLE public.t_admin
ADD CONSTRAINT t_admin_nivel_check
CHECK (nivel IN ('MASTER', 'ADMIN'));

UPDATE public.t_admin
SET nivel = 'MASTER',
    ativo = true
WHERE id_usuario_pai = 23;

CREATE UNIQUE INDEX IF NOT EXISTS uq_t_admin_master_unico
ON public.t_admin ((nivel))
WHERE nivel = 'MASTER';

CREATE OR REPLACE FUNCTION public.proteger_admin_master()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.nivel = 'MASTER' THEN
    RAISE EXCEPTION 'O administrador MASTER não pode ser removido';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.nivel = 'MASTER' THEN
    IF NEW.ativo = false THEN
      RAISE EXCEPTION 'O administrador MASTER não pode ser desativado';
    END IF;

    IF NEW.nivel <> 'MASTER' THEN
      RAISE EXCEPTION 'O administrador MASTER não pode ser rebaixado';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS proteger_admin_master ON public.t_admin;

CREATE TRIGGER proteger_admin_master
BEFORE UPDATE OR DELETE ON public.t_admin
FOR EACH ROW
EXECUTE FUNCTION public.proteger_admin_master();

CREATE OR REPLACE FUNCTION public.admin_listar_admins()
RETURNS TABLE (
  id bigint,
  id_usuario_pai bigint,
  nome text,
  email text,
  ativo boolean,
  nivel text,
  created_at timestamptz,
  ultimo_acesso timestamptz,
  eh_atual boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_admin_id bigint;
BEGIN
  v_admin_id := public.current_admin_id();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.id_usuario_pai,
    p.nome,
    p.email,
    a.ativo,
    a.nivel,
    a.created_at,
    tel.last_seen_at,
    a.id = v_admin_id
  FROM public.t_admin a
  JOIN public.t_usuario_pai p ON p.id = a.id_usuario_pai
  LEFT JOIN public.t_app_telemetria tel ON tel.id_usuario_pai = p.id
  ORDER BY
    CASE WHEN a.nivel = 'MASTER' THEN 0 ELSE 1 END,
    a.ativo DESC,
    a.created_at ASC,
    a.id ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_listar_admins() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_listar_admins() TO authenticated;

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

  IF v_alvo.nivel = 'MASTER' AND p_ativo = false THEN
    RAISE EXCEPTION 'O administrador MASTER não pode ser desativado';
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
      'nivel', v_alvo.nivel,
      'ativo_anterior', v_alvo.ativo,
      'ativo_novo', p_ativo
    )
  );

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_definir_status(bigint, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_definir_status(bigint, boolean) TO authenticated;
