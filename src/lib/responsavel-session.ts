import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthErrorLike = {
  status?: number;
  code?: string;
};

const CODIGOS_SESSAO_INVALIDA = new Set([
  "session_not_found",
  "refresh_token_not_found",
  "refresh_token_already_used",
  "bad_jwt",
]);

function erroConfirmaSessaoInvalida(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const authError = error as AuthErrorLike;

  return (
    authError.status === 401 ||
    authError.status === 403 ||
    (typeof authError.code === "string" && CODIGOS_SESSAO_INVALIDA.has(authError.code))
  );
}

/**
 * Fonte única para a sessão persistente do responsável.
 *
 * Regra: uma falha temporária de rede não deve transformar uma sessão local
 * existente em "logout". Sessões realmente inválidas (401/403/códigos de
 * revogação) continuam sendo rejeitadas.
 */
export async function obterSessaoResponsavelPersistida(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();

  if (!data.session) return null;
  if (error && erroConfirmaSessaoInvalida(error)) return null;

  return data.session;
}

/**
 * Valida o usuário remotamente quando possível, mas preserva a sessão local
 * diante de indisponibilidade transitória de rede.
 */
export async function obterUsuarioResponsavelPersistido(): Promise<User | null> {
  const session = await obterSessaoResponsavelPersistida();
  if (!session) return null;

  const { data, error } = await supabase.auth.getUser();

  if (!error && data.user) return data.user;
  if (erroConfirmaSessaoInvalida(error)) return null;

  return session.user;
}

/**
 * "Sair" encerra somente a sessão deste aparelho/navegador.
 * Nunca use o escopo global para o logout normal do responsável.
 */
export function encerrarSessaoResponsavelNesteAparelho() {
  return supabase.auth.signOut({ scope: "local" });
}
