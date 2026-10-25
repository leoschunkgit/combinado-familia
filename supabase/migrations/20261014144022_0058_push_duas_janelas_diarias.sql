
alter table public.t_push_envio
  add column if not exists janela_envio text not null default '12:00';

alter table public.t_push_envio
  drop constraint if exists t_push_envio_unico_por_aparelho_filho_dia;

alter table public.t_push_envio
  drop constraint if exists t_push_envio_janela_envio_check;

alter table public.t_push_envio
  add constraint t_push_envio_janela_envio_check
  check (janela_envio in ('12:00', '19:30'));

alter table public.t_push_envio
  add constraint t_push_envio_unico_por_aparelho_filho_dia_janela
  unique (id_push_dispositivo, id_filho, data_referencia, janela_envio);

comment on column public.t_push_envio.janela_envio is
  'Janela diária do lembrete de pendências: 12:00 ou 19:30 (America/Sao_Paulo).';
