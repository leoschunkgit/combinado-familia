
create index if not exists t_filho_tarefa_pai_tarefa_idx
  on public.t_filho_tarefa (id_usuario_pai, id_tarefa);

create index if not exists t_solicitacao_tarefa_filho_atribuicao_idx
  on public.t_solicitacao_tarefa_filho (id_filho_tarefa);

create index if not exists t_estrela_concessao_pai_tarefa_idx
  on public.t_estrela_concessao (id_usuario_pai, id_tarefa);

create index if not exists t_estrela_movimento_pai_tarefa_idx
  on public.t_estrela_movimento (id_usuario_pai, id_tarefa)
  where id_tarefa is not null;

create index if not exists t_ocorrencia_reconciliacao_pai_atribuicao_idx
  on public.t_ocorrencia_reconciliacao (id_usuario_pai, id_filho_tarefa);
