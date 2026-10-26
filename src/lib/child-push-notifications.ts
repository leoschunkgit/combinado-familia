import { Capacitor } from "@capacitor/core";
import { lerSessaoFilhoLocal } from "@/lib/child-app-session";
import { erroRegra } from "@/lib/app-error";

export async function registrarPushFilho(pushToken: string) {
  if (!Capacitor.isNativePlatform() || !pushToken) return;

  const plataforma = Capacitor.getPlatform();
  if (plataforma !== "android" && plataforma !== "ios") return;

  const token = await lerSessaoFilhoLocal();
  if (!token) return;

  const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  const publishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("O push do filho não está configurado neste ambiente.");
  }

  const response = await fetch(supabaseUrl + "/functions/v1/acesso-filho-app", {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      acao: "registrar_push",
      token,
      push_token: pushToken,
      plataforma,
    }),
  });

  const data = await response.json().catch(() => ({})) as {
    ok?: boolean;
    codigo?: string;
    mensagem?: string;
    error?: string;
  };

  if (!response.ok || data.ok !== true) {
    throw erroRegra(
      data.mensagem || data.error || "Não foi possível registrar as notificações do filho.",
      data.codigo,
    );
  }
}
