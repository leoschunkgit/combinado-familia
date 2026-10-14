import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

type VersionConfig = {
  versionName?: unknown;
  versionCode?: unknown;
};

async function versaoConfigurada() {
  try {
    const response = await fetch("/app-version.json", { cache: "no-store" });
    if (!response.ok) return { versionName: null, versionCode: null };
    const data = await response.json() as VersionConfig;
    return {
      versionName: typeof data.versionName === "string" && data.versionName.trim()
        ? data.versionName.trim()
        : null,
      versionCode: typeof data.versionCode === "number" && Number.isFinite(data.versionCode)
        ? data.versionCode
        : null,
    };
  } catch {
    return { versionName: null, versionCode: null };
  }
}

export type IdentificacaoApp = {
  plataforma: "web" | "android" | "ios";
  versionName: string | null;
  versionCode: number | null;
};

export async function obterIdentificacaoApp(): Promise<IdentificacaoApp> {
  const plataformaBruta = Capacitor.getPlatform();
  const plataforma: IdentificacaoApp["plataforma"] =
    plataformaBruta === "android" || plataformaBruta === "ios"
      ? plataformaBruta
      : "web";

  let versionName: string | null = null;
  let versionCode: number | null = null;

  if (Capacitor.isNativePlatform()) {
    try {
      const info = await App.getInfo();
      versionName = info.version?.trim() || null;
      const build = Number.parseInt(info.build ?? "", 10);
      versionCode = Number.isFinite(build) ? build : null;
    } catch {
      const configurada = await versaoConfigurada();
      versionName = configurada.versionName;
      versionCode = configurada.versionCode;
    }
  } else {
    const configurada = await versaoConfigurada();
    versionName = configurada.versionName;
    versionCode = configurada.versionCode;
  }

  return { plataforma, versionName, versionCode };
}

export async function registrarTelemetriaApp() {
  try {
    const identificacao = await obterIdentificacaoApp();

    await supabase.rpc("registrar_telemetria_app", {
      p_plataforma: identificacao.plataforma,
      p_version_name: identificacao.versionName,
      p_version_code: identificacao.versionCode,
    });
  } catch {
    // Telemetria operacional nunca deve bloquear o uso normal do app.
  }
}
