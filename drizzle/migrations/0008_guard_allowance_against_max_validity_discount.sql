CREATE OR REPLACE FUNCTION public.guard_allowance_assignment_limit() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  child_row public.t_filho%ROWTYPE;
  validity_row public.t_vigencia%ROWTYPE;
BEGIN
  SELECT * INTO child_row FROM public.t_filho WHERE id = NEW.id_filho FOR SHARE;
  SELECT * INTO validity_row FROM public.t_vigencia WHERE id = NEW.id_vigencia FOR SHARE;
  IF child_row.tem_mesada_opcional IS TRUE
     AND child_row.valor_mesada IS NOT NULL
     AND validity_row.valor_debito IS NOT NULL
     AND validity_row.valor_debito * validity_row.qtd_ocorrencia > child_row.valor_mesada THEN
    RAISE EXCEPTION 'Desconto máximo da vigência supera a mesada do filho';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_allowance_assignment_limit_before_change BEFORE INSERT OR UPDATE OF id_filho, id_vigencia ON public.t_filho_tarefa FOR EACH ROW EXECUTE FUNCTION public.guard_allowance_assignment_limit();

CREATE OR REPLACE FUNCTION public.guard_allowance_child_limit() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tem_mesada_opcional IS TRUE AND NEW.valor_mesada IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.t_filho_tarefa ft
    JOIN public.t_vigencia v ON v.id = ft.id_vigencia
    WHERE ft.id_filho = NEW.id AND v.valor_debito IS NOT NULL
      AND v.valor_debito * v.qtd_ocorrencia > NEW.valor_mesada
  ) THEN
    RAISE EXCEPTION 'Desconto máximo da vigência supera a mesada do filho';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_allowance_child_limit_before_change BEFORE UPDATE OF tem_mesada_opcional, valor_mesada ON public.t_filho FOR EACH ROW EXECUTE FUNCTION public.guard_allowance_child_limit();

CREATE OR REPLACE FUNCTION public.guard_allowance_validity_limit() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.valor_debito IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.t_filho_tarefa ft
    JOIN public.t_filho f ON f.id = ft.id_filho
    WHERE ft.id_vigencia = NEW.id AND f.tem_mesada_opcional IS TRUE
      AND f.valor_mesada IS NOT NULL
      AND NEW.valor_debito * NEW.qtd_ocorrencia > f.valor_mesada
  ) THEN
    RAISE EXCEPTION 'Desconto máximo da vigência supera a mesada do filho';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_allowance_validity_limit_before_change BEFORE UPDATE OF valor_debito, qtd_ocorrencia ON public.t_vigencia FOR EACH ROW EXECUTE FUNCTION public.guard_allowance_validity_limit();