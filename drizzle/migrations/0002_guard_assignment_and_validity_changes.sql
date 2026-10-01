CREATE OR REPLACE FUNCTION public.guard_assignment_history() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.t_ocorrencia o
    JOIN public.t_filho_tarefa ft ON ft.id = o.id_filho_tarefa
    WHERE ft.id_filho = OLD.id_filho AND ft.id_vigencia = OLD.id_vigencia
  ) THEN
    RAISE EXCEPTION 'Filho com Não fez nesta vigência: atribuição não pode ser editada ou excluída';
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER guard_assignment_history_before_change BEFORE UPDATE OF id_filho, id_tarefa, id_vigencia OR DELETE ON public.t_filho_tarefa FOR EACH ROW EXECUTE FUNCTION public.guard_assignment_history();

CREATE OR REPLACE FUNCTION public.guard_validity_history() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.t_filho_tarefa WHERE id_vigencia = OLD.id) THEN
      RAISE EXCEPTION 'Vigência com atribuições não pode ser excluída';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.qtd_ocorrencia < COALESCE((
    SELECT max(total) FROM (
      SELECT sum(qtd_nao_fez) AS total FROM public.t_filho_tarefa
      WHERE id_vigencia = OLD.id GROUP BY id_filho
    ) AS totais
  ), 0) THEN
    RAISE EXCEPTION 'Limite menor que o número de Não fez já registrado';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.t_ocorrencia o
    JOIN public.t_filho_tarefa ft ON ft.id = o.id_filho_tarefa
    WHERE ft.id_vigencia = OLD.id
      AND ((o.created_at AT TIME ZONE 'America/Sao_Paulo')::date < (NEW.data_inicio AT TIME ZONE 'America/Sao_Paulo')::date
        OR (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date > (NEW.data_fim AT TIME ZONE 'America/Sao_Paulo')::date)
  ) THEN
    RAISE EXCEPTION 'Há datas de Não fez fora do novo período da vigência';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_validity_before_change BEFORE UPDATE OF data_inicio, data_fim, qtd_ocorrencia OR DELETE ON public.t_vigencia FOR EACH ROW EXECUTE FUNCTION public.guard_validity_history();