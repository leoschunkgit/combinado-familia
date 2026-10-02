-- Remove CPF do cadastro do responsável.
-- O trigger é atualizado antes da coluna ser removida para que novos
-- usuários do Supabase Auth não tentem mais gravar CPF.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.t_usuario_pai (
    auth_user_id,
    nome,
    email
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', ''),
    COALESCE(NEW.email, '')
  );

  RETURN NEW;
END;
$$;

ALTER TABLE public.t_usuario_pai
DROP COLUMN IF EXISTS cpf;
