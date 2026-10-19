create index if not exists idx_t_filho_acesso_app_id_filho
  on public.t_filho_acesso_app (id_filho);

create index if not exists idx_t_filho_acesso_app_chave_id_filho
  on public.t_filho_acesso_app_chave (id_filho);

drop policy if exists t_filho_acesso_app_tentativa_deny_all
  on public.t_filho_acesso_app_tentativa;

create policy t_filho_acesso_app_tentativa_deny_all
on public.t_filho_acesso_app_tentativa
for all
to anon, authenticated
using (false)
with check (false);
