-- Endurece permissoes de funcoes internas e do helper de identidade do responsavel.

CREATE OR REPLACE FUNCTION public.current_pai_id()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id
  FROM public.t_usuario_pai p
  WHERE p.auth_user_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.current_pai_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_pai_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_pai_id() TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_filho_acesso_publico_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_assignment_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_validity_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_occurrence_active_validity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalcular_estado_atribuicao(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalcular_estado_atribuicao_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_nao_fez_limit() FROM PUBLIC;
