import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { AppLoadingOverlay } from "@/components/AppLoadingOverlay";

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
      {mostrar && <AppLoadingOverlay />}
    </ActionLoadingContext.Provider>
  );
}