CREATE TABLE IF NOT EXISTS public.t_app_config_signal (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  versao bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.t_app_config_signal (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.t_app_config_signal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read app config signal"
ON public.t_app_config_signal;

CREATE POLICY "authenticated read app config signal"
ON public.t_app_config_signal
FOR SELECT
TO authenticated
USING (true);

REVOKE ALL ON public.t_app_config_signal FROM anon, authenticated;
GRANT SELECT ON public.t_app_config_signal TO authenticated;

CREATE OR REPLACE FUNCTION public.sinalizar_app_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.t_app_config_signal
  SET
    versao = versao + 1,
    updated_at = now()
  WHERE id = 1;

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.sinalizar_app_config() FROM PUBLIC;

DROP TRIGGER IF EXISTS sinalizar_app_config_config
ON public.t_app_config;

CREATE TRIGGER sinalizar_app_config_config
AFTER INSERT OR UPDATE OR DELETE ON public.t_app_config
FOR EACH STATEMENT
EXECUTE FUNCTION public.sinalizar_app_config();

DROP TRIGGER IF EXISTS sinalizar_app_config_feature
ON public.t_app_feature_flag;

CREATE TRIGGER sinalizar_app_config_feature
AFTER INSERT OR UPDATE OR DELETE ON public.t_app_feature_flag
FOR EACH STATEMENT
EXECUTE FUNCTION public.sinalizar_app_config();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 't_app_config_signal'
  ) THEN
    ALTER PUBLICATION supabase_realtime
    ADD TABLE public.t_app_config_signal;
  END IF;
END;
$$;
