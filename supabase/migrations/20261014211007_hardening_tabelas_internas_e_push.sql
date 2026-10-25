
-- Tabelas internas: somente funções SECURITY DEFINER/rotinas internas devem acessá-las.
revoke all privileges on table public.app_cron_config from anon, authenticated, service_role;
revoke all privileges on table public.t_admin_auditoria from anon, authenticated, service_role;
revoke all privileges on table public.t_app_config from anon, authenticated, service_role;
revoke all privileges on table public.t_app_feature_flag from anon, authenticated, service_role;
revoke all privileges on table public.t_app_telemetria from anon, authenticated, service_role;
revoke all privileges on table public.t_feedback from anon, authenticated, service_role;

-- Push: bloqueado para clientes; Edge Functions usam service_role com privilégio mínimo.
revoke all privileges on table public.t_push_dispositivo from anon, authenticated, service_role;
revoke all privileges on table public.t_push_envio from anon, authenticated, service_role;

grant select, insert, update on table public.t_push_dispositivo to service_role;
grant select, insert on table public.t_push_envio to service_role;

-- IDs identity usados pelas inserções das Edge Functions.
revoke all privileges on sequence public.t_push_dispositivo_id_seq from anon, authenticated, service_role;
revoke all privileges on sequence public.t_push_envio_id_seq from anon, authenticated, service_role;

grant usage on sequence public.t_push_dispositivo_id_seq to service_role;
grant usage on sequence public.t_push_envio_id_seq to service_role;
