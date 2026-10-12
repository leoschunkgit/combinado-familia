import { useEffect } from "react";
import { App, type URLOpenListenerEvent } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { getPublicRouteFromUrl } from "@/lib/app-runtime";
import { hasAuthRedirect, processAuthRedirect } from "@/lib/auth-redirect";

/**
 * Entrega Android App Links / iOS Universal Links ao TanStack Router.
 * No navegador não registra listeners nativos.
 */
export function AppDeepLinkListener() {
  const router = useRouter();

  useEffect(() => {
    let ativo = true;
    const processadas = new Set<string>();

    const abrirUrl = async (rawUrl: string, navegarLinkPublico: boolean) => {
      if (!ativo || processadas.has(rawUrl)) return;
      processadas.add(rawUrl);

      if (hasAuthRedirect(rawUrl)) {
        const resultado = await processAuthRedirect(rawUrl);
        if (!ativo) return;

        if (resultado.error) {
          toast.error(
            resultado.kind === "recovery"
              ? "O link de recuperação é inválido, expirou ou já foi utilizado."
              : "Não foi possível confirmar seu email. Solicite um novo link de confirmação.",
          );
          router.history.replace("/");
          return;
        }

        if (resultado.kind === "recovery") {
          router.history.replace("/redefinir-senha");
          return;
        }

        if (resultado.kind === "signup") {
          toast.success("Email confirmado com sucesso!");
          router.history.replace("/inicio");
          return;
        }
      }

      if (!navegarLinkPublico) return;
      const route = getPublicRouteFromUrl(rawUrl);
      if (route) router.history.push(route);
    };

    if (!Capacitor.isNativePlatform()) {
      void abrirUrl(window.location.href, false);
      return () => {
        ativo = false;
      };
    }

    let removeListener: (() => Promise<void>) | undefined;

    void App.addListener("appUrlOpen", (event: URLOpenListenerEvent) => {
      void abrirUrl(event.url, true);
    }).then((handle) => {
      removeListener = () => handle.remove();
    });

    void App.getLaunchUrl().then((launch) => {
      if (launch?.url) void abrirUrl(launch.url, true);
    });

    return () => {
      ativo = false;
      if (removeListener) void removeListener();
    };
  }, [router]);

  return null;
}
