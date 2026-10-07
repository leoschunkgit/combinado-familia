import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

const PUSH_TOKEN_STORAGE_KEY = "combinado-push-token";

export function getPushTokenSalvo() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
}

export async function registrarPushToken(token: string) {
  if (!token) return;
  const { error } = await supabase.functions.invoke("registrar-push-token", {
    body: {
      token,
      plataforma: Capacitor.getPlatform(),
      ativo: true,
    },
  });
  if (error) throw error;
  window.localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
}

export async function desativarPushAtual() {
  if (typeof window === "undefined") return;
  const token = getPushTokenSalvo();
  if (!token) return;

  try {
    await supabase.functions.invoke("registrar-push-token", {
      body: {
        token,
        plataforma: Capacitor.getPlatform(),
        ativo: false,
      },
    });
  } finally {
    window.localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  }
}
