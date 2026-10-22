import { createFileRoute } from "@tanstack/react-router";
import { situacaoVigencia } from "@/components/VigenciaStatus";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CircleDollarSign, ClipboardList, Clock3, House, Minus, ThumbsDown, ThumbsUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FilhoAvatar } from "@/components/FilhoAvatar";
import { TarefaIcone } from "@/components/TarefaIcone";
import { AppBrand } from "@/components/AppBrand";
import { appPageHorizontalPaddingClass, appPageInnerClass } from "@/components/AppPageContent";
import { ConsequenciaOcorrenciaResumo } from "@/components/ConsequenciaOcorrenciaResumo";
import {
  consequenciaEhDescontoAplicado,
  consequenciaEhPenalidadePendente,
} from "@/lib/ocorrencia-model";

export const Route = createFileRoute("/acompanhar/$token")({
  head: () => ({ meta: [
    { title: "Acompanhamento — Combinado Família" },
    { name: "description", content: "Painel de acompanhamento dos combinados." },
    { property: "og:title", content: "Acompanhamento — Combinado Família" },
    { property: "og:description", content: "Painel de acompanhamento dos combinados." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex,nofollow,noarchive" },
    { name: "referrer", content: "no-referrer" },
  ] }),
  component: PainelPublico,
});

type Consequencia = {
  tipo: "DESCONTO" | "PENALIDADE";
  desconto_valor: number | null;
  penalidade_descricao: string | null;
  status: "APLICADO" | "PENDENTE" | "SUSPENSA_REVISAO" | "CUMPRIDA" | "CANCELADA" | "ESTORNADO";
  cumprida_em: string | null;
  cancelada_em: string | null;
};
type Ocorrencia = {
  id: number;
  tipo: "FEZ" | "NAO_FEZ" | "NAO_PRECISOU";
  data: string;
  consequencia: Consequencia | null;
};
type Tarefa = { id: number; nome: string; ocorrencias: Ocorrencia[] };
type Vigencia = { id: number; data_inicio: string; data_fim: string; qtd_nao_fez: number; qtd_nao_precisou?: number; tarefas: Tarefa[] };
type Painel = { filho: { nome: string; cor: string | null; avatar: string | null; tem_mesada: boolean; valor_mesada: number | null }; responsavel: { nome: string }; vigencias: Vigencia[]; atualizado_em: string };

const dataHora = (v: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(v));
const data = (v: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(v));
const dinheiro = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function status(v: Vigencia) { const s = situacaoVigencia(v); return s === "andamento" ? "Em andamento" : s === "futura" ? "Irá começar" : "Finalizada"; }
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

  const vigenciasOrdenadas = useMemo(() => [...(painel?.vigencias ?? [])].sort((a, b) => {
    const ordem = (v: Vigencia) => status(v) === "Em andamento" ? 0 : status(v) === "Irá começar" ? 1 : 2;
    const oa = ordem(a), ob = ordem(b);
    if (oa !== ob) return oa - ob;
    const ia = new Date(a.data_inicio).getTime(), ib = new Date(b.data_inicio).getTime();
    return oa === 2 ? ib - ia : ia - ib;
  }), [painel]);
  const vigenciaAtual = useMemo(() => vigenciasOrdenadas.find((v) => status(v) === "Em andamento") ?? null, [vigenciasOrdenadas]);

  if (carregando) return <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4"><p className="text-sm text-muted-foreground">Carregando acompanhamento...</p></div>;
  if (indisponivel || !painel) return <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4"><Card className="w-full max-w-md"><CardContent className="pt-6 text-center"><House className="mx-auto h-9 w-9 text-muted-foreground" /><h1 className="mt-3 text-xl font-bold">Acesso indisponível</h1><p className="mt-2 text-sm text-muted-foreground">Este link não está ativo. Peça ao seu responsável um novo link de acompanhamento.</p></CardContent></Card></div>;

  const tarefasAtual = vigenciaAtual?.tarefas ?? [];
  const qtdNaoFez = vigenciaAtual?.qtd_nao_fez ?? tarefasAtual.reduce((n, t) => n + t.ocorrencias.filter((o) => o.tipo === "NAO_FEZ").length, 0);
  const qtdFez = tarefasAtual.reduce((n, t) => n + t.ocorrencias.filter((o) => o.tipo === "FEZ").length, 0);
  const qtdNaoPrecisou = vigenciaAtual?.qtd_nao_precisou ?? tarefasAtual.reduce((n, t) => n + t.ocorrencias.filter((o) => o.tipo === "NAO_PRECISOU").length, 0);
  const desconto = painel.filho.tem_mesada
    ? tarefasAtual.reduce(
        (total, tarefa) =>
          total +
          tarefa.ocorrencias.reduce((subtotal, ocorrencia) => {
            const c = ocorrencia.consequencia;
            return c?.tipo === "DESCONTO" && c.status === "APLICADO"
              ? subtotal + Number(c.desconto_valor ?? 0)
              : subtotal;
          }, 0),
        0,
      )
    : 0;
  const mesadaFinal = painel.filho.valor_mesada === null ? null : Math.max(0, painel.filho.valor_mesada - desconto);
  const penalidadesPendentes = tarefasAtual.reduce(
    (total, tarefa) =>
      total +
      tarefa.ocorrencias.filter(
        (o) =>
          o.tipo === "NAO_FEZ" &&
          o.consequencia?.tipo === "PENALIDADE" &&
          o.consequencia.status === "PENDENTE",
      ).length,
    0,
  );
  const resultados = tarefaDatas?.ocorrencias.filter((o) => o.tipo === "FEZ" || o.tipo === "NAO_FEZ" || o.tipo === "NAO_PRECISOU").sort((a, b) => +new Date(b.data) - +new Date(a.data)) ?? [];

  return <main className={`native-safe-area min-h-screen bg-muted/20 ${appPageHorizontalPaddingClass} py-5 sm:py-8`}>
    <div className={`${appPageInnerClass} space-y-4`}>
      <header className="rounded-2xl border bg-card p-5"><a href="/" className="inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" aria-label="Ir para o início"><AppBrand /></a><div className="mt-5 flex min-w-0 items-center gap-2.5"><FilhoAvatar nome={painel.filho.nome} cor={painel.filho.cor} avatar={painel.filho.avatar === "menino" || painel.filho.avatar === "menina" ? painel.filho.avatar : null} className="h-8 w-8" /><h1 className="min-w-0 truncate text-2xl font-bold">Olá, {painel.filho.nome} 👋</h1></div><p className="mt-1 text-sm text-muted-foreground">Acompanhe aqui seus combinados. Este painel é somente para consulta.</p><p className="mt-2 break-words text-xs text-muted-foreground">Responsável: {painel.responsavel?.nome}</p></header>

      {vigenciaAtual ? (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Vigência atual</CardTitle>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  Em andamento
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{dataHora(vigenciaAtual.data_inicio)} até {dataHora(vigenciaAtual.data_fim)}</p>
            </CardContent>
          </Card>

          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
            <Card className="flex min-h-[88px] items-center justify-center">
              <div className="flex flex-col items-center justify-center gap-1 text-center">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                <p className="text-xl font-bold leading-none">{tarefasAtual.length}</p>
                <p className="text-[11px] leading-none text-muted-foreground">Tarefas</p>
              </div>
            </Card>
            <Card className="flex min-h-[88px] items-center justify-center">
              <div className="flex flex-col items-center justify-center gap-1 text-center">
                <ThumbsUp className="h-5 w-5 text-green-600" />
                <p className="text-xl font-bold leading-none">{qtdFez}</p>
                <p className="text-[11px] leading-none text-muted-foreground">Fez</p>
              </div>
            </Card>
            <Card className="flex min-h-[88px] items-center justify-center">
              <div className="flex flex-col items-center justify-center gap-1 text-center">
                <ThumbsDown className="h-5 w-5 text-red-500" />
                <p className="text-xl font-bold leading-none">{qtdNaoFez}</p>
                <p className="text-[11px] leading-none text-muted-foreground">Não fez</p>
              </div>
            </Card>
            <Card className="flex min-h-[88px] items-center justify-center">
              <div className="flex flex-col items-center justify-center gap-1 text-center">
                <Minus className="h-5 w-5 text-muted-foreground" />
                <p className="text-xl font-bold leading-none">{qtdNaoPrecisou}</p>
                <p className="text-[11px] leading-none text-muted-foreground">Não precisou</p>
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Minhas tarefas</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {tarefasAtual.map((t) => {
                const fezCount=t.ocorrencias.filter((o)=>o.tipo==="FEZ").length;
                const naoFezCount=t.ocorrencias.filter((o)=>o.tipo==="NAO_FEZ").length;
                const naoPrecisouCount=t.ocorrencias.filter((o)=>o.tipo==="NAO_PRECISOU").length;
                const temResultado=fezCount>0||naoFezCount>0||naoPrecisouCount>0;
                return <div key={t.id} className="flex min-w-0 flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"><span className="flex min-w-0 items-start gap-2"><TarefaIcone nome={t.nome} className="mt-0.5" /><span className="min-w-0 break-words text-sm font-medium">{t.nome}</span></span>{temResultado ? <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">{fezCount>0&&<span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">👍 {fezCount} Fez</span>}{naoFezCount>0&&<span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">👎 {naoFezCount} Não fez</span>}{naoPrecisouCount>0&&<span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">— {naoPrecisouCount} Não precisou</span>}<Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setTarefaDatas(t)}><CalendarDays className="h-3.5 w-3.5" /> Ver resultados</Button></div> : <span className="shrink-0 text-xs text-muted-foreground">Sem registros</span>}</div>;
              })}
              {tarefasAtual.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa atribuída nesta vigência.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CircleDollarSign className="h-4 w-4" />Resultado da vigência</CardTitle></CardHeader>
            <CardContent>
              {painel.filho.tem_mesada ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><span>Mesada</span><strong>{dinheiro(painel.filho.valor_mesada ?? 0)}</strong></div>
                  <div className="flex justify-between gap-3"><span>Quantidade de “Não fez”</span><strong>{qtdNaoFez}</strong></div>
                  <div className="flex justify-between gap-3"><span>Total de descontos aplicados</span><strong>{dinheiro(desconto)}</strong></div>
                  <div className="flex justify-between gap-3"><span>Penalidades pendentes</span><strong>{penalidadesPendentes}</strong></div>
                  <div className="flex justify-between gap-3 border-t pt-2"><span>Valor atual</span><strong>{dinheiro(mesadaFinal ?? 0)}</strong></div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><span>Quantidade de “Não fez”</span><strong>{qtdNaoFez}</strong></div>
                  <div className="flex justify-between gap-3"><span>Penalidades pendentes</span><strong>{penalidadesPendentes}</strong></div>
                </div>
              )}
            </CardContent>
          </Card>

          {vigenciasOrdenadas.length > 0 && <Card><CardHeader><CardTitle className="text-base">Vigências</CardTitle></CardHeader><CardContent className="space-y-2">{vigenciasOrdenadas.map((v) => { const s = status(v), fezV=v.tarefas.reduce((n,t)=>n+t.ocorrencias.filter((o)=>o.tipo==="FEZ").length,0), naoFezV=v.tarefas.reduce((n,t)=>n+t.ocorrencias.filter((o)=>o.tipo==="NAO_FEZ").length,0), naoPrecisouV=v.tarefas.reduce((n,t)=>n+t.ocorrencias.filter((o)=>o.tipo==="NAO_PRECISOU").length,0); return <div key={v.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="text-sm font-medium">{dataHora(v.data_inicio)} até {dataHora(v.data_fim)}</p><p className="mt-1 text-xs text-muted-foreground">{v.tarefas.length} tarefa(s) · 👍 {fezV} Fez · 👎 {naoFezV} Não fez · — {naoPrecisouV} Não precisou</p></div><span className="inline-flex shrink-0 items-center gap-1.5 text-xs"><span className={`h-2 w-2 rounded-full ${corStatus(s)}`} />{s}</span></div>; })}</CardContent></Card>}
        </div>
      ) : (
        <>
          <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Não há uma vigência em andamento neste momento.</p></CardContent></Card>
          {vigenciasOrdenadas.length > 0 && <Card><CardHeader><CardTitle className="text-base">Vigências</CardTitle></CardHeader><CardContent className="space-y-2">{vigenciasOrdenadas.map((v) => { const s = status(v), fezV=v.tarefas.reduce((n,t)=>n+t.ocorrencias.filter((o)=>o.tipo==="FEZ").length,0), naoFezV=v.tarefas.reduce((n,t)=>n+t.ocorrencias.filter((o)=>o.tipo==="NAO_FEZ").length,0), naoPrecisouV=v.tarefas.reduce((n,t)=>n+t.ocorrencias.filter((o)=>o.tipo==="NAO_PRECISOU").length,0); return <div key={v.id} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="text-sm font-medium">{dataHora(v.data_inicio)} até {dataHora(v.data_fim)}</p><p className="mt-1 text-xs text-muted-foreground">{v.tarefas.length} tarefa(s) · 👍 {fezV} Fez · 👎 {naoFezV} Não fez · — {naoPrecisouV} Não precisou</p></div><span className="inline-flex shrink-0 items-center gap-1.5 text-xs"><span className={`h-2 w-2 rounded-full ${corStatus(s)}`} />{s}</span></div>; })}</CardContent></Card>}
        </>
      )}

      <p className="flex items-center justify-center gap-1.5 pb-4 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />Atualizado {dataHora(painel.atualizado_em)}</p>
    </div>

    <Dialog open={tarefaDatas !== null} onOpenChange={(open) => { if (!open) setTarefaDatas(null); }}>
      <DialogContent className="max-w-sm rounded-lg">
        <DialogHeader>
          <DialogTitle>Resultados da tarefa</DialogTitle>
          <DialogDescription>
            {tarefaDatas && (
              <span className="flex min-w-0 items-start gap-2">
                <TarefaIcone nome={tarefaDatas.nome} className="mt-0.5" />
                <span className="min-w-0 break-words">{tarefaDatas.nome}</span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-2 overflow-y-auto py-1">{resultados.map((o, i) => { const rotulo=o.tipo==="FEZ"?"Fez":o.tipo==="NAO_FEZ"?"Não fez":"Não precisou"; return <div key={o.id ?? `${o.data}-${i}`} className="flex items-start gap-2 rounded-lg border px-3 py-2">{o.tipo==="FEZ"?<ThumbsUp className="mt-0.5 h-5 w-5 shrink-0 text-green-600"/>:o.tipo==="NAO_FEZ"?<ThumbsDown className="mt-0.5 h-5 w-5 shrink-0 text-red-500"/>:<Minus className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"/>}<div className="min-w-0"><p className="text-sm font-medium">{rotulo} · {data(o.data)}</p>{o.tipo==="NAO_FEZ"&&<ConsequenciaOcorrenciaResumo consequencia={o.consequencia} formatarMoeda={dinheiro} className="mt-1 text-xs text-muted-foreground" />}</div></div>; })}{resultados.length===0&&<p className="text-sm text-muted-foreground">Nenhum resultado registrado.</p>}</div>
      </DialogContent>
    </Dialog>
  </main>;
}
