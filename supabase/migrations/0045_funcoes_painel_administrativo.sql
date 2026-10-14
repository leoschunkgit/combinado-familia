CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.t_admin a
    JOIN public.t_usuario_pai p ON p.id = a.id_usuario_pai
    WHERE a.ativo = true
      AND p.auth_user_id = auth.uid()
  );
$function$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_resumo()
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

  SELECT jsonb_build_object(
    'usuarios', (SELECT count(*) FROM public.t_usuario_pai),
    'usuarios_7d', (SELECT count(*) FROM public.t_usuario_pai WHERE created_at >= now() - interval '7 days'),
    'usuarios_30d', (SELECT count(*) FROM public.t_usuario_pai WHERE created_at >= now() - interval '30 days'),
    'onboarding_concluido', (SELECT count(*) FROM public.t_usuario_pai WHERE onboarding_concluido = true),
    'filhos', (SELECT count(*) FROM public.t_filho),
    'tarefas', (SELECT count(*) FROM public.t_tarefa),
    'vigencias_ativas', (
      SELECT count(*)
      FROM public.t_vigencia
      WHERE now() BETWEEN data_inicio AND data_fim
    ),
    'vigencias_finalizadas', (
      SELECT count(*)
      FROM public.t_vigencia
      WHERE data_fim < now()
    ),
    'atribuicoes', (SELECT count(*) FROM public.t_filho_tarefa),
    'fez_hoje', (
      SELECT count(*)
      FROM public.t_ocorrencia
      WHERE tipo = 'FEZ'
        AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date =
            (now() AT TIME ZONE 'America/Sao_Paulo')::date
    ),
    'nao_fez_hoje', (
      SELECT count(*)
      FROM public.t_ocorrencia
      WHERE tipo = 'NAO_FEZ'
        AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date =
            (now() AT TIME ZONE 'America/Sao_Paulo')::date
    ),
    'links_publicos_ativos', (
      SELECT count(*)
      FROM public.t_filho_acesso_publico
      WHERE ativo = true
    ),
    'push_dispositivos', (SELECT count(*) FROM public.t_push_dispositivo),
    'push_ativos', (
      SELECT count(*)
      FROM public.t_push_dispositivo
      WHERE ativo = true
    ),
    'push_android_ativos', (
      SELECT count(*)
      FROM public.t_push_dispositivo
      WHERE ativo = true
        AND lower(plataforma) = 'android'
    ),
    'push_ios_ativos', (
      SELECT count(*)
      FROM public.t_push_dispositivo
      WHERE ativo = true
        AND lower(plataforma) = 'ios'
    ),
    'push_envios_hoje', (
      SELECT count(*)
      FROM public.t_push_envio
      WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date =
            (now() AT TIME ZONE 'America/Sao_Paulo')::date
    ),
    'admins_ativos', (
      SELECT count(*)
      FROM public.t_admin
      WHERE ativo = true
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_resumo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resumo() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_usuarios()
RETURNS TABLE (
  id bigint,
  nome text,
  email text,
  created_at timestamptz,
  onboarding_concluido boolean,
  qtd_filhos bigint,
  qtd_tarefas bigint,
  qtd_vigencias bigint,
  qtd_atribuicoes bigint,
  ultimo_movimento timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso administrativo não autorizado'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH filhos AS (
    SELECT id_usuario_pai, count(*) AS qtd, max(created_at) AS ultimo
    FROM public.t_filho
    GROUP BY id_usuario_pai
  ),
  tarefas AS (
    SELECT id_usuario_pai, count(*) AS qtd, max(created_at) AS ultimo
    FROM public.t_tarefa
    GROUP BY id_usuario_pai
  ),
  vigencias AS (
    SELECT id_usuario_pai, count(*) AS qtd, max(created_at) AS ultimo
    FROM public.t_vigencia
    GROUP BY id_usuario_pai
  ),
  atribuicoes AS (
    SELECT id_usuario_pai, count(*) AS qtd, max(created_at) AS ultimo
    FROM public.t_filho_tarefa
    GROUP BY id_usuario_pai
  ),
  ocorrencias AS (
    SELECT id_usuario_pai, max(created_at) AS ultimo
    FROM public.t_ocorrencia
    GROUP BY id_usuario_pai
  )
  SELECT
    p.id,
    p.nome,
    p.email,
    p.created_at,
    p.onboarding_concluido,
    COALESCE(f.qtd, 0),
    COALESCE(t.qtd, 0),
    COALESCE(v.qtd, 0),
    COALESCE(a.qtd, 0),
    GREATEST(
      p.created_at,
      f.ultimo,
      t.ultimo,
      v.ultimo,
      a.ultimo,
      o.ultimo
    ) AS ultimo_movimento
  FROM public.t_usuario_pai p
  LEFT JOIN filhos f ON f.id_usuario_pai = p.id
  LEFT JOIN tarefas t ON t.id_usuario_pai = p.id
  LEFT JOIN vigencias v ON v.id_usuario_pai = p.id
  LEFT JOIN atribuicoes a ON a.id_usuario_pai = p.id
  LEFT JOIN ocorrencias o ON o.id_usuario_pai = p.id
  ORDER BY p.created_at DESC, p.id DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_usuarios() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_usuarios() TO authenticated;
