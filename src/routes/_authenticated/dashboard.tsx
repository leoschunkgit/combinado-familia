import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CalendarDays, Search, TrendingDown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { Pick } from "@/components/Pick";
import { fmtVigencia, useFilhos, useOcorrencias, useTarefas, useVigencias } from "@/lib/db";
import { ocorrenciasPenalizadas } from "@/lib/penalidade";
import { reais, usaDesconto, valorDebitado } from "@/lib/mesada";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Combinado" },
      { name: "description", content: "Visão resumida do histórico de ocorrências, penalidades e descontos." },
    ],
  }),
  component: DashboardPage,
});

function mesAno(data: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(data));
}

function DashboardPage() {
  const { data: vigencias = [] } = useVigencias();
  const { data: filhos = [] } = useFilhos();
  const { data: tarefas = [] } = useTarefas();
  const { data: ocorrencias = [], isLoading } = useOcorrencias();

  const [f, setF] = useState({ vig: "all", filho: "all" });
  const [filtro, setFiltro] = useState(f);

  const vigenciasOrdenadas = [...vigencias].sort(
    (a, b) => new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime(),
  );

  const lista = useMemo(
    () =>
      ocorrencias.filter((o) => {
        const ft = o.t_filho_tarefa;
        return (
          ft &&
          (filtro.vig === "all" || ft.id_vigencia === Number(filtro.vig)) &&
          (filtro.filho === "all" || ft.id_filho === Number(filtro.filho))
        );
      }),
    [ocorrencias, filtro],
  );

  const penalizadas = useMemo(() => ocorrenciasPenalizadas(lista, vigencias), [lista, vigencias]);

  const totalPenalidades = lista.filter((o) => {
    const ft = o.t_filho_tarefa;
    if (!ft || !penalizadas.has(o.id)) return false;
    const filho = filhos.find((x) => x.id === ft.id_filho);
    const vigencia = vigencias.find((x) => x.id === ft.id_vigencia);
    return Boolean(filho && vigencia && !usaDesconto(filho, vigencia));
  }).length;

  const gruposMesada = new Map<string, { filhoId: number; vigenciaId: number; total: number }>();
  for (const o of lista) {
    const ft = o.t_filho_tarefa;
    if (!ft) continue;
    const filho = filhos.find((x) => x.id === ft.id_filho);
    const vigencia = vigencias.find((x) => x.id === ft.id_vigencia);
    if (!filho || !vigencia || !usaDesconto(filho, vigencia)) continue;
    const chave = `${ft.id_filho}:${ft.id_vigencia}`;
    const atual = gruposMesada.get(chave) ?? { filhoId: ft.id_filho, vigenciaId: ft.id_vigencia, total: 0 };
    atual.total += 1;
    gruposMesada.set(chave, atual);
  }

  let totalDescontado = 0;
  for (const grupo of gruposMesada.values()) {
    const filho = filhos.find((x) => x.id === grupo.filhoId);
    const vigencia = vigencias.find((x) => x.id === grupo.vigenciaId);
    if (filho && vigencia) totalDescontado += valorDebitado(filho, vigencia, grupo.total);
  }

  const porFilho = filhos
    .map((filho) => {
      const regs = lista.filter((o) => o.t_filho_tarefa?.id_filho === filho.id);
      const penalidades = regs.filter((o) => {
        const ft = o.t_filho_tarefa;
        const vigencia = ft ? vigencias.find((x) => x.id === ft.id_vigencia) : undefined;
        return Boolean(ft && vigencia && penalizadas.has(o.id) && !usaDesconto(filho, vigencia));
      }).length;

      let desconto = 0;
      const porVigencia = new Map<number, number>();
      for (const o of regs) {
        const idVigencia = o.t_filho_tarefa?.id_vigencia;
        if (idVigencia) porVigencia.set(idVigencia, (porVigencia.get(idVigencia) ?? 0) + 1);
      }
      for (const [idVigencia, total] of porVigencia) {
        const vigencia = vigencias.find((x) => x.id === idVigencia);
        if (vigencia && usaDesconto(filho, vigencia)) desconto += valorDebitado(filho, vigencia, total);
      }

      const mesada = filho.tem_mesada_opcional === true && filho.valor_mesada !== null ? filho.valor_mesada : null;
      const diferenca = mesada === null ? null : Math.max(0, mesada - desconto);

      return { id: filho.id, nome: filho.nome, ocorrencias: regs.length, penalidades, desconto, mesada, diferenca };
    })
    .filter((x) => x.ocorrencias > 0)
    .sort((a, b) => b.ocorrencias - a.ocorrencias);

  const porTarefa = tarefas
    .map((tarefa) => ({
      id: tarefa.id,
      nome: tarefa.nome,
      total: lista.filter((o) => o.t_filho_tarefa?.id_tarefa === tarefa.id).length,
    }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const maxTarefa = Math.max(1, ...porTarefa.map((x) => x.total));

  const evolucaoMap = new Map<string, number>();
  for (const o of [...lista].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())) {
    const chave = mesAno(o.created_at);
    evolucaoMap.set(chave, (evolucaoMap.get(chave) ?? 0) + 1);
  }
  const evolucao = [...evolucaoMap.entries()].slice(-6).map(([periodo, total]) => ({ periodo, total }));
  const maxEvolucao = Math.max(1, ...evolucao.map((x) => x.total));

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão resumida do histórico de ocorrências, penalidades e descontos."
        icon={<BarChart3 className="h-6 w-6" />}
      />

      <Card className="mb-6">
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <Pick
            label="Vigência"
            value={f.vig}
            onChange={(vig) => setF({ ...f, vig })}
            allLabel="Todas"
            options={vigenciasOrdenadas.map((v) => ({
              value: String(v.id),
              label: fmtVigencia(v),
              status:
                new Date(v.data_fim).getTime() < Date.now()
                  ? "finalizada" as const
                  : new Date(v.data_inicio).getTime() <= Date.now()
                    ? "andamento" as const
                    : "futura" as const,
            }))}
          />
          <Pick
            label="Filho"
            value={f.filho}
            onChange={(filho) => setF({ ...f, filho })}
            allLabel="Todos"
            options={filhos.map((x) => ({ value: String(x.id), label: x.nome }))}
          />
          <Button onClick={() => setFiltro(f)}>
            <Search className="h-4 w-4" /> Pesquisar
          </Button>
        </CardContent>
      </Card>

      {!isLoading && lista.length === 0 ? (
        <EmptyState>Nenhuma ocorrência encontrada para os filtros selecionados.</EmptyState>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs font-medium text-muted-foreground">Total de “Não fez”</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{lista.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs font-medium text-muted-foreground">Penalidades atingidas</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{totalPenalidades}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs font-medium text-muted-foreground">Desconto em mesadas</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{reais(totalDescontado)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs font-medium text-muted-foreground">Filhos com ocorrências</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{porFilho.length}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" /> Resumo por filho
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {porFilho.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate font-semibold">{item.nome}</p>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{item.ocorrencias} “Não fez”</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {item.mesada !== null ? (
                        <>
                          <span>Mesada: <strong className="font-semibold text-foreground">{reais(item.mesada)}</strong></span>
                          <span>Desconto: <strong className="font-semibold text-foreground">{reais(item.desconto)}</strong></span>
                          <span>Diferença: <strong className="font-semibold text-foreground">{reais(item.diferenca ?? 0)}</strong></span>
                        </>
                      ) : (
                        item.penalidades > 0 && <span>{item.penalidades} penalidade(s)</span>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4" /> Tarefas com mais “Não fez”
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {porTarefa.map((item) => (
                  <div key={item.id}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium">{item.nome}</span>
                      <span className="shrink-0 tabular-nums">{item.total}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(6, (item.total / maxTarefa) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4" /> Evolução das ocorrências
              </CardTitle>
            </CardHeader>
            <CardContent>
              {evolucao.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados para exibir.</p>
              ) : (
                <div className="grid min-h-44 grid-cols-3 items-end gap-3 sm:grid-cols-6">
                  {evolucao.map((item) => (
                    <div key={item.periodo} className="flex h-40 min-w-0 flex-col justify-end">
                      <div className="mb-1 text-center text-xs font-semibold tabular-nums">{item.total}</div>
                      <div className="mx-auto w-full max-w-12 rounded-t-md bg-primary" style={{ height: `${Math.max(10, (item.total / maxEvolucao) * 110)}px` }} />
                      <div className="mt-2 truncate text-center text-[10px] text-muted-foreground sm:text-xs">{item.periodo}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {totalDescontado > 0 && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingDown className="h-3.5 w-3.5" />
              O total de desconto respeita o limite da mesada de cada filho em cada vigência.
            </p>
          )}
        </div>
      )}
    </>
  );
}
