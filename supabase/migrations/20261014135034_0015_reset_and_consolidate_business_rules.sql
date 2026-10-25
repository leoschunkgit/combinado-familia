-- RESET DE DADOS FUNCIONAIS + CONSOLIDACAO DAS REGRAS ATUAIS
-- Preserva auth.users e public.t_usuario_pai.

BEGIN;

TRUNCATE TABLE
  public.t_ocorrencia,
  public.t_filho_tarefa,
  public.t_filho_acesso_publico,
  public.t_tarefa,
  public.t_vigencia,
  public.t_filho
RESTART IDENTITY CASCADE;

-- Remove regra antiga: desconto x limite nao pode superar a mesada.
DROP TRIGGER IF EXISTS guard_allowance_assignment_limit_before_change ON public.t_filho_tarefa;
DROP TRIGGER IF EXISTS guard_allowance_child_limit_before_change ON public.t_filho;
DROP TRIGGER IF EXISTS guard_allowance_validity_limit_before_change ON public.t_vigencia;

DROP FUNCTION IF EXISTS public.guard_allowance_assignment_limit();
DROP FUNCTION IF EXISTS public.guard_allowance_child_limit();
DROP FUNCTION IF EXISTS public.guard_allowance_validity_limit();

-- Mesada deve ser positiva quando informada.
ALTER TABLE public.t_filho DROP CONSTRAINT IF EXISTS t_filho_mesada_valida;
ALTER TABLE public.t_filho
  ADD CONSTRAINT t_filho_mesada_valida
  CHECK (valor_mesada IS NULL OR valor_mesada > 0);

-- Regras basicas da vigencia.
ALTER TABLE public.t_vigencia DROP CONSTRAINT IF EXISTS t_vigencia_periodo_valido_check;
ALTER TABLE public.t_vigencia
  ADD CONSTRAINT t_vigencia_periodo_valido_check
  CHECK (data_fim > data_inicio);

ALTER TABLE public.t_vigencia DROP CONSTRAINT IF EXISTS t_vigencia_qtd_ocorrencia_valida_check;
ALTER TABLE public.t_vigencia
  ADD CONSTRAINT t_vigencia_qtd_ocorrencia_valida_check
  CHECK (qtd_ocorrencia BETWEEN 1 AND 31);

ALTER TABLE public.t_vigencia DROP CONSTRAINT IF EXISTS t_vigencia_penalidade_tamanho_check;
ALTER TABLE public.t_vigencia
  ADD CONSTRAINT t_vigencia_penalidade_tamanho_check
  CHECK (char_length(btrim(penalidade)) BETWEEN 2 AND 200);

-- So bloqueia editar/excluir a propria atribuicao se ela tiver historico.
CREATE OR REPLACE FUNCTION public.guard_assignment_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.t_ocorrencia o
    WHERE o.id_filho_tarefa = OLD.id
  ) THEN
    RAISE EXCEPTION 'Atribuicao com Fez/Nao fez nao pode ser editada ou excluida';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_assignment_history_before_change ON public.t_filho_tarefa;
CREATE TRIGGER guard_assignment_history_before_change
BEFORE UPDATE OF id_filho, id_tarefa, id_vigencia OR DELETE
ON public.t_filho_tarefa
FOR EACH ROW
EXECUTE FUNCTION public.guard_assignment_history();

-- Impede sobreposicao de vigencias do mesmo responsavel.
CREATE OR REPLACE FUNCTION public.guard_validity_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.t_vigencia v
    WHERE v.id_usuario_pai = NEW.id_usuario_pai
      AND v.id <> COALESCE(NEW.id, -1)
      AND NEW.data_inicio <= v.data_fim
      AND NEW.data_fim >= v.data_inicio
  ) THEN
    RAISE EXCEPTION 'Ja existe uma vigencia nesse periodo';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_validity_overlap_before_change ON public.t_vigencia;
CREATE TRIGGER guard_validity_overlap_before_change
BEFORE INSERT OR UPDATE OF data_inicio, data_fim, id_usuario_pai
ON public.t_vigencia
FOR EACH ROW
EXECUTE FUNCTION public.guard_validity_overlap();

-- Edicao da vigencia: datas nao podem deixar Fez/Nao fez fora do periodo.
-- qtd_ocorrencia pode ser alterada independentemente de mesada ou contadores antigos.
CREATE OR REPLACE FUNCTION public.guard_validity_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.t_filho_tarefa WHERE id_vigencia = OLD.id) THEN
      RAISE EXCEPTION 'Vigencia com atribuicoes nao pode ser excluida';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.data_fim <= NEW.data_inicio THEN
    RAISE EXCEPTION 'A data/hora fim deve ser posterior a data/hora inicio';
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
    RAISE EXCEPTION 'Ha registros de Fez/Nao fez fora do novo periodo da vigencia';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_validity_before_change ON public.t_vigencia;
CREATE TRIGGER guard_validity_before_change
BEFORE UPDATE OF data_inicio, data_fim, qtd_ocorrencia OR DELETE
ON public.t_vigencia
FOR EACH ROW
EXECUTE FUNCTION public.guard_validity_history();

-- Fez/Nao fez: somente em vigencia em andamento, dentro do dia da vigencia e nunca no futuro.
CREATE OR REPLACE FUNCTION public.guard_occurrence_active_validity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_assignment_id bigint;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_ocorrencia timestamptz;
  v_hoje date;
BEGIN
  v_assignment_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id_filho_tarefa ELSE NEW.id_filho_tarefa END;
  v_ocorrencia := CASE WHEN TG_OP = 'DELETE' THEN OLD.created_at ELSE NEW.created_at END;

  SELECT v.data_inicio, v.data_fim
    INTO v_inicio, v_fim
  FROM public.t_filho_tarefa ft
  JOIN public.t_vigencia v ON v.id = ft.id_vigencia
  WHERE ft.id = v_assignment_id;

  IF v_inicio IS NULL OR v_fim IS NULL THEN
    RAISE EXCEPTION 'Vigencia da atribuicao nao encontrada';
  END IF;

  IF now() < v_inicio OR now() > v_fim THEN
    RAISE EXCEPTION 'Fez/Nao fez so pode ser alterado em vigencia em andamento';
  END IF;

  IF TG_OP <> 'DELETE' THEN
    v_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

    IF (v_ocorrencia AT TIME ZONE 'America/Sao_Paulo')::date
         < (v_inicio AT TIME ZONE 'America/Sao_Paulo')::date
       OR (v_ocorrencia AT TIME ZONE 'America/Sao_Paulo')::date
         > (v_fim AT TIME ZONE 'America/Sao_Paulo')::date THEN
      RAISE EXCEPTION 'A data do Fez/Nao fez deve estar dentro da vigencia';
    END IF;

    IF (v_ocorrencia AT TIME ZONE 'America/Sao_Paulo')::date > v_hoje THEN
      RAISE EXCEPTION 'Nao e permitido registrar Fez/Nao fez em data futura';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS guard_occurrence_active_validity_before_change ON public.t_ocorrencia;
CREATE TRIGGER guard_occurrence_active_validity_before_change
BEFORE INSERT OR UPDATE OR DELETE
ON public.t_ocorrencia
FOR EACH ROW
EXECUTE FUNCTION public.guard_occurrence_active_validity();

CREATE UNIQUE INDEX IF NOT EXISTS t_ocorrencia_resultado_tarefa_dia_uniq
  ON public.t_ocorrencia (
    id_filho_tarefa,
    ((created_at AT TIME ZONE 'America/Sao_Paulo')::date)
  );

COMMIT;
