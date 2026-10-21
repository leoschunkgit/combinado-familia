import { useRef } from "react";
import { Moon, Star, Sun } from "lucide-react";

export function FilhoThemeToggle({
  modoEscuro,
  onChange,
  className = "",
  comEstrela = true,
}: {
  modoEscuro: boolean;
  onChange: (modoEscuro: boolean) => void;
  className?: string;
  comEstrela?: boolean;
}) {
  const inicioArraste = useRef<number | null>(null);
  const ignorarProximoClique = useRef(false);

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`.trim()}
      aria-label="Aparência do app"
    >
      <Sun
        className={`h-4 w-4 shrink-0 transition-colors ${
          modoEscuro ? "text-muted-foreground" : "text-amber-500"
        }`}
        aria-hidden="true"
      />

      <button
        type="button"
        role="switch"
        aria-checked={modoEscuro}
        aria-label={modoEscuro ? "Desativar modo escuro" : "Ativar modo escuro"}
        title={modoEscuro ? "Modo escuro ativado" : "Modo claro ativado"}
        className="relative h-7 w-12 shrink-0 touch-none rounded-full border border-border bg-muted/80 shadow-inner transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:bg-slate-800"
        onPointerDown={(event) => {
          inicioArraste.current = event.clientX;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          const inicio = inicioArraste.current;
          inicioArraste.current = null;

          if (inicio === null || Math.abs(event.clientX - inicio) <= 3) return;

          const rect = event.currentTarget.getBoundingClientRect();
          ignorarProximoClique.current = true;
          onChange(event.clientX >= rect.left + rect.width / 2);
        }}
        onPointerCancel={() => {
          inicioArraste.current = null;
        }}
        onClick={() => {
          if (ignorarProximoClique.current) {
            ignorarProximoClique.current = false;
            return;
          }
          onChange(!modoEscuro);
        }}
      >
        <span
          className={`absolute left-0.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border transition-transform duration-200 ${
            modoEscuro ? "translate-x-5" : "translate-x-0"
          }`}
          aria-hidden="true"
        >
          {comEstrela && <Star className="h-4 w-4 fill-amber-400 text-amber-500" />}
        </span>
      </button>

      <Moon
        className={`h-4 w-4 shrink-0 transition-colors ${
          modoEscuro ? "text-indigo-300" : "text-muted-foreground"
        }`}
        aria-hidden="true"
      />
    </div>
  );
}
