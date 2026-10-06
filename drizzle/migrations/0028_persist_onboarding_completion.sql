-- Torna a conclusao do onboarding um estado persistente do responsavel.
-- Evita reabrir o onboarding quando um usuario ja configurado remove atribuicoes/dados depois.

ALTER TABLE public.t_usuario_pai
ADD COLUMN IF NOT EXISTS onboarding_concluido boolean NOT NULL DEFAULT false;

-- Todas as contas que ja existiam antes desta migration sao preservadas como ja onboardadas.
-- Assim a implantacao nao reabre o tutorial para usuarios atuais.
UPDATE public.t_usuario_pai
SET onboarding_concluido = true
WHERE onboarding_concluido = false;

COMMENT ON COLUMN public.t_usuario_pai.onboarding_concluido
IS 'Indica que o responsavel concluiu o onboarding inicial; nao deve ser reaberto automaticamente depois.';

-- A primeira atribuicao conclui o onboarding na mesma transacao do INSERT.
-- Isso evita estados intermediarios em que a atribuicao existe mas o modal continua preso.
CREATE OR REPLACE FUNCTION public.concluir_onboarding_ao_atribuir()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.t_usuario_pai
  SET onboarding_concluido = true
  WHERE id = NEW.id_usuario_pai
    AND onboarding_concluido = false;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.concluir_onboarding_ao_atribuir() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.concluir_onboarding_ao_atribuir() FROM anon;
REVOKE ALL ON FUNCTION public.concluir_onboarding_ao_atribuir() FROM authenticated;

DROP TRIGGER IF EXISTS concluir_onboarding_ao_atribuir
ON public.t_filho_tarefa;

CREATE TRIGGER concluir_onboarding_ao_atribuir
AFTER INSERT ON public.t_filho_tarefa
FOR EACH ROW
EXECUTE FUNCTION public.concluir_onboarding_ao_atribuir();
