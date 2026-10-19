import { useMemo, useState } from "react";
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
    return <Badge className="h-5 border-amber-200 bg-amber-100 px-1.5 py-0 text-[10px] font-semibold text-amber-700">Pendente</Badge>;
  }
  if (status === "ENTREGUE") {
    return <Badge className="h-5 border-green-200 bg-green-100 px-1.5 py-0 text-[10px] font-semibold text-green-700">Entregue</Badge>;
  }
  return <Badge className="h-5 border-gray-200 bg-gray-100 px-1.5 py-0 text-[10px] font-semibold text-gray-600">Cancelado</Badge>;
}

export function FilhoEstrelasPage({ estrelas }: { estrelas: EstrelasFilho }) {
  const [resgatesAbertos, setResgatesAbertos] = useState(false);

  const recompensasOrdenadas = useMemo(
    () => [...estrelas.recompensas].sort((a, b) => a.estrelas_necessarias - b.estrelas_necessarias),
    [estrelas.recompensas],
  );

  const proxima = recompensasOrdenadas.find((item) => !item.disponivel) ?? null;
  const conquistadas = recompensasOrdenadas.filter((item) => item.disponivel);
  const ultimaConquistada = conquistadas.at(-1) ?? null;
  const alvo = proxima ?? ultimaConquistada;
  const progresso = alvo
    ? Math.min(100, Math.max(0, (estrelas.saldo / alvo.estrelas_necessarias) * 100))
    : 0;

  const resgatesAtivos = estrelas.resgates.filter((item) => item.status === "PENDENTE");

  return (
    <div>
      <FilhoAppPageHeader
        title="Estrelas"
        description="Acompanhe sua próxima conquista."
        icon={<Star className="h-4.5 w-4.5" />}
      />

      <div className="space-y-4">
        <section className="rounded-2xl border bg-card p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border bg-amber-50">
              <Estrela className="h-9 w-9" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Seu saldo</p>
              <p className="mt-0.5 text-3xl font-bold leading-none tabular-nums">{estrelas.saldo}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {estrelas.hoje > 0 ? `+${estrelas.hoje} hoje` : "Continue cumprindo seus combinados"}
              </p>
            </div>
          </div>

          {alvo && (
            <div className="mt-4 border-t pt-4">
              {alvo.disponivel ? (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-green-700" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-green-700">Conquistado!</p>
                    <p className="mt-0.5 break-words text-sm font-semibold">{alvo.nome}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Você atingiu a quantidade necessária de estrelas.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Próxima recompensa</p>
                      <p className="mt-0.5 break-words text-sm font-semibold">{alvo.nome}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
                      <Estrela className="h-3.5 w-3.5" />
                      {alvo.estrelas_necessarias}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progresso}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Faltam {Math.max(0, alvo.estrelas_necessarias - estrelas.saldo)} para conquistar
                  </p>
                </>
              )}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="px-4 py-3.5 sm:px-5">
            <h2 className="text-sm font-semibold">Recompensas</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Veja o que está ao seu alcance.</p>
          </div>

          <div className="divide-y border-t">
            {recompensasOrdenadas.map((recompensa) => {
              const faltam = Math.max(0, recompensa.estrelas_necessarias - estrelas.saldo);
              const itemProgresso = Math.min(100, Math.max(0, (estrelas.saldo / recompensa.estrelas_necessarias) * 100));

              return (
                <article key={recompensa.id} className="px-4 py-3.5 sm:px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold">{recompensa.nome}</p>
                      {recompensa.descricao && (
                        <p className="mt-0.5 break-words text-xs text-muted-foreground">{recompensa.descricao}</p>
                      )}
                    </div>

                    {recompensa.disponivel ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[10px] font-bold text-green-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Conquistado
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
                        <Estrela className="h-3.5 w-3.5" />
                        {recompensa.estrelas_necessarias}
                      </span>
                    )}
                  </div>

                  {!recompensa.disponivel && (
                    <>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${itemProgresso}%` }} />
                      </div>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">Faltam {faltam}</p>
                    </>
                  )}
                </article>
              );
            })}

            {estrelas.recompensas.length === 0 && (
              <div className="p-4 sm:p-5">
                <EmptyState>
                  <span className="flex flex-col items-center gap-2">
                    <Gift className="h-5 w-5" />
                    Nenhuma recompensa por enquanto.
                  </span>
                </EmptyState>
              </div>
            )}
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
                    <p className="mt-1 text-xs text-muted-foreground">{dataHora(resgate.created_at)}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
                    <Estrela className="h-3.5 w-3.5" />
                    {resgate.estrelas_utilizadas}
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
