import { useState } from "react";
import { Gift, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { EmptyState, PageHeader } from "@/components/PageHeader";
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
    return <Badge className="h-5 border-amber-200 bg-amber-100 px-1.5 py-0 text-[10px] font-semibold text-amber-700">Pendente</Badge>;
  }
  if (status === "ENTREGUE") {
    return <Badge className="h-5 border-green-200 bg-green-100 px-1.5 py-0 text-[10px] font-semibold text-green-700">Entregue</Badge>;
  }
  return <Badge className="h-5 border-gray-200 bg-gray-100 px-1.5 py-0 text-[10px] font-semibold text-gray-600">Cancelado</Badge>;
}

export function FilhoEstrelasPage({ estrelas }: { estrelas: EstrelasFilho }) {
  const [recompensasAbertas, setRecompensasAbertas] = useState(true);
  const [resgatesAbertos, setResgatesAbertos] = useState(false);

  return (
    <div>
      <PageHeader
        title="Estrelas"
        description="Saldo, recompensas e resgates."
        icon={<Star className="h-6 w-6" />}
      />

      <div className="space-y-4">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-background">
              <Estrela className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-amber-700">Saldo disponível</p>
              <p className="mt-0.5 text-3xl font-bold leading-none text-amber-900 tabular-nums">{estrelas.saldo}</p>
            </div>
            <div className="shrink-0 text-right text-[10px] leading-relaxed text-amber-800">
              <p>Hoje +{estrelas.hoje}</p>
              <p>Total {estrelas.total_conquistado}</p>
            </div>
          </div>
        </section>

        <CollapsibleSection
          title="Recompensas"
          count={estrelas.recompensas.length}
          open={recompensasAbertas}
          onOpenChange={setRecompensasAbertas}
        >
          <div className="space-y-2 p-4 sm:p-5">
            {estrelas.recompensas.map((recompensa) => {
              const faltam = Math.max(0, recompensa.estrelas_necessarias - estrelas.saldo);
              const progresso = Math.min(100, Math.max(0, (estrelas.saldo / recompensa.estrelas_necessarias) * 100));

              return (
                <article key={recompensa.id} className="rounded-2xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold">{recompensa.nome}</p>
                      {recompensa.descricao && (
                        <p className="mt-0.5 break-words text-xs text-muted-foreground">{recompensa.descricao}</p>
                      )}
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md border bg-muted/20 px-2 py-1 text-xs font-semibold">
                      <Estrela className="h-3.5 w-3.5" />
                      {recompensa.estrelas_necessarias}
                    </span>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progresso}%` }} />
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      {estrelas.saldo} de {recompensa.estrelas_necessarias}
                      <Estrela className="h-3 w-3" />
                    </span>
                    {recompensa.disponivel ? (
                      <Badge className="h-5 border-green-200 bg-green-100 px-1.5 py-0 text-[10px] font-semibold text-green-700">
                        Disponível
                      </Badge>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        Faltam {faltam}
                        <Estrela className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </article>
              );
            })}

            {estrelas.recompensas.length === 0 && (
              <EmptyState>
                <span className="flex flex-col items-center gap-2">
                  <Gift className="h-5 w-5" />
                  Nenhuma recompensa por enquanto.
                </span>
              </EmptyState>
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Meus resgates"
          description="Acompanhe o andamento das recompensas usadas."
          count={estrelas.resgates.length}
          open={resgatesAbertos}
          onOpenChange={setResgatesAbertos}
        >
          <div className="divide-y">
            {estrelas.resgates.map((resgate) => (
              <div key={resgate.id} className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-words text-sm font-semibold">{resgate.recompensa_nome}</p>
                    <ResgateStatus status={resgate.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{dataHora(resgate.created_at)}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
                  <Estrela className="h-3.5 w-3.5" />
                  {resgate.estrelas_utilizadas}
                </span>
              </div>
            ))}
            {estrelas.resgates.length === 0 && (
              <p className="px-4 py-5 text-center text-sm text-muted-foreground sm:px-5">Nenhuma recompensa resgatada ainda.</p>
            )}
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
