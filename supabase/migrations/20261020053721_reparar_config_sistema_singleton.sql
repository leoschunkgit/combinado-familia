
-- Garante o registro singleton usado pela Administração > Sistema.
INSERT INTO public.t_app_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_comunicacao_salvar(
  p_mensagem_global_ativa boolean,
  p_mensagem_global text,
  p_manutencao_ativa boolean,
  p_manutencao_mensagem text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_admin_id bigint;
  v_antes jsonb;
  v_depois jsonb;
BEGIN
  v_admin_id := public.current_admin_id();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado'
      USING ERRCODE = '42501';
  END IF;

  IF p_mensagem_global_ativa
     AND nullif(trim(coalesce(p_mensagem_global, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe a mensagem global antes de ativá-la';
  END IF;

  IF p_manutencao_ativa
     AND nullif(trim(coalesce(p_manutencao_mensagem, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe a mensagem de manutenção antes de ativá-la';
  END IF;

  INSERT INTO public.t_app_config (id)
  VALUES (1)
  ON CONFLICT (id) DO NOTHING;

  SELECT jsonb_build_object(
    'mensagem_global_ativa', c.mensagem_global_ativa,
    'mensagem_global', c.mensagem_global,
    'manutencao_ativa', c.manutencao_ativa,
    'manutencao_mensagem', c.manutencao_mensagem
  )
  INTO v_antes
  FROM public.t_app_config c
  WHERE c.id = 1;

  UPDATE public.t_app_config
  SET
    mensagem_global_ativa = coalesce(p_mensagem_global_ativa, false),
    mensagem_global = nullif(trim(coalesce(p_mensagem_global, '')), ''),
    manutencao_ativa = coalesce(p_manutencao_ativa, false),
    manutencao_mensagem = nullif(trim(coalesce(p_manutencao_mensagem, '')), ''),
    updated_at = now(),
    updated_by_admin_id = v_admin_id
  WHERE id = 1;

  SELECT public.app_config_publico()
  INTO v_depois;

  PERFORM public.admin_auditar(
    'COMUNICACAO_SISTEMA_ALTERADA',
    'app_config',
    '1',
    jsonb_build_object(
      'antes', v_antes,
      'depois', jsonb_build_object(
        'mensagem_global_ativa', v_depois->'mensagem_global_ativa',
        'mensagem_global', v_depois->'mensagem_global',
        'manutencao_ativa', v_depois->'manutencao_ativa',
        'manutencao_mensagem', v_depois->'manutencao_mensagem'
      )
    )
  );

  RETURN v_depois;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_versoes_salvar(
  p_android_min_version_name text,
  p_android_min_version_code integer,
  p_ios_min_version_name text,
  p_ios_min_version_code integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_admin_id bigint;
  v_antes jsonb;
  v_depois jsonb;
BEGIN
  v_admin_id := public.current_admin_id();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado'
      USING ERRCODE = '42501';
  END IF;

  IF p_android_min_version_code IS NOT NULL AND p_android_min_version_code <= 0 THEN
    RAISE EXCEPTION 'versionCode mínimo do Android inválido';
  END IF;

  IF p_ios_min_version_code IS NOT NULL AND p_ios_min_version_code <= 0 THEN
    RAISE EXCEPTION 'build mínimo do iOS inválido';
  END IF;

  INSERT INTO public.t_app_config (id)
  VALUES (1)
  ON CONFLICT (id) DO NOTHING;

  SELECT jsonb_build_object(
    'android_min_version_name', c.android_min_version_name,
    'android_min_version_code', c.android_min_version_code,
    'ios_min_version_name', c.ios_min_version_name,
    'ios_min_version_code', c.ios_min_version_code
  )
  INTO v_antes
  FROM public.t_app_config c
  WHERE c.id = 1;

  UPDATE public.t_app_config
  SET
    android_min_version_name = nullif(trim(coalesce(p_android_min_version_name, '')), ''),
    android_min_version_code = p_android_min_version_code,
    ios_min_version_name = nullif(trim(coalesce(p_ios_min_version_name, '')), ''),
    ios_min_version_code = p_ios_min_version_code,
    updated_at = now(),
    updated_by_admin_id = v_admin_id
  WHERE id = 1;

  SELECT public.app_config_publico()
  INTO v_depois;

  PERFORM public.admin_auditar(
    'VERSOES_MINIMAS_ALTERADAS',
    'app_config',
    '1',
    jsonb_build_object(
      'antes', v_antes,
      'depois', jsonb_build_object(
        'android_min_version_name', v_depois->'android_min_version_name',
        'android_min_version_code', v_depois->'android_min_version_code',
        'ios_min_version_name', v_depois->'ios_min_version_name',
        'ios_min_version_code', v_depois->'ios_min_version_code'
      )
    )
  );

  RETURN v_depois;
END;
$function$;
