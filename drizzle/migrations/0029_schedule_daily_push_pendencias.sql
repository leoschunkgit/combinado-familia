-- Tabela interna de configuracao do agendamento (sem acesso via API: RLS sem policies, sem grants)
create table if not exists public.app_cron_config (
  chave text primary key,
  valor text not null
);
alter table public.app_cron_config enable row level security;
revoke all on public.app_cron_config from anon, authenticated;

-- Recria o agendamento de forma idempotente: diario 19:30 America/Sao_Paulo (22:30 UTC, sem horario de verao)
select cron.unschedule(jobid) from cron.job where jobname = 'enviar-pendencias-push-diario';

select cron.schedule(
  'enviar-pendencias-push-diario',
  '30 22 * * *',
  $$
  select net.http_post(
    url := 'https://ojanhkqxxzpiyhydlmli.supabase.co/functions/v1/enviar-pendencias-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select valor from public.app_cron_config where chave = 'push_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);