CREATE OR REPLACE FUNCTION public.admin_diagnostico(
  p_version_name text DEFAULT NULL,
  p_version_code integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado'
      USING ERRCODE = '42501';
  END IF;

  WITH base AS (
    SELECT
      p.id,
      p.nome,
      p.email,
      p.created_at,
      p.onboarding_concluido,
      tel.last_seen_at,
      tel.plataforma,
      tel.version_name,
      tel.version_code,
      EXISTS (
        SELECT 1 FROM public.t_vigencia v
        WHERE v.id_usuario_pai = p.id
      ) AS tem_vigencia,
      EXISTS (
        SELECT 1 FROM public.t_filho_tarefa ft
        WHERE ft.id_usuario_pai = p.id
      ) AS tem_atribuicao,
      EXISTS (
        SELECT 1 FROM public.t_push_dispositivo pd
        WHERE pd.id_usuario_pai = p.id
          AND pd.ativo = true
      ) AS tem_push_ativo
    FROM public.t_usuario_pai p
    LEFT JOIN public.t_app_telemetria tel
      ON tel.id_usuario_pai = p.id
  ),
  funnel AS (
    SELECT jsonb_build_object(
      'cadastrados', (SELECT count(*) FROM public.t_usuario_pai),
      'onboarding', (SELECT count(*) FROM public.t_usuario_pai WHERE onboarding_concluido = true),
      'com_filho', (
        SELECT count(DISTINCT f.id_usuario_pai)
        FROM public.t_filho f
      ),
      'com_tarefa', (
        SELECT count(DISTINCT t.id_usuario_pai)
        FROM public.t_tarefa t
      ),
      'com_vigencia', (
        SELECT count(DISTINCT v.id_usuario_pai)
        FROM public.t_vigencia v
      ),
      'com_atribuicao', (
        SELECT count(DISTINCT ft.id_usuario_pai)
        FROM public.t_filho_tarefa ft
      ),
      'com_marcacao', (
        SELECT count(DISTINCT o.id_usuario_pai)
        FROM public.t_ocorrencia o
      )
    ) AS dados
  )
  SELECT jsonb_build_object(
    'atencao', jsonb_build_object(
      'onboarding_pendente', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', b.id,
          'nome', b.nome,
          'email', b.email,
          'created_at', b.created_at,
          'last_seen_at', b.last_seen_at,
          'plataforma', b.plataforma,
          'version_name', b.version_name,
          'version_code', b.version_code
        ) ORDER BY b.created_at DESC)
        FROM base b
        WHERE b.onboarding_concluido = false
      ), '[]'::jsonb),
      'sem_vigencia', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', b.id,
          'nome', b.nome,
          'email', b.email,
          'created_at', b.created_at,
          'last_seen_at', b.last_seen_at,
          'plataforma', b.plataforma,
          'version_name', b.version_name,
          'version_code', b.version_code
        ) ORDER BY b.created_at DESC)
        FROM base b
        WHERE b.tem_vigencia = false
      ), '[]'::jsonb),
      'sem_atribuicao', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', b.id,
          'nome', b.nome,
          'email', b.email,
          'created_at', b.created_at,
          'last_seen_at', b.last_seen_at,
          'plataforma', b.plataforma,
          'version_name', b.version_name,
          'version_code', b.version_code
        ) ORDER BY b.created_at DESC)
        FROM base b
        WHERE b.tem_atribuicao = false
      ), '[]'::jsonb),
      'sem_acesso_15d', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', b.id,
          'nome', b.nome,
          'email', b.email,
          'created_at', b.created_at,
          'last_seen_at', b.last_seen_at,
          'plataforma', b.plataforma,
          'version_name', b.version_name,
          'version_code', b.version_code
        ) ORDER BY b.last_seen_at ASC)
        FROM base b
        WHERE b.last_seen_at IS NOT NULL
          AND b.last_seen_at < now() - interval '15 days'
      ), '[]'::jsonb),
      'versao_desatualizada', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', b.id,
          'nome', b.nome,
          'email', b.email,
          'created_at', b.created_at,
          'last_seen_at', b.last_seen_at,
          'plataforma', b.plataforma,
          'version_name', b.version_name,
          'version_code', b.version_code
        ) ORDER BY b.last_seen_at DESC NULLS LAST)
        FROM base b
        WHERE p_version_code IS NOT NULL
          AND b.version_code IS NOT NULL
          AND b.version_code < p_version_code
      ), '[]'::jsonb),
      'sem_push_ativo', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', b.id,
          'nome', b.nome,
          'email', b.email,
          'created_at', b.created_at,
          'last_seen_at', b.last_seen_at,
          'plataforma', b.plataforma,
          'version_name', b.version_name,
          'version_code', b.version_code
        ) ORDER BY b.created_at DESC)
        FROM base b
        WHERE b.tem_push_ativo = false
      ), '[]'::jsonb)
    ),
    'funil', (SELECT dados FROM funnel)
  )
  INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_diagnostico(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_diagnostico(text, integer) TO authenticated;
