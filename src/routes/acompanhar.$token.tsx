import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CircleDollarSign, ClipboardList, Clock3, House, ThumbsDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/acompanhar/$token")({
  head: () => ({ meta: [
    { title: "Acompanhamento — Combinado Família" },
    { name: "description", content: "Painel de acompanhamento dos combinados." },
    { name: "robots", content: "noindex,nofollow,noarchive" },
  ] }),
  component: PainelPublico,
});

type Ocorrencia = { tipo: "NAO_FEZ" | "PENALIDADE"; data: string };
type Tarefa = { id: number; nome: string; qtd_nao_fez: number; ocorrencias: Ocorrencia[] };
type Vigencia = { id: number; data_inicio: string; data_fim: string; penalidade: string; qtd_ocorrencia: number; valor_debito: number | null; tarefas: Tarefa[] };
type Painel = { filho: { nome: string; tem_mesada: boolean; valor_mesada: number | null }; vigencias: Vigencia[]; atualizado_em: string };

const dataHora = (v: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(v));
const data = (v: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(v));
const dinheiro = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function status(v: Vigencia) { const agora = Date.now(), ini = new Date(v.data_inicio).getTime(), fim = new Date(v.data_fim).getTime(); return agora < ini ? "Futura" : agora <= fim ? "Em andamento" : "Finalizada"; }
const corStatus = (s: string) => s === "Em andamento" ? "bg-green-400" : s === "Finalizada" ? "bg-red-300" : "bg-gray-300";

function PainelPublico() {
  const { token } = Route.useParams();
  const [painel, setPainel] = useState<Painel | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [indisponivel, setIndisponivel] = useState(false);
  const [tarefaDatas, setTarefaDatas] = useState<Tarefa | null>(null);

  async function carregar() {
    const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
    const { data: retorno, error } = await rpc("obter_painel_publico_filho", { p_token: token });
    if (error || !retorno) { setIndisponivel(true); setPainel(null); setCarregando(false); return; }
    setPainel(retorno as Painel); setIndisponivel(false); setCarregando(false);
  }

  useEffect(() => {
    void carregar();
    const atualizarAoVoltar = () => { if (document.visibilityState === "visible") void carregar(); };
    document.addEventListener("visibilitychange", atualizarAoVoltar);
    const timer = window.setInterval(() => void carregar(), 60000);
    return () => { document.removeEventListener("visibilitychange", atualizarAoVoltar); window.clearInterval(timer); };
  }, [token]);

  const vigenciaAtual = useMemo(() => painel?.vigencias.find((v) => status(v) === "Em andamento") ?? null, [painel]);

  if (carregando) return <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4"><p className="text-sm text-muted-foreground">Carregando acompanhamento...</p></div>;
  if (indisponivel || !painel) return <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4"><Card className="w-full max-w-md"><CardContent className="pt-6 text-center"><House className="mx-auto h-9 w-9 text-muted-foreground" /><h1 className="mt-3 text-xl font-bold">Acesso indisponível</h1><p className="mt-2 text-sm text-muted-foreground">Este link não está ativo. Peça ao seu responsável um novo link de acompanhamento.</p></CardContent></Card></div>;

  const tarefasAtual = vigenciaAtual?.tarefas ?? [];
  const qtdNaoFez = tarefasAtual.reduce((n, t) => n + Number(t.qtd_nao_fez || 0), 0);
  const descontoUnitario = Number(vigenciaAtual?.valor_debito ?? 0);
  const desconto = painel.filho.tem_mesada ? qtdNaoFez * descontoUnitario : 0;
  const mesadaFinal = painel.filho.valor_mesada === null ? null : Math.max(0, painel.filho.valor_mesada - desconto);
  const datasNaoFez = tarefaDatas?.ocorrencias.filter((o) => o.tipo === "NAO_FEZ").sort((a, b) => +new Date(b.data) - +new Date(a.data)) ?? [];

  return <main className="min-h-screen bg-muted/20 px-3 py-5 sm:px-6 sm:py-8">
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2 font-display text-lg font-bold"><House className="h-5 w-5" /> combinado <span className="text-sm font-medium text-muted-foreground">família</span></div><h1 className="mt-5 text-2xl font-bold">Olá, {painel.filho.nome} 👋</h1><p className="mt-1 text-sm text-muted-foreground">Acompanhe aqui seus combinados. Este painel é somente para consulta.</p></header>

      {vigenciaAtual ? <>
        <Card><CardHeader className="pb-3"><div className="flex items-center justify-between gap-3"><CardTitle className="text-base">Vigência atual</CardTitle><span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium"><span className="h-2 w-2 rounded-full bg-green-400" />Em andamento</span></div></CardHeader><CardContent><p className="text-sm">{dataHora(vigenciaAtual.data_inicio)} até {dataHora(vigenciaAtual.data_fim)}</p></CardContent></Card>
        <div className="grid grid-cols-2 gap-2"><Card><CardContent className="p-3 text-center"><ClipboardList className="mx-auto h-5 w-5 text-muted-foreground" /><p className="mt-1 text-xl font-bold">{tarefasAtual.length}</p><p className="text-[11px] text-muted-foreground">Tarefas atribuídas</p></CardContent></Card><Card><CardContent className="p-3 text-center"><ThumbsDown className="mx-auto h-5 w-5 text-red-400" /><p className="mt-1 text-xl font-bold">{qtdNaoFez}</p><p className="text-[11px] text-muted-foreground">Não fez</p></CardContent></Card></div>
        <Card><CardHeader><CardTitle className="text-base">Minhas tarefas</CardTitle></CardHeader><CardContent className="space-y-2">{tarefasAtual.map((t) => <div key={t.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border p-3"><span className="min-w-0 text-sm font-medium">{t.nome}</span>{t.qtd_nao_fez > 0 ? <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center"><span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">👎 {t.qtd_nao_fez} Não fez</span><Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setTarefaDatas(t)}><CalendarDays className="h-3.5 w-3.5" /> Ver datas</Button></div> : <span className="shrink-0 text-xs text-muted-foreground">Sem “Não fez”</span>}</div>)}{tarefasAtual.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa atribuída nesta vigência.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CircleDollarSign className="h-4 w-4" />Resultado da vigência</CardTitle></CardHeader><CardContent>{painel.filho.tem_mesada ? <div className="space-y-2 text-sm"><div className="flex justify-between gap-3"><span>Mesada</span><strong>{dinheiro(painel.filho.valor_mesada ?? 0)}</strong></div><div className="flex justify-between gap-3"><span>Desconto por cada “Não fez”</span><strong>{dinheiro(descontoUnitario)}</strong></div><div className="flex justify-between gap-3"><span>Quantidade de “Não fez”</span><strong>{qtdNaoFez}</strong></div><div className="flex justify-between gap-3"><span>Total de descontos</span><strong>{dinheiro(desconto)}</strong></div><div className="flex justify-between gap-3 border-t pt-2"><span>Valor atual</span><strong>{dinheiro(mesadaFinal ?? 0)}</strong></div></div> : <div className="space-y-2 text-sm"><p><span className="text-muted-foreground">Penalidade:</span> <strong>{vigenciaAtual.penalidade || "—"}</strong></p><p><span className="text-muted-foreground">Quantidade de “Não fez” para ser penalizado:</span> <strong>{vigenciaAtual.qtd_ocorrencia}</strong></p><p><span className="text-muted-foreground">Quantidade atual:</span> <strong>{qtdNaoFez}</strong></p>{vigenciaAtual.qtd_ocorrencia > 0 && qtdNaoFez >= vigenciaAtual.qtd_ocorrencia && <p className="rounded-lg bg-red-50 p-2 text-xs font-medium text-red-700">Limite atingido</p>}</div>}</CardContent></Card>
      </> : <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Não há uma vigência em andamento neste momento.</p></CardContent></Card>}

      {painel.vigencias.length > 0 && <Card><CardHeader><CardTitle className="text-base">Vigências</CardTitle></CardHeader><CardContent className="space-y-2">{painel.vigencias.map((v) => { const s = status(v); return <div key={v.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="text-sm font-medium">{dataHora(v.data_inicio)} até {dataHora(v.data_fim)}</p><p className="mt-1 text-xs text-muted-foreground">{v.tarefas.length} tarefa(s) · {v.tarefas.reduce((n, t) => n + Number(t.qtd_nao_fez || 0), 0)} “Não fez”</p></div><span className="inline-flex shrink-0 items-center gap-1.5 text-xs"><span className={`h-2 w-2 rounded-full ${corStatus(s)}`} />{s}</span></div>; })}</CardContent></Card>}
      <p className="flex items-center justify-center gap-1.5 pb-4 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />Atualizado {dataHora(painel.atualizado_em)}</p>
    </div>

    <Dialog open={tarefaDatas !== null} onOpenChange={(open) => { if (!open) setTarefaDatas(null); }}>
      <DialogContent className="max-w-sm rounded-lg">
        <DialogHeader><DialogTitle>Datas de “Não fez”</DialogTitle><DialogDescription>{tarefaDatas?.nome}</DialogDescription></DialogHeader>
        <div className="max-h-[55vh] space-y-2 overflow-y-auto py-1">{datasNaoFez.map((o, i) => <div key={`${o.data}-${i}`} className="flex items-center gap-2 rounded-lg border px-3 py-2"><ThumbsDown className="h-4 w-4 shrink-0 text-red-400" /><span className="text-sm font-medium">{data(o.data)}</span></div>)}</div>
      </DialogContent>
    </Dialog>
  </main>;
}
