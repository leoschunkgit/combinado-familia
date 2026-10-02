import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { CalendarRange, FileDown, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pick } from "@/components/Pick";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { VigenciaStatus } from "@/components/VigenciaStatus";
import { fmtData, fmtDataHora, fmtVigencia, useFilhos, useFilhoTarefas, useOcorrencias, useVigencias } from "@/lib/db";
import { descricaoPenalidade, reais, resumoMesada, usaDesconto, valorDebitado } from "@/lib/mesada";
import { ocorrenciasPenalizadas } from "@/lib/penalidade";

export const Route = createFileRoute("/_authenticated/relatorio")({
  head: () => ({ meta: [
    { title: "Relatório — Combinado" },
    { name: "description", content: "Consulte e extraia em PDF os combinados por vigência e filho." },
  ] }),
  component: RelatorioPage,
});

function andamento(v: { data_inicio: string; data_fim: string }) {
  const agora = Date.now();
  return new Date(v.data_inicio).getTime() <= agora && new Date(v.data_fim).getTime() >= agora;
}

function statusVigencia(v: { data_inicio: string; data_fim: string }) {
  const agora = Date.now();
  if (new Date(v.data_fim).getTime() < agora) return "Finalizada";
  if (new Date(v.data_inicio).getTime() <= agora) return "Em andamento";
  return "Agendada";
}

function RelatorioPage() {
  const { data: vigencias = [], isLoading: loadingVigencias } = useVigencias();
  const { data: filhos = [], isLoading: loadingFilhos } = useFilhos();
  const { data: atribuicoes = [], isLoading: loadingAtribuicoes } = useFilhoTarefas();
  const { data: ocorrencias = [], isLoading: loadingOcorrencias } = useOcorrencias();
  const [f, setF] = useState({ vig: "all", filho: "all" });
  const [filtro, setFiltro] = useState(f);

  const vigenciasOrdenadas = useMemo(() => [...vigencias].sort((a, b) => {
    const aAndamento = andamento(a);
    const bAndamento = andamento(b);
    if (aAndamento !== bAndamento) return aAndamento ? -1 : 1;
    return new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime();
  }), [vigencias]);

  const relatorio = useMemo(() => vigenciasOrdenadas
    .filter((v) => filtro.vig === "all" || v.id === Number(filtro.vig))
    .map((vigencia) => ({
      vigencia,
      filhos: filhos
        .filter((filho) => filtro.filho === "all" || filho.id === Number(filtro.filho))
        .map((filho) => {
          const tarefas = atribuicoes.filter((a) => Number(a.id_vigencia) === Number(vigencia.id) && Number(a.id_filho) === Number(filho.id));
          const idsTarefasVigencia = new Set(tarefas.map((tarefa) => Number(tarefa.id)));
          const registros = ocorrencias.filter((o) => {
            const vinculo = o.t_filho_tarefa;
            return (
              idsTarefasVigencia.has(Number(o.id_filho_tarefa)) ||
              (Number(vinculo?.id_vigencia) === Number(vigencia.id) && Number(vinculo?.id_filho) === Number(filho.id))
            );
          });
          return { filho, tarefas, registros };
        })
        .filter(({ tarefas }) => tarefas.length > 0),
    }))
    .filter(({ filhos: itens }) => itens.length > 0), [vigenciasOrdenadas, filtro, filhos, atribuicoes, ocorrencias]);

  const penalizadas = ocorrenciasPenalizadas(ocorrencias, vigencias);
  const carregando = loadingVigencias || loadingFilhos || loadingAtribuicoes || loadingOcorrencias;

  function gerarPdf() {
    if (!relatorio.length) return;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margem = 14;
    const largura = 182;
    let y = 16;

    const pagina = () => {
      doc.addPage();
      y = 16;
    };
    const precisa = (altura: number) => {
      if (y + altura > 282) pagina();
    };
    const texto = (valor: string, x: number, larguraMax: number, tamanho = 9, negrito = false) => {
      doc.setFont("helvetica", negrito ? "bold" : "normal");
      doc.setFontSize(tamanho);
      const linhas = doc.splitTextToSize(valor, larguraMax);
      precisa(linhas.length * (tamanho * 0.42) + 2);
      doc.text(linhas, x, y);
      y += linhas.length * (tamanho * 0.42) + 2;
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Relatório de Combinados", margem, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Gerado em ${fmtDataHora(new Date().toISOString())}`, margem, y);
    y += 8;

    for (const grupo of relatorio) {
      precisa(28);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Vigência", margem, y);
      y += 6;
      texto(fmtVigencia(grupo.vigencia), margem, largura, 11, true);
      texto(`Status: ${statusVigencia(grupo.vigencia)}`, margem, largura);
      texto(`Limite: ${grupo.vigencia.qtd_ocorrencia} ocorrência(s)`, margem, largura);
      texto(descricaoPenalidade(grupo.vigencia), margem, largura);

      for (const grupoFilho of grupo.filhos) {
        const { filho, tarefas, registros } = grupoFilho;
        precisa(24);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(`Filho: ${filho.nome}`, margem + 4, y);
        y += 6;

        const total = registros.length;
        texto(`Não fez: ${total} de ${grupo.vigencia.qtd_ocorrencia}`, margem + 4, largura - 4, 9, true);
        if (filho.valor_mesada !== null && filho.tem_mesada_opcional) {
          texto(`Mesada: ${reais(filho.valor_mesada)} · ${resumoMesada(filho, grupo.vigencia, total)}`, margem + 4, largura - 4);
        } else {
          texto(`Penalidade escrita ao atingir o limite: ${grupo.vigencia.penalidade || "Não cadastrada"}`, margem + 4, largura - 4);
        }

        for (const tarefa of tarefas) {
          const registrosTarefa = registros
            .filter((o) => Number(o.t_filho_tarefa?.id_tarefa) === Number(tarefa.id))
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          precisa(14);
          texto(`Tarefa: ${tarefa.t_tarefa?.nome || "Tarefa"} · Não fez: ${registrosTarefa.length}`, margem + 8, largura - 8, 9, true);
          if (!registrosTarefa.length) {
            texto("Nenhum registro de “Não fez”.", margem + 12, largura - 12, 8);
          } else {
            for (const [i, registro] of registrosTarefa.entries()) {
              const penalidade = penalizadas.has(registro.id);
              const detalhe = `${i + 1}º não fez: ${fmtData(registro.created_at)}${penalidade ? " · Limite atingido" : ""}`;
              texto(detalhe, margem + 12, largura - 12, 8);
            }
          }
        }
        y += 3;
      }
      y += 4;
    }

    const totalPaginas = doc.getNumberOfPages();
    for (let i = 1; i <= totalPaginas; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Combinado · Página ${i} de ${totalPaginas}`, margem, 290);
    }
    doc.save(`relatorio-combinado-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <>
      <PageHeader title="Relatório" description="Consulte os combinados completos por vigência e filho e extraia um PDF organizado." icon={<FileText className="h-6 w-6" />} />
      <Card className="mb-6">
        <CardContent className="grid gap-4 pt-6 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Pick label="Vigência" value={f.vig} onChange={(v) => setF({ ...f, vig: v })} allLabel="Todas" options={vigenciasOrdenadas.map((v) => ({
            value: String(v.id),
            label: fmtVigencia(v),
            status: new Date(v.data_fim).getTime() < Date.now() ? "finalizada" as const : andamento(v) ? "andamento" as const : undefined,
          }))} />
          <Pick label="Filho" value={f.filho} onChange={(v) => setF({ ...f, filho: v })} allLabel="Todos" options={filhos.map((x) => ({ value: String(x.id), label: x.nome }))} />
          <Button onClick={() => setFiltro(f)}><Search className="h-4 w-4" /> Pesquisar</Button>
        </CardContent>
      </Card>

      <div className="mb-6 flex justify-end">
        <Button onClick={gerarPdf} disabled={carregando || relatorio.length === 0}><FileDown className="h-4 w-4" /> Extrair PDF</Button>
      </div>

      {!carregando && relatorio.length === 0 && <EmptyState>Nenhuma informação encontrada para os filtros selecionados.</EmptyState>}

      <div className="space-y-8">
        {relatorio.map(({ vigencia, filhos: gruposFilhos }) => (
          <section key={vigencia.id} className="space-y-4" aria-label={`Vigência ${fmtVigencia(vigencia)}`}>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CalendarRange className="h-5 w-5 text-primary" />
                  <CardTitle>{fmtVigencia(vigencia)}</CardTitle>
                  <VigenciaStatus vigencia={vigencia} />
                </div>
                <p className="text-sm text-muted-foreground">{descricaoPenalidade(vigencia)}</p>
                <p className="text-sm text-muted-foreground">Limite: {vigencia.qtd_ocorrencia} ocorrência(s)</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {gruposFilhos.map(({ filho, tarefas, registros }) => {
                  const total = registros.length;
                  const comDesconto = usaDesconto(filho, vigencia);
                  return (
                    <div key={filho.id} className="rounded-xl border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-lg font-bold">{filho.nome}</h3>
                        <span className="text-sm font-semibold tabular-nums">Não fez: {total} de {vigencia.qtd_ocorrencia}</span>
                      </div>
                      {comDesconto ? (
                        <p className="mt-2 text-sm font-medium tabular-nums">Mesada: {reais(filho.valor_mesada ?? 0)} · {resumoMesada(filho, vigencia, total)}</p>
                      ) : (
                        <p className="mt-2 text-sm font-medium">Penalidade escrita ao atingir o limite: {vigencia.penalidade || "Não cadastrada"}</p>
                      )}
                      <div className="mt-4 space-y-3">
                        {tarefas.map((tarefa) => {
                          const registrosTarefa = registros.filter((o) => o.t_filho_tarefa?.id_tarefa === tarefa.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                          return (
                            <div key={tarefa.id} className="border-t pt-3">
                              <div className="flex flex-wrap justify-between gap-2">
                                <span className="font-semibold">{tarefa.t_tarefa?.nome}</span>
                                <span className="text-sm text-muted-foreground">{registrosTarefa.length} “Não fez”</span>
                              </div>
                              {registrosTarefa.length ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {registrosTarefa.map((o) => <span key={o.id} className="rounded-md bg-muted px-2 py-1 text-xs tabular-nums">{fmtData(o.created_at)}</span>)}
                                </div>
                              ) : <p className="mt-2 text-xs text-muted-foreground">Nenhum registro de “Não fez”.</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </section>
        ))}
      </div>
    </>
  );
}
