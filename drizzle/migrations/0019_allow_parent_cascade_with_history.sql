-- Ajusta a protecao de atribuicoes para nao bloquear exclusoes em cascata.
-- Exclusao direta de uma atribuicao com historico continua bloqueada.
-- Quando filho, tarefa ou vigencia pai ja estiver sendo removido, o cascade pode prosseguir.

CREATE OR REPLACE FUNCTION public.guard_assignment_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_parentes_existentes boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT
      EXISTS (SELECT 1 FROM public.t_filho f WHERE f.id = OLD.id_filho)
      AND EXISTS (SELECT 1 FROM public.t_tarefa t WHERE t.id = OLD.id_tarefa)
      AND EXISTS (SELECT 1 FROM public.t_vigencia v WHERE v.id = OLD.id_vigencia)
    INTO v_parentes_existentes;

    IF v_parentes_existentes
       AND EXISTS (
         SELECT 1
         FROM public.t_ocorrencia o
         WHERE o.id_filho_tarefa = OLD.id
       ) THEN
      RAISE EXCEPTION 'Atribuicao com Fez/Nao fez nao pode ser excluida diretamente';
    END IF;

    RETURN OLD;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.t_ocorrencia o
    WHERE o.id_filho_tarefa = OLD.id
  ) THEN
    RAISE EXCEPTION 'Atribuicao com Fez/Nao fez nao pode ser editada';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_assignment_history_before_change
ON public.t_filho_tarefa;

CREATE TRIGGER guard_assignment_history_before_change
BEFORE UPDATE OF id_filho, id_tarefa, id_vigencia OR DELETE
ON public.t_filho_tarefa
FOR EACH ROW
EXECUTE FUNCTION public.guard_assignment_history();