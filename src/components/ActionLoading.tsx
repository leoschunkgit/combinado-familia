import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";

type ActionLoadingContextValue = {
  runAction: <T,>(action: () => Promise<T>) => Promise<T>;
};

const ActionLoadingContext = createContext<ActionLoadingContextValue | null>(null);

export function useActionLoading() {
  const context = useContext(ActionLoadingContext);
  if (!context) throw new Error("O indicador de processamento não está disponível nesta página");
  return context;
}

export function ActionLoadingProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(false);
  const routeLoading = useRouterState({ select: (state) => state.isLoading });
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const processando = loading || routeLoading || fetching > 0 || mutating > 0;
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    if (!processando) {
      setMostrar(false);
      return;
    }

    const timer = window.setTimeout(() => setMostrar(true), 120);
    return () => window.clearTimeout(timer);
  }, [processando]);

  async function runAction<T,>(action: () => Promise<T>) {
    setLoading(true);
    try {
      return await action();
    } finally {
      setLoading(false);
    }
  }

  return (
    <ActionLoadingContext.Provider value={{ runAction }}>
      {children}
      {mostrar && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-[2px]" role="status" aria-live="polite" aria-label="Carregando">
          <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 shadow-lg">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-medium">{loading || mutating > 0 ? "Processando..." : "Carregando..."}</span>
          </div>
        </div>
      )}
    </ActionLoadingContext.Provider>
  );
}