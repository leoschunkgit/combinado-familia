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
    SELECT f.id_usuario_pai, count(*) AS qtd, max(f.created_at) AS ultimo
    FROM public.t_filho f
    GROUP BY f.id_usuario_pai
  ),
  tarefas AS (
    SELECT t.id_usuario_pai, count(*) AS qtd, max(t.created_at) AS ultimo
    FROM public.t_tarefa t
    GROUP BY t.id_usuario_pai
  ),
  vigencias AS (
    SELECT v.id_usuario_pai, count(*) AS qtd, max(v.created_at) AS ultimo
    FROM public.t_vigencia v
    GROUP BY v.id_usuario_pai
  ),
  atribuicoes AS (
    SELECT a.id_usuario_pai, count(*) AS qtd, max(a.created_at) AS ultimo
    FROM public.t_filho_tarefa a
    GROUP BY a.id_usuario_pai
  ),
  ocorrencias AS (
    SELECT o.id_usuario_pai, max(o.created_at) AS ultimo
    FROM public.t_ocorrencia o
    GROUP BY o.id_usuario_pai
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
