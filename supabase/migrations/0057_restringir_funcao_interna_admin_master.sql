-- 0057 - Restringe a função interna que protege o administrador MASTER.
-- A função é executada somente pelo trigger de t_admin e não deve ser chamada via API.

REVOKE ALL ON FUNCTION public.proteger_admin_master() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proteger_admin_master() FROM anon;
REVOKE ALL ON FUNCTION public.proteger_admin_master() FROM authenticated;
