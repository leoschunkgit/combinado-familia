delete from public.t_ocorrencia_reconciliacao r
where not exists (
  select 1
  from public.t_filho_tarefa ft
  where ft.id = r.id_filho_tarefa
);

create index if not exists idx_ocorrencia_reconciliacao_filho_tarefa
  on public.t_ocorrencia_reconciliacao (id_filho_tarefa);

alter table public.t_ocorrencia_reconciliacao
  add constraint t_ocorrencia_reconciliacao_id_filho_tarefa_fkey
  foreign key (id_filho_tarefa)
  references public.t_filho_tarefa(id)
  on delete cascade;
