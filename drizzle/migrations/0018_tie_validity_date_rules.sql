-- Amarra as regras de datas da vigência e de Fez/Não fez no banco.
-- Mantém registros históricos existentes, mas impede novas inconsistências.

-- Novas vigências e atualizações precisam ter fim estritamente posterior ao início.
ALTER TABLE public.t_vigencia
  DROP CONSTRAINT IF EXISTS t_vigencia_periodo_valido_check;

ALTER TABLE public.t_vigencia
  ADD CONSTRAINT t_vigencia_periodo_valido_check
  CHECK (data_fim > data_inicio) NOT VALID;

-- Ao editar datas, compara timestamp completo (data + hora), não apenas o dia.
CREATE OR REPLACE FUNCTION public.guard_validity_history() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1
      FROM public.t_filho_tarefa
      WHERE id_vigencia = OLD.id
    ) THEN
      RAISE EXCEPTION 'Vigência com atribuições não pode ser excluída';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.data_fim <= NEW.data_inicio THEN
    RAISE EXCEPTION 'A data/hora fim deve ser posterior à data/hora início';
  END IF;

  -- Só valida o limite quando ele próprio estiver sendo alterado.
  IF NEW.qtd_ocorrencia IS DISTINCT FROM OLD.qtd_ocorrencia
     AND NEW.qtd_ocorrencia < COALESCE((
       SELECT max(total)
       FROM (
         SELECT sum(qtd_nao_fez) AS total
         FROM public.t_filho_tarefa
         WHERE id_vigencia = OLD.id
         GROUP BY id_filho
       ) AS totais
     ), 0) THEN
    RAISE EXCEPTION 'Limite menor que o número de Não fez já registrado';
  END IF;

  -- Alterar datas só é bloqueado quando um Fez/Não fez ficaria fora do novo intervalo.
  IF (
       NEW.data_inicio IS DISTINCT FROM OLD.data_inicio
       OR NEW.data_fim IS DISTINCT FROM OLD.data_fim
     )
     AND EXISTS (
       SELECT 1
       FROM public.t_ocorrencia o
       JOIN public.t_filho_tarefa ft ON ft.id = o.id_filho_tarefa
       WHERE ft.id_vigencia = OLD.id
         AND (o.created_at < NEW.data_inicio OR o.created_at > NEW.data_fim)
     ) THEN
    RAISE EXCEPTION 'Há registros de Fez/Não fez fora do novo período da vigência';
  END IF;

  RETURN NEW;
END;
$$;

-- Fez/Não fez só pode ser incluído, alterado ou excluído em vigência em andamento.
CREATE OR REPLACE FUNCTION public.guard_occurrence_active_validity() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_assignment_id bigint;
  v_inicio timestamptz;
  v_fim timestamptz;
BEGIN
  v_assignment_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id_filho_tarefa ELSE NEW.id_filho_tarefa END;

  SELECT v.data_inicio, v.data_fim
    INTO v_inicio, v_fim
  FROM public.t_filho_tarefa ft
  JOIN public.t_vigencia v ON v.id = ft.id_vigencia
  WHERE ft.id = v_assignment_id;

  IF v_inicio IS NULL OR v_fim IS NULL THEN
    RAISE EXCEPTION 'Vigência da atribuição não encontrada';
  END IF;

  IF now() < v_inicio OR now() > v_fim THEN
    RAISE EXCEPTION 'Fez/Não fez só pode ser alterado em vigência em andamento';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS guard_occurrence_active_validity_before_change
ON public.t_ocorrencia;

CREATE TRIGGER guard_occurrence_active_validity_before_change
BEFORE INSERT OR UPDATE OR DELETE ON public.t_ocorrencia
FOR EACH ROW
EXECUTE FUNCTION public.guard_occurrence_active_validity();
