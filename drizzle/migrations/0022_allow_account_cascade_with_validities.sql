-- Permite cascata de exclusao da conta sem liberar exclusao direta indevida de vigencia.
-- Se o responsavel ainda existe, vigencia com atribuicoes continua protegida.

CREATE OR REPLACE FUNCTION public.guard_validity_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1
      FROM public.t_usuario_pai p
      WHERE p.id = OLD.id_usuario_pai
    )
    AND EXISTS (
      SELECT 1
      FROM public.t_filho_tarefa ft
      WHERE ft.id_vigencia = OLD.id
    ) THEN
      RAISE EXCEPTION 'Vigência com atribuições não pode ser excluída';
    END IF;

    RETURN OLD;
  END IF;

  IF NEW.data_fim <= NEW.data_inicio THEN
    RAISE EXCEPTION 'A data/hora fim deve ser posterior à data/hora início';
  END IF;

  IF (
       NEW.data_inicio IS DISTINCT FROM OLD.data_inicio
       OR NEW.data_fim IS DISTINCT FROM OLD.data_fim
     )
     AND EXISTS (
       SELECT 1
       FROM public.t_ocorrencia o
       JOIN public.t_filho_tarefa ft ON ft.id = o.id_filho_tarefa
       WHERE ft.id_vigencia = OLD.id
         AND (
           (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date
             < (NEW.data_inicio AT TIME ZONE 'America/Sao_Paulo')::date
           OR
           (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date
             > (NEW.data_fim AT TIME ZONE 'America/Sao_Paulo')::date
         )
     ) THEN
    RAISE EXCEPTION 'Há registros de Fez/Não fez fora do novo período da vigência';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_validity_history_before_change
ON public.t_vigencia;

CREATE TRIGGER guard_validity_history_before_change
BEFORE UPDATE OF data_inicio, data_fim, qtd_ocorrencia OR DELETE
ON public.t_vigencia
FOR EACH ROW
EXECUTE FUNCTION public.guard_validity_history();