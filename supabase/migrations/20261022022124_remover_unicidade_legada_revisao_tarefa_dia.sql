alter table public.t_revisao_tarefa_filho
  drop constraint if exists t_revisao_tarefa_filho_unica_tarefa_dia;

-- A identidade da revisão é a ocorrência exata.
-- Uma nova ocorrência no mesmo filho/tarefa/dia pode ter sua própria revisão.
create unique index if not exists t_revisao_tarefa_filho_ocorrencia_uniq
  on public.t_revisao_tarefa_filho (id_ocorrencia);
