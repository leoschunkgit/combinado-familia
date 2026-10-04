import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/**
 * Integra o botão/gesto Voltar do Android com a navegação web.
 *
 * - fecha primeiro um modal Radix aberto;
 * - volta no histórico quando o WebView informa que existe uma página anterior;
 * - encerra o app somente quando não há para onde voltar.
 *
 * Não é registrado na web nem no iOS.
 */
export function AndroidBackButton() {
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;

    let removeListener: (() => Promise<void>) | undefined;

    void App.addListener("backButton", ({ canGoBack }) => {
      const dialog = document.querySelector<HTMLElement>(
        '[role="dialog"][data-state="open"]',
      );

      if (dialog) {
        dialog.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            code: "Escape",
            bubbles: true,
            cancelable: true,
          }),
        );
        return;
      }

      if (canGoBack) {
        window.history.back();
        return;
      }

      void App.exitApp();
    }).then((handle) => {
      removeListener = () => handle.remove();
    });

    return () => {
      if (removeListener) void removeListener();
    };
  }, []);

  return null;
}
