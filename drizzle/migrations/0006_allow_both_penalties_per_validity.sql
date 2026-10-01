ALTER TABLE public.t_vigencia DROP CONSTRAINT t_vigencia_valor_debito_check;
ALTER TABLE public.t_vigencia ADD CONSTRAINT t_vigencia_valor_debito_positive CHECK (valor_debito IS NULL OR valor_debito > 0);
COMMENT ON COLUMN public.t_vigencia.tipo_penalidade IS 'DEPRECATED: legacy selection; new validities record both written penalty and allowance debit, applied according to each child allowance.';
COMMENT ON COLUMN public.t_vigencia.penalidade IS 'Written penalty for children without a registered allowance; legacy records may have an empty value.';
COMMENT ON COLUMN public.t_vigencia.valor_debito IS 'Amount discounted per Não fez for children with a registered allowance, capped by validity limit and allowance; legacy records may be null.';
DROP TRIGGER guard_mesada_assignment_before_change ON public.t_filho_tarefa;
DROP TRIGGER guard_mesada_validity_before_change ON public.t_vigencia;
DROP TRIGGER guard_mesada_child_before_change ON public.t_filho;