import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Megaphone, RefreshCw, Wrench } from "lucide-react";
import { obterIdentificacaoApp, type IdentificacaoApp } from "@/lib/app-telemetry";
import { obterAppConfigPublico, type AppConfigPublico } from "@/lib/app-system-config";

export function AppSystemStatus({ ehAdmin }: { ehAdmin: boolean }) {
  const [config, setConfig] = useState<AppConfigPublico | null>(null);
  const [identificacao, setIdentificacao] = useState<IdentificacaoApp | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [novaConfig, novaIdentificacao] = await Promise.all([
        obterAppConfigPublico(),
        obterIdentificacaoApp(),
      ]);
      setConfig(novaConfig);
      setIdentificacao(novaIdentificacao);
    } catch {
      // Configuração operacional nunca deve derrubar o app se a consulta falhar.
    }
  }, []);

  useEffect(() => {
    void carregar();
    const atualizar = () => void carregar();
    window.addEventListener("app-config-updated", atualizar);
    return () => window.removeEventListener("app-config-updated", atualizar);
  }, [carregar]);

  if (!config) return null;

  const minimo =
    identificacao?.plataforma === "android"
      ? config.android_min_version_code
      : identificacao?.plataforma === "ios"
        ? config.ios_min_version_code
        : null;

  const versaoMinima =
    identificacao?.plataforma === "android"
      ? config.android_min_version_name
      : identificacao?.plataforma === "ios"
        ? config.ios_min_version_name
        : null;

  const versaoAbaixo =
    identificacao?.plataforma !== "web"
    && minimo !== null
    && identificacao?.versionCode !== null
    && identificacao?.versionCode !== undefined
    && identificacao.versionCode < minimo;

  const bloqueioManutencao = config.manutencao_ativa && !ehAdmin;
  const bloqueioVersao = versaoAbaixo && !ehAdmin;

  return (
    <>
      {(bloqueioManutencao || bloqueioVersao) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-4">
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-lg">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {bloqueioManutencao ? <Wrench className="h-6 w-6" /> : <RefreshCw className="h-6 w-6" />}
            </span>
            <h1 className="mt-4 text-xl font-bold">
              {bloqueioManutencao ? "Aplicativo em manutenção" : "Atualização necessária"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {bloqueioManutencao
                ? config.manutencao_mensagem || "Estamos realizando uma manutenção. Tente novamente em alguns instantes."
                : `Atualize o Combinado Família para continuar${versaoMinima ? ` na versão ${versaoMinima} ou superior` : ""}.`}
            </p>
          </div>
        </div>
      )}

      <div className="mb-5 space-y-2">
        {config.mensagem_global_ativa && config.mensagem_global && (
          <div className="flex items-start gap-3 rounded-xl border bg-accent/40 p-3 text-sm">
            <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="min-w-0 leading-relaxed">{config.mensagem_global}</p>
          </div>
        )}

        {ehAdmin && config.manutencao_ativa && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-card p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="min-w-0 leading-relaxed">
              O modo manutenção está ativo para usuários. Seu acesso administrativo continua liberado.
            </p>
          </div>
        )}

        {ehAdmin && versaoAbaixo && (
          <div className="flex items-start gap-3 rounded-xl border bg-card p-3 text-sm">
            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="min-w-0 leading-relaxed">
              Este aparelho está abaixo da versão mínima configurada, mas administradores continuam com acesso para recuperação.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
