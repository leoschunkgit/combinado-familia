-- 0058 - Duas janelas diárias para controle idempotente de push.
-- Cada aparelho/filho pode receber no máximo um envio por janela e por dia.

ALTER TABLE public.t_push_envio
  ADD COLUMN IF NOT EXISTS janela_envio text NOT NULL DEFAULT '12:00';

ALTER TABLE public.t_push_envio
  DROP CONSTRAINT IF EXISTS t_push_envio_janela_envio_check;

ALTER TABLE public.t_push_envio
  ADD CONSTRAINT t_push_envio_janela_envio_check
  CHECK (janela_envio IN ('12:00', '19:30'));

ALTER TABLE public.t_push_envio
  DROP CONSTRAINT IF EXISTS t_push_envio_unico_por_aparelho_filho_dia;

ALTER TABLE public.t_push_envio
  DROP CONSTRAINT IF EXISTS t_push_envio_unico_por_aparelho_filho_dia_janela;

ALTER TABLE public.t_push_envio
  ADD CONSTRAINT t_push_envio_unico_por_aparelho_filho_dia_janela
  UNIQUE (id_push_dispositivo, id_filho, data_referencia, janela_envio);
