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




-- Registra NAO_FEZ e, quando necessario, a penalidade escrita na mesma transacao.
-- Evita estado intermediario em que a penalidade fique salva sem a ocorrencia que atingiu o limite.
CREATE OR REPLACE FUNCTION public.registrar_nao_fez_com_penalidade(
  p_id_filho_tarefa bigint,
  p_created_at timestamptz,
  p_id_ocorrencia bigint DEFAULT NULL,
  p_penalidade text DEFAULT NULL
)
RETURNS TABLE(
  novo_total integer,
  penalizado boolean,
  penalidade text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $
DECLARE
  v_pai_id bigint;
  v_id_filho bigint;
  v_id_vigencia bigint;
  v_limite integer;
  v_tem_mesada boolean;
  v_valor_debito numeric;
  v_penalidade_atual text;
  v_total_atual integer;
  v_novo_total integer;
  v_precisa_penalidade boolean;
  v_penalidade_informada text;
BEGIN
  SELECT p.id
    INTO v_pai_id
  FROM public.t_usuario_pai p
  WHERE p.auth_user_id = auth.uid();

  IF v_pai_id IS NULL THEN
    RAISE EXCEPTION 'Responsável não encontrado';
  END IF;

  SELECT
    ft.id_filho,
    ft.id_vigencia,
    v.qtd_ocorrencia,
    COALESCE(f.tem_mesada_opcional, false) AND f.valor_mesada IS NOT NULL,
    v.valor_debito,
    v.penalidade
  INTO
    v_id_filho,
    v_id_vigencia,
    v_limite,
    v_tem_mesada,
    v_valor_debito,
    v_penalidade_atual
  FROM public.t_filho_tarefa ft
  JOIN public.t_filho f
    ON f.id = ft.id_filho
   AND f.id_usuario_pai = ft.id_usuario_pai
  JOIN public.t_vigencia v
    ON v.id = ft.id_vigencia
   AND v.id_usuario_pai = ft.id_usuario_pai
  WHERE ft.id = p_id_filho_tarefa
    AND ft.id_usuario_pai = v_pai_id;

  IF v_id_filho IS NULL THEN
    RAISE EXCEPTION 'Atribuição não encontrada';
  END IF;

  IF p_id_ocorrencia IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.t_ocorrencia o
    WHERE o.id = p_id_ocorrencia
      AND o.id_filho_tarefa = p_id_filho_tarefa
      AND o.id_usuario_pai = v_pai_id
  ) THEN
    RAISE EXCEPTION 'Registro de Fez/Não fez não encontrado';
  END IF;

  SELECT count(*)::integer
    INTO v_total_atual
  FROM public.t_ocorrencia o
  JOIN public.t_filho_tarefa ft
    ON ft.id = o.id_filho_tarefa
  WHERE ft.id_filho = v_id_filho
    AND ft.id_vigencia = v_id_vigencia
    AND o.tipo = 'NAO_FEZ'
    AND (p_id_ocorrencia IS NULL OR o.id <> p_id_ocorrencia);

  v_novo_total := v_total_atual + 1;

  IF NOT (v_tem_mesada AND v_valor_debito IS NOT NULL)
     AND v_total_atual >= v_limite THEN
    RAISE EXCEPTION 'O limite de Não fez desta vigência já foi atingido';
  END IF;

  v_precisa_penalidade :=
    NOT (v_tem_mesada AND v_valor_debito IS NOT NULL)
    AND v_novo_total >= v_limite
    AND NULLIF(BTRIM(v_penalidade_atual), '') IS NULL;

  v_penalidade_informada := NULLIF(BTRIM(p_penalidade), '');

  IF v_precisa_penalidade
     AND (
       v_penalidade_informada IS NULL
       OR length(v_penalidade_informada) < 2
       OR length(v_penalidade_informada) > 200
     ) THEN
    RAISE EXCEPTION 'Informe a penalidade para registrar o Não fez que atingiu o limite';
  END IF;

  IF p_id_ocorrencia IS NULL THEN
    INSERT INTO public.t_ocorrencia (
      id_usuario_pai,
      id_filho_tarefa,
      tipo,
      bonificacao_tipo,
      bonificacao_descricao,
      bonificacao_valor,
      created_at
    )
    VALUES (
      v_pai_id,
      p_id_filho_tarefa,
      'NAO_FEZ',
      NULL,
      NULL,
      NULL,
      p_created_at
    );
  ELSE
    UPDATE public.t_ocorrencia
    SET
      tipo = 'NAO_FEZ',
      bonificacao_tipo = NULL,
      bonificacao_descricao = NULL,
      bonificacao_valor = NULL
    WHERE id = p_id_ocorrencia
      AND id_filho_tarefa = p_id_filho_tarefa
      AND id_usuario_pai = v_pai_id;
  END IF;

  IF v_precisa_penalidade THEN
    UPDATE public.t_vigencia
    SET penalidade = v_penalidade_informada
    WHERE id = v_id_vigencia
      AND id_usuario_pai = v_pai_id;

    v_penalidade_atual := v_penalidade_informada;
  END IF;

  RETURN QUERY
  SELECT
    v_novo_total,
    NOT (v_tem_mesada AND v_valor_debito IS NOT NULL) AND v_novo_total >= v_limite,
    NULLIF(BTRIM(v_penalidade_atual), '');
END;
$;

REVOKE ALL ON FUNCTION public.registrar_nao_fez_com_penalidade(bigint, timestamptz, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_nao_fez_com_penalidade(bigint, timestamptz, bigint, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_nao_fez_com_penalidade(bigint, timestamptz, bigint, text) TO authenticated;

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
