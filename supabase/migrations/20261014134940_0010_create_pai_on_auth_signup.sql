-- Garante que todo novo usuário do Supabase Auth tenha seu responsável
-- correspondente em public.t_usuario_pai.
--
-- A aplicação envia nome e CPF em raw_user_meta_data no signUp().
-- O trigger roda no banco, inclusive quando a confirmação de email está habilitada.

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
    cpf,
    email
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'cpf', ''),
    COALESCE(NEW.email, '')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
after INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();
