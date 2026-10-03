CREATE OR REPLACE FUNCTION public.gerar_acesso_publico_filho(p_id_filho bigint)
RETURNS TABLE(token uuid, ativo boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pai_id bigint;
BEGIN
  SELECT p.id
    INTO v_pai_id
  FROM public.t_usuario_pai p
  WHERE p.auth_user_id = auth.uid();

  IF v_pai_id IS NULL THEN
    RAISE EXCEPTION 'Responsável não encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.t_filho f
    WHERE f.id = p_id_filho
      AND f.id_usuario_pai = v_pai_id
  ) THEN
    RAISE EXCEPTION 'Filho não encontrado para este responsável';
  END IF;

  INSERT INTO public.t_filho_acesso_publico (id_usuario_pai, id_filho, ativo)
  VALUES (v_pai_id, p_id_filho, true)
  ON CONFLICT (id_usuario_pai, id_filho)
  DO UPDATE SET
    token = CASE
      WHEN public.t_filho_acesso_publico.ativo = false THEN gen_random_uuid()
      ELSE public.t_filho_acesso_publico.token
    END,
    ativo = true,
    updated_at = now();

  RETURN QUERY
  SELECT a.token, a.ativo
  FROM public.t_filho_acesso_publico a
  WHERE a.id_usuario_pai = v_pai_id
    AND a.id_filho = p_id_filho;
END;
$$;
