alter policy "own pai select"
on public.t_usuario_pai
using (auth_user_id = (select auth.uid()));

alter policy "own pai insert"
on public.t_usuario_pai
with check (auth_user_id = (select auth.uid()));

alter policy "own pai update"
on public.t_usuario_pai
using (auth_user_id = (select auth.uid()))
with check (auth_user_id = (select auth.uid()));

alter policy "estrela_movimento_select_proprio"
on public.t_estrela_movimento
using (
  exists (
    select 1
    from public.t_usuario_pai p
    where p.id = t_estrela_movimento.id_usuario_pai
      and p.auth_user_id = (select auth.uid())
  )
);

alter policy "recompensa_estrela_select_propria"
on public.t_recompensa_estrela
using (
  exists (
    select 1
    from public.t_usuario_pai p
    where p.id = t_recompensa_estrela.id_usuario_pai
      and p.auth_user_id = (select auth.uid())
  )
);

alter policy "recompensa_resgate_select_proprio"
on public.t_recompensa_resgate
using (
  exists (
    select 1
    from public.t_usuario_pai p
    where p.id = t_recompensa_resgate.id_usuario_pai
      and p.auth_user_id = (select auth.uid())
  )
);

alter policy "estrela_concessao_select_propria"
on public.t_estrela_concessao
using (
  exists (
    select 1
    from public.t_usuario_pai p
    where p.id = t_estrela_concessao.id_usuario_pai
      and p.auth_user_id = (select auth.uid())
  )
);

create index if not exists idx_t_app_config_updated_by_admin_id
  on public.t_app_config (updated_by_admin_id);

create index if not exists idx_t_app_feature_flag_updated_by_admin_id
  on public.t_app_feature_flag (updated_by_admin_id);

create index if not exists idx_t_estrela_concessao_id_filho
  on public.t_estrela_concessao (id_filho);

create index if not exists idx_t_estrela_movimento_id_filho
  on public.t_estrela_movimento (id_filho);

create index if not exists idx_t_estrela_movimento_id_tarefa
  on public.t_estrela_movimento (id_tarefa);

create index if not exists idx_t_estrela_movimento_id_vigencia
  on public.t_estrela_movimento (id_vigencia);

create index if not exists idx_t_filho_tarefa_id_tarefa
  on public.t_filho_tarefa (id_tarefa);

create index if not exists idx_t_filho_tarefa_pai_filho
  on public.t_filho_tarefa (id_usuario_pai, id_filho);

create index if not exists idx_t_filho_tarefa_pai_vigencia
  on public.t_filho_tarefa (id_usuario_pai, id_vigencia);

create index if not exists idx_t_ocorrencia_pai_filho_tarefa
  on public.t_ocorrencia (id_usuario_pai, id_filho_tarefa);

create index if not exists idx_t_ocorrencia_consequencia_pai_ocorrencia
  on public.t_ocorrencia_consequencia (id_usuario_pai, id_ocorrencia);

create index if not exists idx_t_push_envio_id_filho
  on public.t_push_envio (id_filho);

create index if not exists idx_t_push_resposta_filho_id_filho
  on public.t_push_resposta_filho (id_filho);

create index if not exists idx_t_recompensa_estrela_id_filho
  on public.t_recompensa_estrela (id_filho);

create index if not exists idx_t_recompensa_resgate_id_filho
  on public.t_recompensa_resgate (id_filho);

create index if not exists idx_t_recompensa_resgate_id_recompensa
  on public.t_recompensa_resgate (id_recompensa);
