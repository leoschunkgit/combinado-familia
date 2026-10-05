-- Permite DELETE de ocorrencias quando ele ocorre por cascade de uma exclusao-pai.
-- Exclusao direta de Fez/Nao fez continua permitida somente em vigencia em andamento.

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
  -- Cascades de FK executam dentro de triggers encadeados.
  -- Nao bloquear limpeza dependente quando filho/tarefa/atribuicao/conta esta sendo removido.
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

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

  IF now() < v_inicio OR now() > v_fim THEN
    RAISE EXCEPTION 'Fez/Não fez só pode ser alterado em vigência em andamento';
  END IF;

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
