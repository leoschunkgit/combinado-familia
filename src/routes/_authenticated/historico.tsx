import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, CalendarRange, History, Search, ThumbsDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { Pick } from "@/components/Pick";
import { fmtData, fmtVigencia, useFilhos, useOcorrencias, useVigencias } from "@/lib/db";
import { ocorrenciasPenalizadas } from "@/lib/penalidade";
import { reais, resumoMesada, usaDesconto, valorDebitado } from "@/lib/mesada";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({ meta: [
    { title: "Histórico — Combinado" },
    { name: "description", content: "Veja as ocorrências registradas e as penalidades por filho e vigência." },
    { property: "og:title", content: "Histórico — Combinado" },
    { property: "og:description", content: "Veja as ocorrências registradas e as penalidades por filho e vigência." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: HistoricoPage,
});

const fmtHora = (d: string) =>
  new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function HistoricoPage() {
  const { data: vigencias = [] } = useVigencias();
  const { data: filhos = [] } = useFilhos();
  const { data: ocorrencias = [], isLoading } = useOcorrencias();
  const penalizadas = ocorrenciasPenalizadas(ocorrencias, vigencias);
  const [f, setF] = useState({ vig: "all", filho: "all" });
  const [filtro, setFiltro] = useState(f);

  const lista = ocorrencias.filter((o) => {
    const ft = o.t_filho_tarefa;
    return (
      (filtro.vig === "all" || ft?.id_vigencia === +filtro.vig) &&
      (filtro.filho === "all" || ft?.id_filho === +filtro.filho)
    );
  });
  const grupos = vigencias
    .map((vigencia) => ({
      vigencia,
      filhos: filhos
        .map((filho) => ({
          filho,
          registros: lista.filter(
            (o) => o.t_filho_tarefa?.id_vigencia === vigencia.id && o.t_filho_tarefa?.id_filho === filho.id,
          ),
        }))
        .filter(({ registros }) => registros.length > 0),
    }))
    .filter(({ filhos }) => filhos.length > 0);

  return (
    <>
      <PageHeader
        title="Histórico"
        description="Consulte quando cada ocorrência foi registrada e qual penalidade foi atingida."
        icon={<History className="h-6 w-6" />}
      />
      <Card className="mb-6">
        <CardContent className="grid gap-4 pt-6 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Pick
            label="Vigência"
            value={f.vig}
            onChange={(v) => setF({ ...f, vig: v })}
            allLabel="Todas"
            options={vigencias.map((v) => ({ value: String(v.id), label: fmtVigencia(v) }))}
          />
          <Pick
            label="Filho"
            value={f.filho}
            onChange={(v) => setF({ ...f, filho: v })}
            allLabel="Todos"
            options={filhos.map((x) => ({ value: String(x.id), label: x.nome }))}
          />
          <Button onClick={() => setFiltro(f)}>
            <Search className="h-4 w-4" /> Pesquisar
          </Button>
        </CardContent>
      </Card>

      {!isLoading && lista.length === 0 && (
        <EmptyState>Nenhuma ocorrência registrada ainda. Registre na aba "Ocorrências".</EmptyState>
      )}

      <div className="space-y-8">
        {grupos.map(({ vigencia, filhos: gruposFilhos }) => (
          <section key={vigencia.id} aria-label={`Vigência ${fmtVigencia(vigencia)}`}>
            <h2 className="mb-3 flex items-center gap-2 border-b pb-3 text-lg font-bold">
              <CalendarRange className="h-5 w-5 text-primary" aria-hidden="true" />
              <span>Vigência: {fmtVigencia(vigencia)}</span>
            </h2>
            <div className="space-y-6">
               {gruposFilhos.map(({ filho, registros }) => (
                <section key={filho.id} aria-label={`Filho ${filho.nome}`}>
                  <h3 className="mb-3 font-display font-bold text-foreground">{filho.nome}</h3>
                   {usaDesconto(filho, vigencia) ? (
                     <p className="mb-3 text-sm font-medium tabular-nums">Mesada: {reais(filho.valor_mesada ?? 0)} · {resumoMesada(filho, vigencia, registros.length)}</p>
                   ) : (
                     <p className="mb-3 text-sm font-medium">Penalidade escrita ao atingir o limite: {vigencia.penalidade || "Não cadastrada"}</p>
                   )}
                  <div className="grid gap-3">
                     {[...registros].sort((a, b) => a.id - b.id).map((o, indice) => {
                      const ft = o.t_filho_tarefa;
                      const penalidade = penalizadas.has(o.id);
                      return (
                        <div
                          key={o.id}
                          className={`flex flex-col gap-2 rounded-2xl border bg-card p-4 md:flex-row md:items-center ${
                            penalidade ? "border-destructive/50 bg-destructive/5" : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{ft?.t_tarefa?.nome}</p>
                               {penalidade ? (
                                <Badge variant="destructive">
                                    <AlertTriangle className="mr-1 h-3 w-3" /> {usaDesconto(filho, vigencia) ? "Limite atingido" : "Penalidade atingida"}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <ThumbsDown className="mr-1 h-3 w-3" /> Não fez
                                </Badge>
                              )}
                            </div>
                              {usaDesconto(filho, vigencia) ? (
                               <p className="mt-1 text-sm font-medium tabular-nums text-foreground">Desconto: {reais(valorDebitado(filho, vigencia, indice + 1) - valorDebitado(filho, vigencia, indice))} · Mesada após este registro: {reais(Math.max(0, (filho.valor_mesada ?? 0) - valorDebitado(filho, vigencia, indice + 1)))}</p>
                             ) : penalidade && (
                              <p className="mt-1 text-sm font-medium text-destructive">
                                  {vigencia.penalidade}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 md:text-right">
                            <p className="text-xs font-semibold text-muted-foreground">Data da ocorrência</p>
                            <p className="mt-1 text-sm tabular-nums text-foreground">
                              {fmtData(o.created_at)} às {fmtHora(o.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
