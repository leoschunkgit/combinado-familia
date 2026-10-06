-- Torna a conclusao do onboarding um estado persistente do responsavel.
-- Evita reabrir o onboarding quando um usuario ja configurado remove atribuicoes/dados depois.

ALTER TABLE public.t_usuario_pai
ADD COLUMN IF NOT EXISTS onboarding_concluido boolean NOT NULL DEFAULT false;

-- Contas que ja usaram o sistema nao devem voltar ao onboarding automaticamente.
UPDATE public.t_usuario_pai p
SET onboarding_concluido = true
WHERE onboarding_concluido = false
  AND (
    EXISTS (SELECT 1 FROM public.t_filho f WHERE f.id_usuario_pai = p.id)
    OR EXISTS (SELECT 1 FROM public.t_tarefa t WHERE t.id_usuario_pai = p.id)
    OR EXISTS (SELECT 1 FROM public.t_vigencia v WHERE v.id_usuario_pai = p.id)
    OR EXISTS (SELECT 1 FROM public.t_filho_tarefa ft WHERE ft.id_usuario_pai = p.id)
  );

COMMENT ON COLUMN public.t_usuario_pai.onboarding_concluido
IS 'Indica que o responsavel concluiu o onboarding inicial; nao deve ser reaberto automaticamente depois.';
