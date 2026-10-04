// Build dedicado ao futuro app Android/iOS.
//
// Mantém o vite.config.ts atual intacto para a versão web/Lovable.
// O app usa o SPA mode oficial do TanStack Start e gera index.html
// dentro da saída estática, formato esperado pelo Capacitor.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    spa: {
      enabled: true,
      prerender: {
        outputPath: "/index.html",
        crawlLinks: false,
        retryCount: 0,
      },
    },
  },
});
