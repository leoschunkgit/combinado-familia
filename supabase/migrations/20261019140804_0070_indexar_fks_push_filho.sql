create index if not exists idx_push_dispositivo_filho_id_filho
  on public.t_push_dispositivo_filho (id_filho);

create index if not exists idx_push_envio_filho_id_filho
  on public.t_push_envio_filho (id_filho);
