import { Loader2 } from "lucide-react";

export function AppLoadingOverlay() {
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-background/60 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-label="Aguarde"
    >
      <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 shadow-lg">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="font-medium">Aguarde...</span>
      </div>
    </div>
  );
}
