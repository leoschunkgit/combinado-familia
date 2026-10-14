import { supabase } from "@/integrations/supabase/client";

export type AppConfigPublico = {
  mensagem_global_ativa: boolean;
  mensagem_global: string | null;
  manutencao_ativa: boolean;
  manutencao_mensagem: string | null;
  android_min_version_name: string | null;
  android_min_version_code: number | null;
  ios_min_version_name: string | null;
  ios_min_version_code: number | null;
  funcionalidades: Record<string, boolean>;
  updated_at: string | null;
};

const VAZIO: AppConfigPublico = {
  mensagem_global_ativa: false,
  mensagem_global: null,
  manutencao_ativa: false,
  manutencao_mensagem: null,
  android_min_version_name: null,
  android_min_version_code: null,
  ios_min_version_name: null,
  ios_min_version_code: null,
  funcionalidades: {},
  updated_at: null,
};

function numeroOuNull(valor: unknown) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export function normalizarAppConfig(data: unknown): AppConfigPublico {
  if (!data || typeof data !== "object") return VAZIO;
  const r = data as Record<string, unknown>;
  const funcionalidadesBrutas =
    r["funcionalidades"] && typeof r["funcionalidades"] === "object"
      ? r["funcionalidades"] as Record<string, unknown>
      : {};

  const funcionalidades: Record<string, boolean> = {};
  for (const [chave, valor] of Object.entries(funcionalidadesBrutas)) {
    funcionalidades[chave] = valor === true;
  }

  return {
    mensagem_global_ativa: r["mensagem_global_ativa"] === true,
    mensagem_global: typeof r["mensagem_global"] === "string" ? r["mensagem_global"] : null,
    manutencao_ativa: r["manutencao_ativa"] === true,
    manutencao_mensagem: typeof r["manutencao_mensagem"] === "string" ? r["manutencao_mensagem"] : null,
    android_min_version_name: typeof r["android_min_version_name"] === "string" ? r["android_min_version_name"] : null,
    android_min_version_code: numeroOuNull(r["android_min_version_code"]),
    ios_min_version_name: typeof r["ios_min_version_name"] === "string" ? r["ios_min_version_name"] : null,
    ios_min_version_code: numeroOuNull(r["ios_min_version_code"]),
    funcionalidades,
    updated_at: typeof r["updated_at"] === "string" ? r["updated_at"] : null,
  };
}

export async function obterAppConfigPublico(): Promise<AppConfigPublico> {
  const { data, error } = await supabase.rpc("app_config_publico");
  if (error) throw error;
  return normalizarAppConfig(data);
}

export function funcionalidadeAtiva(config: AppConfigPublico | null | undefined, chave: string) {
  return config?.funcionalidades?.[chave] === true;
}
