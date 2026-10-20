-- 0080 - Corrige permissoes do service_role usadas pelos fluxos de push do app do filho.
-- Mantem as tabelas fechadas para anon/authenticated; libera somente leitura tecnica
-- para as Edge Functions que validam solicitacoes, revisoes e acessos ativos.

grant select on table public.t_solicitacao_tarefa_filho to service_role;
grant select on table public.t_revisao_tarefa_filho to service_role;
grant select on table public.t_filho_acesso_app to service_role;
