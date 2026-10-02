-- Hardening: enforce same-family relationships and add lookup indexes.
-- No application behavior is changed; this only prevents cross-family references
-- and improves query performance.

-- Composite unique keys allow PostgreSQL to enforce that referenced records
-- belong to the same parent family.
CREATE UNIQUE INDEX IF NOT EXISTS t_filho_pai_id_uq
  ON public.t_filho(id_usuario_pai, id);

CREATE UNIQUE INDEX IF NOT EXISTS t_tarefa_pai_id_uq
  ON public.t_tarefa(id_usuario_pai, id);

CREATE UNIQUE INDEX IF NOT EXISTS t_vigencia_pai_id_uq
  ON public.t_vigencia(id_usuario_pai, id);

CREATE UNIQUE INDEX IF NOT EXISTS t_filho_tarefa_pai_id_uq
  ON public.t_filho_tarefa(id_usuario_pai, id);

-- Ensure an assignment can only combine child, task and validity
-- from the same family.
ALTER TABLE public.t_filho_tarefa
  ADD CONSTRAINT t_filho_tarefa_same_pai_filho_fk
  FOREIGN KEY (id_usuario_pai, id_filho)
  REFERENCES public.t_filho(id_usuario_pai, id)
  ON DELETE CASCADE;

ALTER TABLE public.t_filho_tarefa
  ADD CONSTRAINT t_filho_tarefa_same_pai_tarefa_fk
  FOREIGN KEY (id_usuario_pai, id_tarefa)
  REFERENCES public.t_tarefa(id_usuario_pai, id)
  ON DELETE CASCADE;

ALTER TABLE public.t_filho_tarefa
  ADD CONSTRAINT t_filho_tarefa_same_pai_vigencia_fk
  FOREIGN KEY (id_usuario_pai, id_vigencia)
  REFERENCES public.t_vigencia(id_usuario_pai, id)
  ON DELETE CASCADE;

-- Ensure an occurrence belongs to the same family as its assignment.
ALTER TABLE public.t_ocorrencia
  ADD CONSTRAINT t_ocorrencia_same_pai_assignment_fk
  FOREIGN KEY (id_usuario_pai, id_filho_tarefa)
  REFERENCES public.t_filho_tarefa(id_usuario_pai, id)
  ON DELETE CASCADE;

-- Frequently used owner/filter/join indexes.
CREATE INDEX IF NOT EXISTS t_filho_pai_idx
  ON public.t_filho(id_usuario_pai);

CREATE INDEX IF NOT EXISTS t_tarefa_pai_idx
  ON public.t_tarefa(id_usuario_pai);

CREATE INDEX IF NOT EXISTS t_vigencia_pai_idx
  ON public.t_vigencia(id_usuario_pai);

CREATE INDEX IF NOT EXISTS t_filho_tarefa_pai_idx
  ON public.t_filho_tarefa(id_usuario_pai);

CREATE INDEX IF NOT EXISTS t_filho_tarefa_filho_idx
  ON public.t_filho_tarefa(id_filho);

CREATE INDEX IF NOT EXISTS t_filho_tarefa_vigencia_idx
  ON public.t_filho_tarefa(id_vigencia);

CREATE INDEX IF NOT EXISTS t_ocorrencia_pai_idx
  ON public.t_ocorrencia(id_usuario_pai);
