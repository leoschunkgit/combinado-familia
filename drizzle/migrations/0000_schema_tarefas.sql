CREATE TABLE public.t_usuario_pai (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auth_user_id uuid NOT NULL UNIQUE DEFAULT auth.uid(),
  nome text NOT NULL,
  cpf text NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.t_usuario_pai TO authenticated;
GRANT ALL ON public.t_usuario_pai TO service_role;
ALTER TABLE public.t_usuario_pai ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pai select" ON public.t_usuario_pai FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
CREATE POLICY "own pai insert" ON public.t_usuario_pai FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "own pai update" ON public.t_usuario_pai FOR UPDATE TO authenticated USING (auth_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.current_pai_id() RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.t_usuario_pai WHERE auth_user_id = auth.uid()
$$;

CREATE TABLE public.t_filho (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario_pai bigint NOT NULL DEFAULT public.current_pai_id() REFERENCES public.t_usuario_pai(id) ON DELETE CASCADE,
  nome text NOT NULL,
  celular text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.t_vigencia (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario_pai bigint NOT NULL DEFAULT public.current_pai_id() REFERENCES public.t_usuario_pai(id) ON DELETE CASCADE,
  data_inicio timestamptz NOT NULL,
  data_fim timestamptz NOT NULL,
  penalidade text NOT NULL,
  qtd_ocorrencia integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.t_tarefa (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario_pai bigint NOT NULL DEFAULT public.current_pai_id() REFERENCES public.t_usuario_pai(id) ON DELETE CASCADE,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.t_filho_tarefa (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario_pai bigint NOT NULL DEFAULT public.current_pai_id() REFERENCES public.t_usuario_pai(id) ON DELETE CASCADE,
  id_filho bigint NOT NULL REFERENCES public.t_filho(id) ON DELETE CASCADE,
  id_tarefa bigint NOT NULL REFERENCES public.t_tarefa(id) ON DELETE CASCADE,
  id_vigencia bigint NOT NULL REFERENCES public.t_vigencia(id) ON DELETE CASCADE,
  feito text DEFAULT NULL,
  qtd_nao_fez integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id_filho, id_tarefa, id_vigencia)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['t_filho','t_vigencia','t_tarefa','t_filho_tarefa'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "own rows" ON public.%I FOR ALL TO authenticated USING (id_usuario_pai = public.current_pai_id()) WITH CHECK (id_usuario_pai = public.current_pai_id())', t);
  END LOOP;
END $$;