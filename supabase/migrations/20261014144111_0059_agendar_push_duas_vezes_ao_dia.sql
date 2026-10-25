
insert into public.app_cron_config (chave, valor)
values ('push_cron_secret', 'vault:push_cron_secret')
on conflict (chave) do update set valor = excluded.valor;

select cron.schedule(
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

select cron.schedule(
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
