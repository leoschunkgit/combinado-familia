import { useEffect } from "react";
import { App, type URLOpenListenerEvent } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useRouter } from "@tanstack/react-router";
import { getPublicRouteFromUrl } from "@/lib/app-runtime";

/**
 * Entrega Android App Links / iOS Universal Links ao TanStack Router.
 * No navegador não registra listeners nativos.
 */
export function AppDeepLinkListener() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const openRoute = (rawUrl: string) => {
      const route = getPublicRouteFromUrl(rawUrl);
      if (!route) return;
      router.history.push(route);
    };

    let removeListener: (() => Promise<void>) | undefined;

    void App.addListener("appUrlOpen", (event: URLOpenListenerEvent) => {
      openRoute(event.url);
    }).then((handle) => {
      removeListener = () => handle.remove();
    });

    void App.getLaunchUrl().then((launch) => {
      if (launch?.url) openRoute(launch.url);
    });

    return () => {
      if (removeListener) void removeListener();
    };
  }, [router]);

  return null;
}
