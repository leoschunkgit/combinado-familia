import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { CalendarRange, ChevronsDownUp, ChevronsUpDown, FileDown, FileText, Search, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pick } from "@/components/Pick";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { compararVigencias, situacaoVigencia, VigenciaStatus } from "@/components/VigenciaStatus";
import { CollapseChevron } from "@/components/CollapseChevron";
import { fmtData, fmtDataHora, fmtVigencia, useFilhos, useFilhoTarefas, useOcorrencias, useVigencias, useTarefas, type Ocorrencia } from "@/lib/db";
import { descricaoPenalidade, reais, resumoMesada, usaDesconto } from "@/lib/mesada";
import { ocorrenciasPenalizadas } from "@/lib/penalidade";
import { savePdfDocument } from "@/lib/pdf-export";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/relatorio")({
  head: () => ({ meta: [
    { title: "Relatório / Histórico — Combinado" },
    { name: "description", content: "Consulte e extraia em PDF os combinados por vigência e filho." },
  ] }),
  component: RelatorioPage,
});

function statusVigencia(v: { data_inicio: string; data_fim: string }) {
  const status = situacaoVigencia(v);
  return status === "andamento" ? "Em andamento" : status === "finalizada" ? "Finalizada" : "Irá começar";
}

function ehFez(o: Ocorrencia) { return o.tipo === "FEZ"; }
function naoFez(o: Ocorrencia) { return o.tipo !== "FEZ"; }
function bonus(o: Ocorrencia) {
  if (o.tipo !== "FEZ") return "";
  if (o.bonificacao_tipo === "TEXTO" && o.bonificacao_descricao) return o.bonificacao_descricao;
  if (o.bonificacao_tipo === "VALOR" && o.bonificacao_valor != null) return reais(o.bonificacao_valor);
  return "";
}

function RelatorioPage() {
  const { data: vigencias = [], isLoading: loadingVigencias } = useVigencias();
  const { data: filhos = [], isLoading: loadingFilhos } = useFilhos();
  const { data: atribuicoes = [], isLoading: loadingAtribuicoes } = useFilhoTarefas();
  const { data: tarefasCadastradas = [] } = useTarefas();
  const { data: ocorrencias = [], isLoading: loadingOcorrencias } = useOcorrencias();
  const [f, setF] = useState({ vig: "all", filho: "all", tarefa: "all" });
  const [filtro, setFiltro] = useState(f);
  const [vigenciasAbertas, setVigenciasAbertas] = useState<Record<number, boolean>>({});
  const [filhosAbertos, setFilhosAbertos] = useState<Record<string, boolean>>({});

  const vigenciasOrdenadas = useMemo(() => [...vigencias].sort(compararVigencias), [vigencias]);

  const relatorio = useMemo(() => vigenciasOrdenadas
    .filter((vigencia) => filtro.vig === "all" || Number(vigencia.id) === Number(filtro.vig))
    .map((vigencia) => ({
      vigencia,
      filhos: filhos.filter((filho) => filtro.filho === "all" || Number(filho.id) === Number(filtro.filho)).map((filho) => {
        const tarefas = atribuicoes.filter((r) => Number(r.id_vigencia) === Number(vigencia.id) && Number(r.id_filho) === Number(filho.id) && (filtro.tarefa === "all" || Number(r.id_tarefa) === Number(filtro.tarefa)));
        const registros = tarefas.flatMap((r) => ocorrencias.filter((o) => Number(o.id_filho_tarefa) === Number(r.id)));
        return { filho, tarefas, registros };
      }).filter(({ tarefas }) => tarefas.length > 0),
    })).filter(({ filhos: itens }) => itens.length > 0), [vigenciasOrdenadas, filtro, filhos, atribuicoes, ocorrencias]);

  const penalizadas = ocorrenciasPenalizadas(ocorrencias, vigencias);
  const carregando = loadingVigencias || loadingFilhos || loadingAtribuicoes || loadingOcorrencias;

  function definirTudo(aberto: boolean) {
    setVigenciasAbertas(Object.fromEntries(relatorio.map(({ vigencia }) => [vigencia.id, aberto])));
    setFilhosAbertos(Object.fromEntries(relatorio.flatMap(({ vigencia, filhos: gruposFilhos }) => gruposFilhos.map(({ filho }) => [`${vigencia.id}-${filho.id}`, aberto]))));
  }

  async function gerarPdf() {
    if (!relatorio.length) return;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margem = 14, largura = 182;
    let y = 16;
    const pagina = () => { doc.addPage(); y = 16; };
    const precisa = (altura: number) => { if (y + altura > 282) pagina(); };
    const texto = (valor: string, x: number, larguraMax: number, tamanho = 9, negrito = false) => {
      doc.setFont("helvetica", negrito ? "bold" : "normal"); doc.setFontSize(tamanho);
      const linhas = doc.splitTextToSize(valor, larguraMax); precisa(linhas.length * (tamanho * 0.42) + 2);
      doc.text(linhas, x, y); y += linhas.length * (tamanho * 0.42) + 2;
    };
    doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text("Relatório de Combinados", margem, y); y += 8;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(`Gerado em ${fmtDataHora(new Date().toISOString())}`, margem, y); y += 8;

    for (const grupo of relatorio) {
      precisa(28); doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text("Vigência", margem, y); y += 6;
      texto(fmtVigencia(grupo.vigencia), margem, largura, 11, true);
      texto(`Status: ${statusVigencia(grupo.vigencia)}`, margem, largura);
      texto(`Limite: ${grupo.vigencia.qtd_ocorrencia} ocorrência(s)`, margem, largura);
      texto(descricaoPenalidade(grupo.vigencia), margem, largura);
      for (const { filho, tarefas, registros } of grupo.filhos) {
        precisa(24); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(`Filho: ${filho.nome}`, margem + 4, y); y += 6;
        const totalNaoFez = registros.filter(naoFez).length;
        const comDesconto = usaDesconto(filho, grupo.vigencia);
        if (comDesconto) texto(`Mesada: ${reais(filho.valor_mesada ?? 0)} · ${resumoMesada(filho, grupo.vigencia, totalNaoFez)}`, margem + 4, largura - 4);
        else texto(`Penalidade escrita ao atingir o limite: ${grupo.vigencia.penalidade || "Não cadastrada"}`, margem + 4, largura - 4);
        for (const tarefa of tarefas) {
          const registrosTarefa = ocorrencias.filter((o) => Number(o.id_filho_tarefa) === Number(tarefa.id)).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          precisa(14); texto(`Tarefa: ${tarefa.t_tarefa?.nome || "Tarefa"}`, margem + 8, largura - 8, 9, true);
          if (!registrosTarefa.length) texto("Nenhum resultado registrado.", margem + 12, largura - 12, 8);
          else for (const registro of registrosTarefa) {
            const penalidade = registro.tipo !== "FEZ" && !comDesconto && penalizadas.has(registro.id);
            const bonificacao = bonus(registro);
            texto(`${registro.tipo === "FEZ" ? "Fez" : "Não fez"}: ${fmtData(registro.created_at)}${bonificacao ? ` · Bonificação: ${bonificacao}` : ""}${penalidade ? " · Limite atingido" : ""}`, margem + 12, largura - 12, 8);
          }
        }
        y += 3;
      }
      y += 4;
    }
    const totalPaginas = doc.getNumberOfPages();
    for (let i = 1; i <= totalPaginas; i++) { doc.setPage(i); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(`Combinado · Página ${i} de ${totalPaginas}`, margem, 290); }
    try {
      await savePdfDocument(doc, `relatorio-combinado-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      toast.error("Não foi possível salvar ou compartilhar o PDF.");
    }
  }

  return <>
    <PageHeader title="Relatório / Histórico" description="Consulte o histórico completo por vigência, filho e tarefa e extraia um PDF organizado." icon={<FileText className="h-6 w-6" />} />
    <Card className="mb-6"><CardContent className="grid gap-4 pt-6 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
      <Pick label="Vigência" value={f.vig} onChange={(v) => setF({ ...f, vig: v })} allLabel="Todas" options={vigenciasOrdenadas.map((v) => ({value:String(v.id),label:fmtVigencia(v),status:situacaoVigencia(v)}))} />
      <Pick label="Filho" value={f.filho} onChange={(v) => setF({ ...f, filho: v })} allLabel="Todos" options={filhos.map((x) => ({ value: String(x.id), label: x.nome }))} />
      <Pick label="Tarefa" value={f.tarefa} onChange={(v) => setF({ ...f, tarefa: v })} allLabel="Todas" options={tarefasCadastradas.map((t) => ({ value: String(t.id), label: t.nome }))} />
      <Button onClick={() => setFiltro(f)}><Search className="h-4 w-4" /> Pesquisar</Button>
    </CardContent></Card>
    <div className="mb-6 flex flex-wrap justify-end gap-2">
      <Button variant="outline" size="sm" onClick={() => definirTudo(true)} disabled={carregando || !relatorio.length}><ChevronsDownUp className="h-4 w-4" /> Expandir tudo</Button>
      <Button variant="outline" size="sm" onClick={() => definirTudo(false)} disabled={carregando || !relatorio.length}><ChevronsUpDown className="h-4 w-4" /> Recolher tudo</Button>
      <Button onClick={() => void gerarPdf()} disabled={carregando || !relatorio.length}><FileDown className="h-4 w-4" /> Extrair PDF</Button>
    </div>
    {!carregando && !relatorio.length && <EmptyState>Nenhuma informação encontrada para os filtros selecionados.</EmptyState>}
    <div className="space-y-4">{relatorio.map(({ vigencia, filhos: gruposFilhos }) => {
      const vigenciaAberta = vigenciasAbertas[vigencia.id] === true;
      return <section key={vigencia.id}><Card><CardHeader>
        <button type="button" className="flex w-full cursor-pointer items-start gap-2 text-left" onClick={() => setVigenciasAbertas(a => ({...a,[vigencia.id]:!vigenciaAberta}))}><CollapseChevron open={vigenciaAberta} className="mt-0.5" /><CalendarRange className="mt-0.5 h-5 w-5 shrink-0 text-primary"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><CardTitle>{fmtVigencia(vigencia)}</CardTitle><VigenciaStatus vigencia={vigencia}/></div></div></button>
        {vigenciaAberta && <div className="mt-2 space-y-1.5"><div className="w-full rounded-lg border border-amber-400 bg-amber-50/60 px-3 py-1.5 text-xs dark:border-amber-700/60 dark:bg-amber-950/10"><b>Penalidade:</b> <span className="text-muted-foreground">{vigencia.penalidade||"Não cadastrada"} · </span><b>Limite:</b> <span className="text-muted-foreground">{vigencia.qtd_ocorrencia} ocorrência(s)</span></div><div className="w-full rounded-lg border border-emerald-400 bg-emerald-50/60 px-3 py-1.5 text-xs dark:border-emerald-700/60 dark:bg-emerald-950/10"><b>Desconto da mesada:</b> <span className="text-muted-foreground">{vigencia.valor_debito!==null?`${reais(vigencia.valor_debito)} por Não fez`:"Não cadastrado"}</span></div></div>}
      </CardHeader>{vigenciaAberta && <CardContent className="space-y-3">{gruposFilhos.map(({filho,tarefas,registros}) => {
        const totalFez=registros.filter(ehFez).length,totalNaoFez=registros.filter(naoFez).length,comDesconto=usaDesconto(filho,vigencia),chave=`${vigencia.id}-${filho.id}`,aberto=filhosAbertos[chave]===true;
        return <div key={filho.id} className="rounded-xl border"><button type="button" className="flex w-full cursor-pointer items-center gap-2 p-4 text-left" onClick={()=>setFilhosAbertos(a=>({...a,[chave]:!aberto}))}><CollapseChevron open={aberto} /><h3 className="min-w-0 truncate text-lg font-bold">{filho.nome}</h3></button>
        {aberto && <div className="border-t p-4 pt-3">{comDesconto?<p className="text-sm font-medium tabular-nums">Mesada: {reais(filho.valor_mesada??0)} · {resumoMesada(filho,vigencia,totalNaoFez)}</p>:<p className="text-sm font-medium">Penalidade escrita ao atingir o limite: {vigencia.penalidade||"Não cadastrada"}</p>}<div className="mt-4 space-y-3">{tarefas.map(tarefa=>{
          const rs=ocorrencias.filter(o=>Number(o.id_filho_tarefa)===Number(tarefa.id)).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
          return <div key={tarefa.id} className="border-t pt-3"><div><span className="font-semibold">{tarefa.t_tarefa?.nome}</span></div>{rs.length?<div className="mt-2 space-y-1.5">{rs.map(o=><div key={o.id} className="flex flex-wrap items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs tabular-nums">{o.tipo==="FEZ"?<ThumbsUp className="h-4 w-4 text-green-600"/>:<ThumbsDown className="h-4 w-4 text-destructive"/>}<span className="font-medium">{o.tipo==="FEZ"?"Fez":"Não fez"}</span><span>· {fmtData(o.created_at)}</span>{bonus(o)&&<span>· Bonificação: {bonus(o)}</span>}{o.tipo!=="FEZ"&&!comDesconto&&penalizadas.has(o.id)&&<span className="font-semibold text-destructive">· Limite atingido</span>}</div>)}</div>:<p className="mt-2 text-xs text-muted-foreground">Nenhum resultado registrado.</p>}</div>;
        })}</div></div>}</div>;
      })}</CardContent>}</Card></section>;
    })}</div>
  </>;
}
