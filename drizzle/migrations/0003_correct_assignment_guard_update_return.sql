CREATE OR REPLACE FUNCTION public.guard_assignment_history() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.t_ocorrencia o
    JOIN public.t_filho_tarefa ft ON ft.id = o.id_filho_tarefa
    WHERE ft.id_filho = OLD.id_filho AND ft.id_vigencia = OLD.id_vigencia
  ) THEN
    RAISE EXCEPTION 'Filho com Não fez nesta vigência: atribuição não pode ser editada ou excluída';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;