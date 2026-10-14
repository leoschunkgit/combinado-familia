-- 0059 - Agenda o push de pendências em duas janelas diárias.
-- Horários do cron estão em UTC:
-- 15:00 UTC = 12:00 America/Sao_Paulo
-- 22:30 UTC = 19:30 America/Sao_Paulo

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'push-pendencias-1200-sao-paulo'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'push-pendencias-1930-sao-paulo'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END
$$;

SELECT cron.schedule(
  'push-pendencias-1200-sao-paulo',
  '0 15 * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/enviar-pendencias-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
    ),
    body := jsonb_build_object('janela', '12:00'),
    timeout_milliseconds := 30000
  );
  $cron$
);

SELECT cron.schedule(
  'push-pendencias-1930-sao-paulo',
  '30 22 * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
      || '/functions/v1/enviar-pendencias-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
    ),
    body := jsonb_build_object('janela', '19:30'),
    timeout_milliseconds := 30000
  );
  $cron$
);
