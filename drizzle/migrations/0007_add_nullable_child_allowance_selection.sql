ALTER TABLE public.t_filho ADD COLUMN tem_mesada_opcional boolean;
UPDATE public.t_filho SET tem_mesada_opcional = tem_mesada;
COMMENT ON COLUMN public.t_filho.tem_mesada IS 'DEPRECATED: compatibility with older app versions; use nullable tem_mesada_opcional for allowance selection.';
COMMENT ON COLUMN public.t_filho.tem_mesada_opcional IS 'Nullable allowance selection: NULL means not specified; TRUE requires a registered allowance amount on new writes.';
ALTER TABLE public.t_filho ADD CONSTRAINT t_filho_mesada_opcional_valida CHECK (tem_mesada_opcional IS DISTINCT FROM TRUE OR valor_mesada IS NOT NULL) NOT VALID;