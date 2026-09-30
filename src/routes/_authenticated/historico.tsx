import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, History, Search, ThumbsDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { Pick } from "@/components/Pick";
import { fmtData, fmtVigencia, useFilhos, useOcorrencias, useVigencias } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({ meta: [{ title: "Histórico — Combinado" }] }),
  component: HistoricoPage,
});

const fmtHora = (d: string) =>
  new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function HistoricoPage() {
  const { data: vigencias = [] } = useVigencias();
  const { data: filhos = [] } = useFilhos();
  const { data: ocorrencias = [], isLoading } = useOcorrencias();
  const [f, setF] = useState({ vig: "all", filho: "all" });
  const [filtro, setFiltro] = useState(f);

  const lista = ocorrencias.filter((o) => {
    const ft = o.t_filho_tarefa;
    return (
      (filtro.vig === "all" || ft?.id_vigencia === +filtro.vig) &&
      (filtro.filho === "all" || ft?.id_filho === +filtro.filho)
    );
  });

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

      <div className="grid gap-3">
        {lista.map((o) => {
          const ft = o.t_filho_tarefa;
          const penalidade = o.tipo === "PENALIDADE";
          return (
            <div
              key={o.id}
              className={`flex flex-col gap-2 rounded-2xl border bg-card p-4 md:flex-row md:items-center ${
                penalidade ? "border-destructive/50 bg-destructive/5" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display font-bold">{ft?.t_filho?.nome}</p>
                  <span className="text-muted-foreground">·</span>
                  <p className="font-medium">{ft?.t_tarefa?.nome}</p>
                  {penalidade ? (
                    <Badge variant="destructive">
                      <AlertTriangle className="mr-1 h-3 w-3" /> Penalidade atingida
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <ThumbsDown className="mr-1 h-3 w-3" /> Não fez
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {ft?.t_vigencia && fmtVigencia(ft.t_vigencia)}
                </p>
                {penalidade && (
                  <p className="mt-1 text-sm font-medium text-destructive">
                    {ft?.t_vigencia?.penalidade}
                  </p>
                )}
              </div>
              <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {fmtData(o.created_at)} às {fmtHora(o.created_at)}
              </p>
            </div>
          );
        })}
      </div>
    </>
  );
}
