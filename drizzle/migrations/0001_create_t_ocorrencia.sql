CREATE TABLE public.t_ocorrencia (
  id bigint generated always as identity primary key,
  id_usuario_pai bigint not null default current_pai_id(),
  id_filho_tarefa bigint not null references public.t_filho_tarefa(id) on delete cascade,
  tipo text not null check (tipo in ('NAO_FEZ','PENALIDADE')),
  created_at timestamp with time zone not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.t_ocorrencia TO authenticated;
GRANT ALL ON public.t_ocorrencia TO service_role;
ALTER TABLE public.t_ocorrencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rows" ON public.t_ocorrencia FOR ALL TO authenticated
  USING (id_usuario_pai = current_pai_id())
  WITH CHECK (id_usuario_pai = current_pai_id());
CREATE INDEX t_ocorrencia_filho_tarefa_idx ON public.t_ocorrencia(id_filho_tarefa);