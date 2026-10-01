ALTER TABLE public.t_vigencia ADD COLUMN tipo_penalidade text NOT NULL DEFAULT 'texto';
ALTER TABLE public.t_vigencia ADD COLUMN valor_debito numeric(12,2);
ALTER TABLE public.t_vigencia ADD CONSTRAINT t_vigencia_tipo_penalidade_check CHECK (tipo_penalidade IN ('texto', 'mesada'));
ALTER TABLE public.t_vigencia ADD CONSTRAINT t_vigencia_valor_debito_check CHECK ((tipo_penalidade = 'texto' AND valor_debito IS NULL) OR (tipo_penalidade = 'mesada' AND valor_debito > 0));
COMMENT ON COLUMN public.t_vigencia.penalidade IS 'Texto da penalidade; string vazia quando tipo_penalidade = mesada, por compatibilidade com os registros existentes.';
CREATE OR REPLACE FUNCTION public.guard_mesada_assignment() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.t_vigencia v WHERE v.id = NEW.id_vigencia AND v.tipo_penalidade = 'mesada')
    AND NOT EXISTS (SELECT 1 FROM public.t_filho f WHERE f.id = NEW.id_filho AND f.tem_mesada AND f.valor_mesada IS NOT NULL) THEN
    RAISE EXCEPTION 'Filho sem valor de mesada cadastrado para esta vigência';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_mesada_assignment_before_change BEFORE INSERT OR UPDATE OF id_filho, id_vigencia ON public.t_filho_tarefa FOR EACH ROW EXECUTE FUNCTION public.guard_mesada_assignment();
CREATE OR REPLACE FUNCTION public.guard_mesada_validity() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tipo_penalidade = 'mesada' AND EXISTS (
    SELECT 1 FROM public.t_filho_tarefa ft JOIN public.t_filho f ON f.id = ft.id_filho
    WHERE ft.id_vigencia = NEW.id AND (NOT f.tem_mesada OR f.valor_mesada IS NULL)
  ) THEN
    RAISE EXCEPTION 'Há filho sem valor de mesada cadastrado nesta vigência';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_mesada_validity_before_change BEFORE UPDATE OF tipo_penalidade, valor_debito ON public.t_vigencia FOR EACH ROW EXECUTE FUNCTION public.guard_mesada_validity();
CREATE OR REPLACE FUNCTION public.guard_mesada_child() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NOT NEW.tem_mesada OR NEW.valor_mesada IS NULL) AND EXISTS (
    SELECT 1 FROM public.t_filho_tarefa ft JOIN public.t_vigencia v ON v.id = ft.id_vigencia
    WHERE ft.id_filho = NEW.id AND v.tipo_penalidade = 'mesada'
  ) THEN
    RAISE EXCEPTION 'Mesada vinculada a vigência com desconto não pode ser removida';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_mesada_child_before_change BEFORE UPDATE OF tem_mesada, valor_mesada ON public.t_filho FOR EACH ROW EXECUTE FUNCTION public.guard_mesada_child();