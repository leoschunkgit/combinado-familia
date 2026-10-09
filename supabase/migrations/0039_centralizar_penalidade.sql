-- 0039 - Centraliza a validade da penalidade da vigencia no banco.
-- A penalidade escrita continua sendo informada pelo usuario quando o limite e atingido.
-- O banco passa a garantir o invariante:
--   penalidade so permanece preenchida enquanto existir ao menos um filho sem mesada
--   com quantidade de NAO_FEZ maior ou igual ao limite da vigencia.
--
-- Esta regra cobre alteracoes vindas de qualquer tela e tambem exclusoes em cascata
-- de ocorrencias, atribuicoes, tarefas e filhos.

CREATE OR REPLACE FUNCTION public.existe_filho_sem_mesada_no_limite(p_id_vigencia bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.t_filho_tarefa ft
    JOIN public.t_filho f
      ON f.id = ft.id_filho
     AND f.id_usuario_pai = ft.id_usuario_pai
    JOIN public.t_vigencia v
      ON v.id = ft.id_vigencia
     AND v.id_usuario_pai = ft.id_usuario_pai
    LEFT JOIN public.t_ocorrencia o
      ON o.id_filho_tarefa = ft.id
     AND o.tipo = 'NAO_FEZ'
    WHERE ft.id_vigencia = p_id_vigencia
      AND NOT (
        COALESCE(f.tem_mesada_opcional, false)
        AND f.valor_mesada IS NOT NULL
        AND v.valor_debito IS NOT NULL
      )
    GROUP BY ft.id_filho, v.qtd_ocorrencia
    HAVING count(o.id) >= v.qtd_ocorrencia
  );
$$;

CREATE OR REPLACE FUNCTION public.recalcular_penalidade_vigencia(p_id_vigencia bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.t_vigencia v
  SET penalidade = NULL
  WHERE v.id = p_id_vigencia
    AND v.penalidade IS NOT NULL
    AND (
      btrim(v.penalidade) = ''
      OR NOT public.existe_filho_sem_mesada_no_limite(v.id)
    );
END;
$$;

-- Recalcula quando Fez/Nao fez muda. Em exclusao por cascata a atribuicao pode
-- ja nao estar disponivel; nesse caso o trigger de t_filho_tarefa abaixo cobre a vigencia.
CREATE OR REPLACE FUNCTION public.recalcular_penalidade_por_ocorrencia_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_vigencia_antiga bigint;
  v_vigencia_nova bigint;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT ft.id_vigencia
      INTO v_vigencia_antiga
    FROM public.t_filho_tarefa ft
    WHERE ft.id = OLD.id_filho_tarefa;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT ft.id_vigencia
      INTO v_vigencia_nova
    FROM public.t_filho_tarefa ft
    WHERE ft.id = NEW.id_filho_tarefa;
  END IF;

  IF v_vigencia_antiga IS NOT NULL THEN
    PERFORM public.recalcular_penalidade_vigencia(v_vigencia_antiga);
  END IF;

  IF v_vigencia_nova IS NOT NULL
     AND v_vigencia_nova IS DISTINCT FROM v_vigencia_antiga THEN
    PERFORM public.recalcular_penalidade_vigencia(v_vigencia_nova);
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalcular_penalidade_ocorrencia
ON public.t_ocorrencia;

CREATE TRIGGER trg_recalcular_penalidade_ocorrencia
AFTER INSERT OR UPDATE OF tipo, id_filho_tarefa OR DELETE
ON public.t_ocorrencia
FOR EACH ROW
EXECUTE FUNCTION public.recalcular_penalidade_por_ocorrencia_trigger();

-- Cobre exclusao direta e cascatas vindas de tarefa/filho.
CREATE OR REPLACE FUNCTION public.recalcular_penalidade_por_atribuicao_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.recalcular_penalidade_vigencia(OLD.id_vigencia);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE')
     AND (TG_OP = 'INSERT' OR NEW.id_vigencia IS DISTINCT FROM OLD.id_vigencia) THEN
    PERFORM public.recalcular_penalidade_vigencia(NEW.id_vigencia);
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalcular_penalidade_atribuicao
ON public.t_filho_tarefa;

CREATE TRIGGER trg_recalcular_penalidade_atribuicao
AFTER INSERT OR UPDATE OF id_filho, id_vigencia OR DELETE
ON public.t_filho_tarefa
FOR EACH ROW
EXECUTE FUNCTION public.recalcular_penalidade_por_atribuicao_trigger();

-- Mudanca da configuracao de mesada pode fazer uma penalidade deixar de valer.
CREATE OR REPLACE FUNCTION public.recalcular_penalidade_por_filho_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT ft.id_vigencia
    FROM public.t_filho_tarefa ft
    WHERE ft.id_filho = NEW.id
  LOOP
    PERFORM public.recalcular_penalidade_vigencia(r.id_vigencia);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalcular_penalidade_filho
ON public.t_filho;

CREATE TRIGGER trg_recalcular_penalidade_filho
AFTER UPDATE OF tem_mesada_opcional, valor_mesada
ON public.t_filho
FOR EACH ROW
WHEN (
  OLD.tem_mesada_opcional IS DISTINCT FROM NEW.tem_mesada_opcional
  OR OLD.valor_mesada IS DISTINCT FROM NEW.valor_mesada
)
EXECUTE FUNCTION public.recalcular_penalidade_por_filho_trigger();

-- Alterar o limite ou a regra de desconto tambem pode invalidar a penalidade atual.
CREATE OR REPLACE FUNCTION public.recalcular_penalidade_por_vigencia_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.recalcular_penalidade_vigencia(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalcular_penalidade_vigencia
ON public.t_vigencia;

CREATE TRIGGER trg_recalcular_penalidade_vigencia
AFTER UPDATE OF qtd_ocorrencia, valor_debito
ON public.t_vigencia
FOR EACH ROW
WHEN (
  OLD.qtd_ocorrencia IS DISTINCT FROM NEW.qtd_ocorrencia
  OR OLD.valor_debito IS DISTINCT FROM NEW.valor_debito
)
EXECUTE FUNCTION public.recalcular_penalidade_por_vigencia_trigger();

-- Corrige dados orfaos que ja existam no momento da aplicacao da migration.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT v.id
    FROM public.t_vigencia v
    WHERE v.penalidade IS NOT NULL
  LOOP
    PERFORM public.recalcular_penalidade_vigencia(r.id);
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.recalcular_penalidade_vigencia(bigint) IS
  'Mantem t_vigencia.penalidade somente enquanto existir filho sem mesada no limite de NAO_FEZ.';

REVOKE ALL ON FUNCTION public.existe_filho_sem_mesada_no_limite(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.existe_filho_sem_mesada_no_limite(bigint) FROM anon;
REVOKE ALL ON FUNCTION public.existe_filho_sem_mesada_no_limite(bigint) FROM authenticated;

REVOKE ALL ON FUNCTION public.recalcular_penalidade_vigencia(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalcular_penalidade_vigencia(bigint) FROM anon;
REVOKE ALL ON FUNCTION public.recalcular_penalidade_vigencia(bigint) FROM authenticated;

REVOKE ALL ON FUNCTION public.recalcular_penalidade_por_ocorrencia_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalcular_penalidade_por_atribuicao_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalcular_penalidade_por_filho_trigger() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalcular_penalidade_por_vigencia_trigger() FROM PUBLIC;
