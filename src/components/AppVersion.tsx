import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

type VersionConfig = { versionName?: unknown };

async function getConfiguredVersion(): Promise<string | null> {
  try {
    const response = await fetch("/app-version.json", { cache: "no-store" });
    if (!response.ok) return null;
    const config = (await response.json()) as VersionConfig;
    return typeof config.versionName === "string" && config.versionName.trim()
      ? config.versionName.trim()
      : null;
  } catch {
    return null;
  }
}

export function AppVersion({ className = "" }: { className?: string }) {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (Capacitor.isNativePlatform()) {
        try {
          const info = await App.getInfo();
          if (active && info.version) {
            setVersion(info.version);
            return;
          }
        } catch {
          // Fallback para a versão central do projeto.
        }
      }

      const configured = await getConfiguredVersion();
      if (active) setVersion(configured);
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  if (!version) return null;
  return <span className={className}>Versão {version}</span>;
}
