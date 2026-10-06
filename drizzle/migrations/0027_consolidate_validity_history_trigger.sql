-- Remove trigger duplicado de vigencia deixado pela consolidacao anterior.
-- Mantem apenas guard_validity_history_before_change como trigger canonico.

DROP TRIGGER IF EXISTS guard_validity_before_change
ON public.t_vigencia;

DROP TRIGGER IF EXISTS guard_validity_history_before_change
ON public.t_vigencia;

CREATE TRIGGER guard_validity_history_before_change
BEFORE UPDATE OF data_inicio, data_fim, qtd_ocorrencia OR DELETE
ON public.t_vigencia
FOR EACH ROW
EXECUTE FUNCTION public.guard_validity_history();