-- Garante no banco que filho sem mesada nao ultrapasse o limite de NAO_FEZ.
-- Filho com mesada continua sem limite de quantidade.

CREATE OR REPLACE FUNCTION public.guard_nao_fez_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id_filho bigint;
  v_id_vigencia bigint;
  v_limite integer;
  v_tem_mesada boolean;
  v_total integer;
BEGIN
  IF NEW.tipo <> 'NAO_FEZ' THEN
    RETURN NEW;
  END IF;

  SELECT
    ft.id_filho,
    ft.id_vigencia,
    v.qtd_ocorrencia,
    COALESCE(f.tem_mesada_opcional, false) AND f.valor_mesada IS NOT NULL
  INTO v_id_filho, v_id_vigencia, v_limite, v_tem_mesada
  FROM public.t_filho_tarefa ft
  JOIN public.t_vigencia v ON v.id = ft.id_vigencia
  JOIN public.t_filho f ON f.id = ft.id_filho
  WHERE ft.id = NEW.id_filho_tarefa;

  IF v_id_filho IS NULL THEN
    RAISE EXCEPTION 'Atribuição não encontrada';
  END IF;

  IF v_tem_mesada THEN
    RETURN NEW;
  END IF;

  SELECT count(*)::integer
  INTO v_total
  FROM public.t_ocorrencia o
  JOIN public.t_filho_tarefa ft ON ft.id = o.id_filho_tarefa
  WHERE ft.id_filho = v_id_filho
    AND ft.id_vigencia = v_id_vigencia
    AND o.tipo = 'NAO_FEZ'
    AND (TG_OP <> 'UPDATE' OR o.id <> OLD.id);

  IF v_total >= v_limite THEN
    RAISE EXCEPTION 'O limite de Não fez desta vigência já foi atingido';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_nao_fez_limit
ON public.t_ocorrencia;

CREATE TRIGGER trg_guard_nao_fez_limit
BEFORE INSERT OR UPDATE OF tipo, id_filho_tarefa
ON public.t_ocorrencia
FOR EACH ROW
EXECUTE FUNCTION public.guard_nao_fez_limit();