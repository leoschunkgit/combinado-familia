-- Harmoniza vigência (data+hora) com Fez/Não fez (dia).
-- Status e bloqueio operacional usam timestamp; pertencimento da ocorrência usa o dia local do Brasil.

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

  -- Fez/Não fez é diário: ao editar a vigência, só bloqueia se o DIA
  -- de algum registro ficar fora dos novos dias de início/fim.
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
    RAISE EXCEPTION 'Há registros de Fez/Não fez fora do novo período da vigência';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_occurrence_active_validity() RETURNS trigger
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
  v_assignment_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.id_filho_tarefa
    ELSE NEW.id_filho_tarefa
  END;

  v_ocorrencia := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.created_at
    ELSE NEW.created_at
  END;

  SELECT v.data_inicio, v.data_fim
    INTO v_inicio, v_fim
  FROM public.t_filho_tarefa ft
  JOIN public.t_vigencia v ON v.id = ft.id_vigencia
  WHERE ft.id = v_assignment_id;

  IF v_inicio IS NULL OR v_fim IS NULL THEN
    RAISE EXCEPTION 'Vigência da atribuição não encontrada';
  END IF;

  -- Incluir, editar, trocar ou excluir só enquanto a vigência está em andamento.
  IF now() < v_inicio OR now() > v_fim THEN
    RAISE EXCEPTION 'Fez/Não fez só pode ser alterado em vigência em andamento';
  END IF;

  -- Para INSERT/UPDATE, a data do resultado precisa pertencer aos dias da vigência
  -- e nunca pode ser um dia futuro.
  IF TG_OP <> 'DELETE' THEN
    v_hoje := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

    IF (v_ocorrencia AT TIME ZONE 'America/Sao_Paulo')::date
         < (v_inicio AT TIME ZONE 'America/Sao_Paulo')::date
       OR (v_ocorrencia AT TIME ZONE 'America/Sao_Paulo')::date
         > (v_fim AT TIME ZONE 'America/Sao_Paulo')::date THEN
      RAISE EXCEPTION 'A data do Fez/Não fez deve estar dentro da vigência';
    END IF;

    IF (v_ocorrencia AT TIME ZONE 'America/Sao_Paulo')::date > v_hoje THEN
      RAISE EXCEPTION 'Não é permitido registrar Fez/Não fez em data futura';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
