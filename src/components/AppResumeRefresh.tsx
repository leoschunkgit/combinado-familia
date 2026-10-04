import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Ao voltar do segundo plano, revalida os dados remotos.
 * Evita exibir vigências/ocorrências antigas depois de o app ficar suspenso.
 */
export function AppResumeRefresh() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeListener: (() => Promise<void>) | undefined;

    void App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) return;
      void queryClient.invalidateQueries();
    }).then((handle) => {
      removeListener = () => handle.remove();
    });

    return () => {
      if (removeListener) void removeListener();
    };
  }, [queryClient]);

  return null;
}
