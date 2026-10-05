-- Recalcula estados derivados quando mudam regras que afetam a penalidade.
-- Mantem t_ocorrencia como fonte de verdade.

CREATE OR REPLACE FUNCTION public.recalcular_estado_por_regra_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF TG_TABLE_NAME = 't_filho' THEN
    FOR r IN
      SELECT ft.id
      FROM public.t_filho_tarefa ft
      WHERE ft.id_filho = NEW.id
    LOOP
      PERFORM public.recalcular_estado_atribuicao(r.id);
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 't_vigencia' THEN
    FOR r IN
      SELECT ft.id
      FROM public.t_filho_tarefa ft
      WHERE ft.id_vigencia = NEW.id
    LOOP
      PERFORM public.recalcular_estado_atribuicao(r.id);
    END LOOP;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalcular_estado_filho_regra
ON public.t_filho;

CREATE TRIGGER trg_recalcular_estado_filho_regra
AFTER UPDATE OF tem_mesada_opcional, valor_mesada
ON public.t_filho
FOR EACH ROW
WHEN (
  OLD.tem_mesada_opcional IS DISTINCT FROM NEW.tem_mesada_opcional
  OR OLD.valor_mesada IS DISTINCT FROM NEW.valor_mesada
)
EXECUTE FUNCTION public.recalcular_estado_por_regra_trigger();

DROP TRIGGER IF EXISTS trg_recalcular_estado_vigencia_regra
ON public.t_vigencia;

CREATE TRIGGER trg_recalcular_estado_vigencia_regra
AFTER UPDATE OF qtd_ocorrencia
ON public.t_vigencia
FOR EACH ROW
WHEN (OLD.qtd_ocorrencia IS DISTINCT FROM NEW.qtd_ocorrencia)
EXECUTE FUNCTION public.recalcular_estado_por_regra_trigger();

REVOKE ALL ON FUNCTION public.recalcular_estado_por_regra_trigger() FROM PUBLIC;
