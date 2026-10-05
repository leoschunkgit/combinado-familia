-- Consolida RLS e permissoes das tabelas principais.
-- Mantem exclusao de t_usuario_pai exclusivamente pelo backend service_role.

ALTER TABLE public.t_usuario_pai ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_filho ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_tarefa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_vigencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_filho_tarefa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_ocorrencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.t_filho_acesso_publico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own pai select" ON public.t_usuario_pai;
DROP POLICY IF EXISTS "own pai insert" ON public.t_usuario_pai;
DROP POLICY IF EXISTS "own pai update" ON public.t_usuario_pai;

CREATE POLICY "own pai select"
ON public.t_usuario_pai
FOR SELECT TO authenticated
USING (auth_user_id = auth.uid());

CREATE POLICY "own pai insert"
ON public.t_usuario_pai
FOR INSERT TO authenticated
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "own pai update"
ON public.t_usuario_pai
FOR UPDATE TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.t_usuario_pai TO authenticated;
REVOKE DELETE ON public.t_usuario_pai FROM authenticated;
GRANT ALL ON public.t_usuario_pai TO service_role;

DROP POLICY IF EXISTS "own rows" ON public.t_filho;
DROP POLICY IF EXISTS "own rows" ON public.t_tarefa;
DROP POLICY IF EXISTS "own rows" ON public.t_vigencia;
DROP POLICY IF EXISTS "own rows" ON public.t_filho_tarefa;
DROP POLICY IF EXISTS "own rows" ON public.t_ocorrencia;

CREATE POLICY "own rows"
ON public.t_filho
FOR ALL TO authenticated
USING (id_usuario_pai = public.current_pai_id())
WITH CHECK (id_usuario_pai = public.current_pai_id());

CREATE POLICY "own rows"
ON public.t_tarefa
FOR ALL TO authenticated
USING (id_usuario_pai = public.current_pai_id())
WITH CHECK (id_usuario_pai = public.current_pai_id());

CREATE POLICY "own rows"
ON public.t_vigencia
FOR ALL TO authenticated
USING (id_usuario_pai = public.current_pai_id())
WITH CHECK (id_usuario_pai = public.current_pai_id());

CREATE POLICY "own rows"
ON public.t_filho_tarefa
FOR ALL TO authenticated
USING (id_usuario_pai = public.current_pai_id())
WITH CHECK (id_usuario_pai = public.current_pai_id());

CREATE POLICY "own rows"
ON public.t_ocorrencia
FOR ALL TO authenticated
USING (id_usuario_pai = public.current_pai_id())
WITH CHECK (id_usuario_pai = public.current_pai_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.t_filho TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.t_tarefa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.t_vigencia TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.t_filho_tarefa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.t_ocorrencia TO authenticated;

GRANT ALL ON public.t_filho TO service_role;
GRANT ALL ON public.t_tarefa TO service_role;
GRANT ALL ON public.t_vigencia TO service_role;
GRANT ALL ON public.t_filho_tarefa TO service_role;
GRANT ALL ON public.t_ocorrencia TO service_role;

DROP POLICY IF EXISTS t_filho_acesso_publico_parent_select ON public.t_filho_acesso_publico;
DROP POLICY IF EXISTS t_filho_acesso_publico_parent_insert ON public.t_filho_acesso_publico;
DROP POLICY IF EXISTS t_filho_acesso_publico_parent_update ON public.t_filho_acesso_publico;
DROP POLICY IF EXISTS t_filho_acesso_publico_parent_delete ON public.t_filho_acesso_publico;

CREATE POLICY t_filho_acesso_publico_parent_select
ON public.t_filho_acesso_publico
FOR SELECT TO authenticated
USING (id_usuario_pai = public.current_pai_id());

CREATE POLICY t_filho_acesso_publico_parent_insert
ON public.t_filho_acesso_publico
FOR INSERT TO authenticated
WITH CHECK (
  id_usuario_pai = public.current_pai_id()
  AND EXISTS (
    SELECT 1
    FROM public.t_filho f
    WHERE f.id = id_filho
      AND f.id_usuario_pai = public.current_pai_id()
  )
);

CREATE POLICY t_filho_acesso_publico_parent_update
ON public.t_filho_acesso_publico
FOR UPDATE TO authenticated
USING (id_usuario_pai = public.current_pai_id())
WITH CHECK (
  id_usuario_pai = public.current_pai_id()
  AND EXISTS (
    SELECT 1
    FROM public.t_filho f
    WHERE f.id = id_filho
      AND f.id_usuario_pai = public.current_pai_id()
  )
);

CREATE POLICY t_filho_acesso_publico_parent_delete
ON public.t_filho_acesso_publico
FOR DELETE TO authenticated
USING (id_usuario_pai = public.current_pai_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.t_filho_acesso_publico TO authenticated;
GRANT ALL ON public.t_filho_acesso_publico TO service_role;

REVOKE ALL ON public.t_filho_acesso_publico FROM anon;
REVOKE ALL ON public.t_filho FROM anon;
REVOKE ALL ON public.t_tarefa FROM anon;
REVOKE ALL ON public.t_vigencia FROM anon;
REVOKE ALL ON public.t_filho_tarefa FROM anon;
REVOKE ALL ON public.t_ocorrencia FROM anon;
REVOKE ALL ON public.t_usuario_pai FROM anon;