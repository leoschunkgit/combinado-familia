ALTER TABLE public.t_filho
  ADD COLUMN idade integer,
  ADD COLUMN tem_mesada boolean NOT NULL DEFAULT false,
  ADD COLUMN valor_mesada numeric(12,2);
ALTER TABLE public.t_filho
  ADD CONSTRAINT t_filho_idade_valida CHECK (idade IS NULL OR idade BETWEEN 0 AND 150),
  ADD CONSTRAINT t_filho_mesada_valida CHECK (valor_mesada IS NULL OR valor_mesada >= 0),
  ADD CONSTRAINT t_filho_mesada_coerente CHECK (tem_mesada OR valor_mesada IS NULL);