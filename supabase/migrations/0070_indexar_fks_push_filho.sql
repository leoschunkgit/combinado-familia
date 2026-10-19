-- 0070 - Completa os indices das FKs das tabelas de push do filho.
-- Evita varreduras desnecessarias em exclusoes/cascatas e consultas por filho.

create index if not exists idx_push_dispositivo_filho_id_filho
  on public.t_push_dispositivo_filho (id_filho);

create index if not exists idx_push_envio_filho_id_filho
  on public.t_push_envio_filho (id_filho);
