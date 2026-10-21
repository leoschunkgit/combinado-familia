import { useState } from "react";
import { CheckCircle2, Gift, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { EmptyState } from "@/components/PageHeader";
import { FilhoAppPageHeader } from "@/components/FilhoAppPageHeader";
import type { EstrelasFilho } from "@/lib/child-app-session";

const dataHora = (valor: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(valor));

function Estrela({ className = "" }: { className?: string }) {
  return (
    <Star
      aria-hidden="true"
      className={`h-4 w-4 fill-amber-400 text-amber-500 ${className}`}
    />
  );
}

function ResgateStatus({ status }: { status: "PENDENTE" | "ENTREGUE" | "CANCELADO" }) {
  if (status === "PENDENTE") {
    return <Badge className="h-5 border-amber-200 bg-amber-100 px-1.5 py-0 text-[10px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/45 dark:text-amber-300">Pendente</Badge>;
  }
  if (status === "ENTREGUE") {
    return <Badge className="h-5 border-green-200 bg-green-100 px-1.5 py-0 text-[10px] font-semibold text-green-700 dark:border-green-800 dark:bg-green-950/45 dark:text-green-300">Entregue</Badge>;
  }
  return <Badge className="h-5 border-gray-200 bg-gray-100 px-1.5 py-0 text-[10px] font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">Cancelado</Badge>;
}

export function FilhoEstrelasPage({ estrelas }: { estrelas: EstrelasFilho }) {
  const [resgatesAbertos, setResgatesAbertos] = useState(false);

  const recompensasOrdenadas = [...estrelas.recompensas].sort((a, b) => a.id - b.id);

  const resgatesAtivos = estrelas.resgates.filter((item) => item.status === "PENDENTE");

  return (
    <div>
      <FilhoAppPageHeader
        title="Estrelas"
        description="Acompanhe suas estrelas e recompensas."
        icon={<Star className="h-4.5 w-4.5" />}
      />

      <div className="space-y-4">
        <section className="rounded-2xl border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border bg-amber-50 dark:bg-amber-950/35">
              <Estrela className="animate-subtle-shake h-9 w-9" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Estrelas conquistadas</p>
              <p className="mt-0.5 text-3xl font-bold leading-none tabular-nums">{estrelas.total_conquistado}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {estrelas.hoje > 0 ? `+${estrelas.hoje} hoje` : "Continue cumprindo seus combinados"}
              </p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="px-4 py-3.5 sm:px-5">
            <h2 className="text-sm font-semibold">Recompensas</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Veja o que está ao seu alcance.</p>
          </div>

          <div className="border-t bg-muted/10 p-3 sm:p-4">
            <div className="space-y-3">
              {recompensasOrdenadas.map((recompensa) => {
                const itemProgresso = Math.min(
                  100,
                  Math.max(0, (recompensa.progresso / recompensa.estrelas_necessarias) * 100),
                );

                return (
                  <article
                    key={recompensa.id}
                    className="rounded-xl border bg-background p-3.5 shadow-sm sm:p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-semibold leading-snug">{recompensa.nome}</p>
                        {recompensa.descricao && (
                          <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                            {recompensa.descricao}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 rounded-lg border bg-muted/20 px-2.5 py-1.5 text-center">
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Meta</p>
                        <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold">
                          <Estrela className="h-3.5 w-3.5" />
                          {recompensa.estrelas_necessarias}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 border-t pt-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Situação
                        </p>

                        {recompensa.pendente ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-300">
                            Aguardando entrega
                          </span>
                        ) : recompensa.disponivel ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[10px] font-bold text-green-700 dark:border-green-800 dark:bg-green-950/35 dark:text-green-300">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Disponível
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-muted-foreground">
                            Em progresso
                          </span>
                        )}
                      </div>

                      {!recompensa.pendente && (
                        <div className="mt-3 rounded-lg bg-muted/30 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-3 text-[11px]">
                            <span className="font-medium text-muted-foreground">Progresso</span>
                            <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                              {recompensa.progresso} de {recompensa.estrelas_necessarias}
                              <Estrela className="h-3 w-3" />
                            </span>
                          </div>

                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-[width]"
                              style={{ width: `${itemProgresso}%` }}
                            />
                          </div>

                          <p className="mt-1.5 text-[11px] text-muted-foreground">
                            {recompensa.disponivel
                              ? "Meta atingida"
                              : `Faltam ${recompensa.faltam} estrela${recompensa.faltam === 1 ? "" : "s"}`}
                          </p>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}

              {estrelas.recompensas.length === 0 && (
                <div className="rounded-xl border border-dashed bg-background p-4 sm:p-5">
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
        </section>

        {resgatesAtivos.length > 0 && (
          <CollapsibleSection
            title="Recompensas em andamento"
            count={resgatesAtivos.length}
            open={resgatesAbertos}
            onOpenChange={setResgatesAbertos}
          >
            <div className="divide-y">
              {resgatesAtivos.map((resgate) => (
                <div key={resgate.id} className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words text-sm font-semibold">{resgate.recompensa_nome}</p>
                      <ResgateStatus status={resgate.status} />
                    </div>
                    {resgate.recompensa_descricao_no_resgate && (
                      <p className="mt-0.5 break-words text-xs text-muted-foreground">
                        {resgate.recompensa_descricao_no_resgate}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">{dataHora(resgate.created_at)}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
                    <Estrela className="h-3.5 w-3.5" />
                    {resgate.meta_estrelas_no_resgate}
                  </span>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}
