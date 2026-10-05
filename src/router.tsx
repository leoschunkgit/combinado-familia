import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingMs: 120,
    defaultPendingMinMs: 250,
    defaultPendingComponent: () => (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/60 backdrop-blur-[2px]" role="status" aria-live="polite" aria-label="Carregando página">
        <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 shadow-lg">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="font-medium">Carregando...</span>
        </div>
      </div>
    ),
  });

  return router;
};
