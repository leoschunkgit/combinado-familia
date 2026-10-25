-- Remove o estado armazenado PENALIDADE.
-- Penalidade passa a ser sempre derivada cronologicamente dos registros NAO_FEZ.

UPDATE public.t_ocorrencia
SET tipo = 'NAO_FEZ'
WHERE tipo = 'PENALIDADE';

ALTER TABLE public.t_ocorrencia
  DROP CONSTRAINT IF EXISTS t_ocorrencia_tipo_check;

ALTER TABLE public.t_ocorrencia
  ADD CONSTRAINT t_ocorrencia_tipo_check
  CHECK (tipo IN ('FEZ', 'NAO_FEZ'));

COMMENT ON COLUMN public.t_ocorrencia.tipo IS
  'Resultado diário da tarefa: FEZ ou NAO_FEZ. Penalidade é calculada, não armazenada.';
