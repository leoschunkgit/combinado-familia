-- Adiciona o resultado FEZ e bonificação opcional às ocorrências.
-- Mantém compatibilidade com NAO_FEZ/PENALIDADE já existentes.

ALTER TABLE public.t_ocorrencia
  DROP CONSTRAINT IF EXISTS t_ocorrencia_tipo_check;

ALTER TABLE public.t_ocorrencia
  ADD CONSTRAINT t_ocorrencia_tipo_check
  CHECK (tipo IN ('FEZ', 'NAO_FEZ', 'PENALIDADE'));

ALTER TABLE public.t_ocorrencia
  ADD COLUMN IF NOT EXISTS bonificacao_tipo text,
  ADD COLUMN IF NOT EXISTS bonificacao_descricao text,
  ADD COLUMN IF NOT EXISTS bonificacao_valor numeric(12,2);

ALTER TABLE public.t_ocorrencia
  ADD CONSTRAINT t_ocorrencia_bonificacao_tipo_check
  CHECK (bonificacao_tipo IS NULL OR bonificacao_tipo IN ('TEXTO', 'VALOR')),
  ADD CONSTRAINT t_ocorrencia_bonificacao_valor_check
  CHECK (bonificacao_valor IS NULL OR bonificacao_valor >= 0),
  ADD CONSTRAINT t_ocorrencia_bonificacao_somente_fez_check
  CHECK (
    tipo = 'FEZ'
    OR (
      bonificacao_tipo IS NULL
      AND bonificacao_descricao IS NULL
      AND bonificacao_valor IS NULL
    )
  ),
  ADD CONSTRAINT t_ocorrencia_bonificacao_consistente_check
  CHECK (
    (bonificacao_tipo IS NULL AND bonificacao_descricao IS NULL AND bonificacao_valor IS NULL)
    OR (bonificacao_tipo = 'TEXTO' AND NULLIF(BTRIM(bonificacao_descricao), '') IS NOT NULL AND bonificacao_valor IS NULL)
    OR (bonificacao_tipo = 'VALOR' AND bonificacao_valor IS NOT NULL AND bonificacao_descricao IS NULL)
  );

-- Um resultado diário por tarefa. O índice considera a data no fuso do Brasil,
-- que é a referência funcional usada pela aplicação.
CREATE UNIQUE INDEX IF NOT EXISTS t_ocorrencia_resultado_tarefa_dia_uniq
  ON public.t_ocorrencia (
    id_filho_tarefa,
    ((created_at AT TIME ZONE 'America/Sao_Paulo')::date)
  );

COMMENT ON COLUMN public.t_ocorrencia.bonificacao_tipo IS
  'Tipo da bonificação opcional de um FEZ: TEXTO ou VALOR.';
COMMENT ON COLUMN public.t_ocorrencia.bonificacao_descricao IS
  'Descrição livre da bonificação quando bonificacao_tipo = TEXTO.';
COMMENT ON COLUMN public.t_ocorrencia.bonificacao_valor IS
  'Valor monetário da bonificação quando bonificacao_tipo = VALOR.';
