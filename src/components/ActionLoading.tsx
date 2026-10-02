import { createContext, useContext, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

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
      {loading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-[2px]" role="status" aria-live="polite" aria-label="Processando ação">
          <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 shadow-lg">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-medium">Processando...</span>
          </div>
        </div>
      )}
    </ActionLoadingContext.Provider>
  );
}