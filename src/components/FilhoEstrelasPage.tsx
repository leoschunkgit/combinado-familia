import { Gift, PartyPopper, Star } from "lucide-react";
import { EmptyState } from "@/components/PageHeader";
import { FilhoAppPageHeader } from "@/components/FilhoAppPageHeader";
import type { EstrelasFilho } from "@/lib/child-app-session";

function Estrela({ className = "" }: { className?: string }) {
  return (
    <Star
      aria-hidden="true"
      className={`h-4 w-4 fill-amber-400 text-amber-500 ${className}`}
    />
  );
}

export function FilhoEstrelasPage({ estrelas }: { estrelas: EstrelasFilho }) {
  const recompensasOrdenadas = [...estrelas.recompensas].sort((a, b) => a.id - b.id);

  return (
    <div>
      <FilhoAppPageHeader
        title="Estrelas"
        description="Cada estrela mostra uma conquista sua."
        icon={<Star className="h-4.5 w-4.5" />}
      />

      <div className="space-y-4">
        <section className="rounded-2xl border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35">
              <Estrela className="animate-subtle-shake h-9 w-9" />
            </span>

            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Saldo de estrelas</p>
              <p className="mt-0.5 text-3xl font-bold leading-none tabular-nums">
                {estrelas.total_conquistado}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Suas estrelas ficam acumuladas e mostram tudo o que você já conquistou.
              </p>
            </div>
          </div>
        </section>

        <div>
          <h2 className="text-base font-bold">Recompensas</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Acompanhe seu progresso em todas as recompensas.
          </p>
        </div>

        <div className="space-y-3">
        {recompensasOrdenadas.map((recompensa) => {
          const itemProgresso = Math.min(
            100,
            Math.max(0, (recompensa.progresso / recompensa.estrelas_necessarias) * 100),
          );
          const conquistada = recompensa.disponivel || recompensa.pendente;

          return (
            <article
              key={recompensa.id}
              className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-start gap-4">
                <span
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border ${
                    conquistada
                      ? "border-amber-300 bg-amber-100 dark:border-amber-700 dark:bg-amber-950/45"
                      : "bg-amber-50 dark:bg-amber-950/35"
                  }`}
                >
                  <Estrela
                    className={
                      conquistada
                        ? "animate-subtle-shake h-9 w-9"
                        : "h-8 w-8"
                    }
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-base font-bold leading-tight">
                        {recompensa.nome}
                      </p>
                      {recompensa.descricao && (
                        <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                          {recompensa.descricao}
                        </p>
                      )}
                    </div>

                  </div>

                  {conquistada ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800 dark:bg-amber-950/35">
                      <div className="flex items-center gap-2">
                        <PartyPopper className="h-4.5 w-4.5 shrink-0 text-amber-700 dark:text-amber-300" />
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-amber-800 dark:text-amber-200">
                            Parabéns! Você conseguiu!
                          </p>
                          <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                            {recompensa.pendente
                              ? "Sua recompensa está aguardando entrega."
                              : "Sua recompensa já está disponível."}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                      Faltam {recompensa.faltam} estrela{recompensa.faltam === 1 ? "" : "s"} para conquistar
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3 text-[11px] leading-none">
                      <span className="font-medium text-muted-foreground">Progresso</span>
                      <span className="font-semibold tabular-nums">
                        {recompensa.progresso} de {recompensa.estrelas_necessarias}
                      </span>
                    </div>

                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${itemProgresso}%` }}
                      />
                    </div>
                  </div>

                  <span
                    className={`flex shrink-0 items-center justify-center rounded-full border transition-all ${
                      conquistada
                        ? "h-10 w-10 border-amber-300 bg-amber-100 shadow-sm dark:border-amber-700 dark:bg-amber-950/45"
                        : "h-7 w-7 border-muted-foreground/20 bg-background"
                    }`}
                    aria-label={conquistada ? "Meta conquistada" : "Meta"}
                  >
                    <Estrela
                      className={
                        conquistada
                          ? "animate-subtle-shake h-6 w-6"
                          : "h-3.5 w-3.5 opacity-60"
                      }
                    />
                  </span>
                </div>

                {conquistada && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {recompensa.pendente
                      ? "Meta atingida · aguardando entrega"
                      : "Meta atingida · recompensa disponível"}
                  </p>
                )}
              </div>
            </article>
          );
        })}

          {estrelas.recompensas.length === 0 && (
            <div className="rounded-2xl border border-dashed bg-card p-5">
              <EmptyState>
                <span className="flex flex-col items-center gap-2">
                  <Gift className="h-5 w-5" />
                  Nenhuma recompensa por enquanto.
                </span>
              </EmptyState>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
