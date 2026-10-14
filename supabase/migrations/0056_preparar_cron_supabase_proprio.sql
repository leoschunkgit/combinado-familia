-- 0056 - Prepara o cron de push para a migração ao Supabase próprio.
-- Mantém somente a tabela interna de configuração.
-- O agendamento antigo NÃO é recriado aqui porque apontava para o backend da Lovable.
-- Um novo cron será criado apenas depois que a Edge Function e o segredo forem configurados neste projeto.

CREATE TABLE IF NOT EXISTS public.app_cron_config (
  chave text PRIMARY KEY,
  valor text NOT NULL
);

ALTER TABLE public.app_cron_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.app_cron_config FROM anon, authenticated;

COMMENT ON TABLE public.app_cron_config IS
  'Configuração interna do agendamento de push. Sem acesso direto pela API.';
