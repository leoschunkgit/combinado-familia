import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AuthRedirectKind = "signup" | "recovery" | "other";

export type AuthRedirectResult = {
  handled: boolean;
  kind: AuthRedirectKind;
  error?: string;
};

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "signup",
  "magiclink",
  "recovery",
  "invite",
  "email_change",
]);

function parseAuthUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const get = (name: string) => url.searchParams.get(name) ?? hash.get(name);

  return {
    url,
    code: get("code"),
    tokenHash: get("token_hash"),
    accessToken: get("access_token"),
    refreshToken: get("refresh_token"),
    type: get("type"),
    error: get("error_description") ?? get("error"),
  };
}

function authKind(url: URL, type: string | null): AuthRedirectKind {
  if (type === "recovery" || url.pathname === "/redefinir-senha") return "recovery";
  if (type === "signup" || type === "email" || url.pathname === "/auth/confirm") return "signup";
  if (url.pathname === "/") return "signup";
  return "other";
}

export function hasAuthRedirect(rawUrl: string): boolean {
  try {
    const parsed = parseAuthUrl(rawUrl);
    return Boolean(
      parsed.code ||
      parsed.tokenHash ||
      (parsed.accessToken && parsed.refreshToken) ||
      parsed.error,
    );
  } catch {
    return false;
  }
}

export async function processAuthRedirect(rawUrl: string): Promise<AuthRedirectResult> {
  let parsed: ReturnType<typeof parseAuthUrl>;

  try {
    parsed = parseAuthUrl(rawUrl);
  } catch {
    return { handled: false, kind: "other" };
  }

  const kind = authKind(parsed.url, parsed.type);
  const handled = Boolean(
    parsed.code ||
    parsed.tokenHash ||
    (parsed.accessToken && parsed.refreshToken) ||
    parsed.error,
  );

  if (!handled) return { handled: false, kind };

  if (parsed.error) {
    return { handled: true, kind, error: parsed.error };
  }

  if (parsed.tokenHash) {
    const otpType = parsed.type as EmailOtpType | null;
    if (!otpType || !EMAIL_OTP_TYPES.has(otpType)) {
      return {
        handled: true,
        kind,
        error: "Tipo de verificação de email inválido.",
      };
    }

    const { error } = await supabase.auth.verifyOtp({
      token_hash: parsed.tokenHash,
      type: otpType,
    });

    if (error) return { handled: true, kind, error: error.message };
  } else if (parsed.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(parsed.code);
    if (error) return { handled: true, kind, error: error.message };
  } else if (parsed.accessToken && parsed.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: parsed.accessToken,
      refresh_token: parsed.refreshToken,
    });

    if (error) return { handled: true, kind, error: error.message };
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    return {
      handled: true,
      kind,
      error: error?.message ?? "Não foi possível concluir a autenticação deste link.",
    };
  }

  return { handled: true, kind };
}
