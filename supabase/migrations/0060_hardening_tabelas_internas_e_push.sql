-- Hardening das tabelas internas apontadas pelo Security Advisor.
-- Mantém RLS sem policies de propósito: acesso direto de clientes é default-deny.
-- As Edge Functions de push usam service_role com privilégio mínimo necessário.

revoke all privileges on table public.app_cron_config from anon, authenticated, service_role;
revoke all privileges on table public.t_admin_auditoria from anon, authenticated, service_role;
revoke all privileges on table public.t_app_config from anon, authenticated, service_role;
revoke all privileges on table public.t_app_feature_flag from anon, authenticated, service_role;
revoke all privileges on table public.t_app_telemetria from anon, authenticated, service_role;
revoke all privileges on table public.t_feedback from anon, authenticated, service_role;

revoke all privileges on table public.t_push_dispositivo from anon, authenticated, service_role;
revoke all privileges on table public.t_push_envio from anon, authenticated, service_role;

grant select, insert, update on table public.t_push_dispositivo to service_role;
grant select, insert on table public.t_push_envio to service_role;

revoke all privileges on sequence public.t_push_dispositivo_id_seq from anon, authenticated, service_role;
revoke all privileges on sequence public.t_push_envio_id_seq from anon, authenticated, service_role;

grant usage on sequence public.t_push_dispositivo_id_seq to service_role;
grant usage on sequence public.t_push_envio_id_seq to service_role;
