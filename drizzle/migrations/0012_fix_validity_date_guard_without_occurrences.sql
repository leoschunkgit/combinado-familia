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

  -- Alterar as datas só deve ser bloqueado se houver Fez/Não fez
  -- que ficaria realmente fora do novo período.
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