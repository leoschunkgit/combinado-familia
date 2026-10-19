import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  House,
  Loader2,
  LogOut,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { situacaoVigencia } from "@/components/VigenciaStatus";
import { FilhoAvatar } from "@/components/FilhoAvatar";
import { TarefaIcone } from "@/components/TarefaIcone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  encerrarSessaoFilho,
  lerSessaoFilhoLocal,
  limparSessaoFilhoLocal,
  obterPainelFilhoApp,
  type OcorrenciaFilho,
  type PainelFilho,
  type TarefaFilho,
  type VigenciaFilho,
} from "@/lib/child-app-session";

const dataHora = (v: string) => new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date(v));

const data = (v: string) => new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
}).format(new Date(v));

const dinheiro = (v: number) => v.toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function status(v: VigenciaFilho) {
  const s = situacaoVigencia(v);
  return s === "andamento" ? "Em andamento" : s === "futura" ? "Irá começar" : "Finalizada";
}

const corStatus = (s: string) =>
  s === "Em andamento" ? "bg-green-400" : s === "Finalizada" ? "bg-red-300" : "bg-gray-300";

function bonus(o: OcorrenciaFilho) {
  if (o.tipo !== "FEZ") return null;
  if (o.bonificacao_tipo === "TEXTO" && o.bonificacao_descricao) return o.bonificacao_descricao;
  if (o.bonificacao_tipo === "VALOR" && o.bonificacao_valor !== null) return dinheiro(Number(o.bonificacao_valor));
  return "Sem bonificação";
}

export function PainelFilhoApp({
  painelInicial,
  onSair,
  onSessaoInvalida,
}: {
  painelInicial: PainelFilho;
  onSair: () => void;
  onSessaoInvalida: () => void;
}) {
  const [painel, setPainel] = useState(painelInicial);
  const [tarefaDatas, setTarefaDatas] = useState<TarefaFilho | null>(null);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function atualizar() {
      const token = await lerSessaoFilhoLocal();
      if (!token) {
        if (ativo) onSessaoInvalida();
        return;
      }

      try {
        const atual = await obterPainelFilhoApp(token);
        if (!ativo) return;

        if (!atual) {
          await limparSessaoFilhoLocal();
          onSessaoInvalida();
          return;
        }

        setPainel(atual);
      } catch {
        // Em falha temporária de rede, mantém o último painel já carregado.
      }
    }

    const atualizarAoVoltar = () => {
      if (document.visibilityState === "visible") void atualizar();
    };

    document.addEventListener("visibilitychange", atualizarAoVoltar);
    const timer = window.setInterval(() => void atualizar(), 60000);

    return () => {
      ativo = false;
      document.removeEventListener("visibilitychange", atualizarAoVoltar);
      window.clearInterval(timer);
    };
  }, [onSessaoInvalida]);

  const vigenciasOrdenadas = useMemo(() => [...painel.vigencias].sort((a, b) => {
    const ordem = (v: VigenciaFilho) => status(v) === "Em andamento" ? 0 : status(v) === "Irá começar" ? 1 : 2;
    const oa = ordem(a);
    const ob = ordem(b);
    if (oa !== ob) return oa - ob;

    const ia = new Date(a.data_inicio).getTime();
    const ib = new Date(b.data_inicio).getTime();
    return oa === 2 ? ib - ia : ia - ib;
  }), [painel]);

  const vigenciaAtual = useMemo(
    () => vigenciasOrdenadas.find((v) => status(v) === "Em andamento") ?? null,
    [vigenciasOrdenadas],
  );

  const tarefasAtual = vigenciaAtual?.tarefas ?? [];
  const qtdNaoFez = tarefasAtual.reduce(
    (n, t) => n + t.ocorrencias.filter((o) => o.tipo === "NAO_FEZ").length,
    0,
  );
  const qtdFez = tarefasAtual.reduce(
    (n, t) => n + t.ocorrencias.filter((o) => o.tipo === "FEZ").length,
    0,
  );
  const descontoUnitario = Number(vigenciaAtual?.valor_debito ?? 0);
  const desconto = painel.filho.tem_mesada
    ? Math.min(painel.filho.valor_mesada ?? 0, qtdNaoFez * descontoUnitario)
    : 0;
  const mesadaFinal = painel.filho.valor_mesada === null
    ? null
    : Math.max(0, painel.filho.valor_mesada - desconto);
  const resultados = tarefaDatas?.ocorrencias
    .filter((o) => o.tipo === "FEZ" || o.tipo === "NAO_FEZ")
    .sort((a, b) => +new Date(b.data) - +new Date(a.data)) ?? [];

  async function sair() {
    setSaindo(true);
    try {
      await encerrarSessaoFilho();
      onSair();
    } catch {
      toast.error("Não foi possível encerrar o acesso agora. Verifique sua conexão e tente novamente.");
    } finally {
      setSaindo(false);
    }
  }

  return (
    <main className="native-safe-area min-h-screen bg-muted/20 px-3 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <header className="rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-display text-lg font-bold">
              <House className="h-5 w-5" />
              Combinado <span className="text-sm font-medium text-muted-foreground">família</span>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => void sair()} disabled={saindo}>
              {saindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Sair
            </Button>
          </div>

          <div className="mt-5 flex min-w-0 items-center gap-2.5">
            <FilhoAvatar
              nome={painel.filho.nome}
              cor={painel.filho.cor}
              avatar={painel.filho.avatar === "menino" || painel.filho.avatar === "menina" ? painel.filho.avatar : null}
              className="h-8 w-8"
            />
            <h1 className="min-w-0 truncate text-2xl font-bold">Olá, {painel.filho.nome} 👋</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe aqui seus combinados. Esta área é somente para consulta.
          </p>
          <p className="mt-2 break-words text-xs text-muted-foreground">
            Responsável: {painel.responsavel?.nome}
          </p>
        </header>

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

            <div className="grid w-full grid-cols-3 gap-2">
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
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Minhas tarefas</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {tarefasAtual.map((t) => {
                  const fezCount = t.ocorrencias.filter((o) => o.tipo === "FEZ").length;
                  const naoFezCount = t.ocorrencias.filter((o) => o.tipo === "NAO_FEZ").length;
                  const temResultado = fezCount > 0 || naoFezCount > 0;

                  return (
                    <div key={t.id} className="flex min-w-0 flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="flex min-w-0 items-start gap-2">
                        <TarefaIcone nome={t.nome} className="mt-0.5" />
                        <span className="min-w-0 break-words text-sm font-medium">{t.nome}</span>
                      </span>

                      {temResultado ? (
                        <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
                          {fezCount > 0 && <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">👍 {fezCount} Fez</span>}
                          {naoFezCount > 0 && <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">👎 {naoFezCount} Não fez</span>}
                          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setTarefaDatas(t)}>
                            <CalendarDays className="h-3.5 w-3.5" />
                            Ver resultados
                          </Button>
                        </div>
                      ) : (
                        <span className="shrink-0 text-xs text-muted-foreground">Sem registros</span>
                      )}
                    </div>
                  );
                })}
                {tarefasAtual.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa atribuída nesta vigência.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CircleDollarSign className="h-4 w-4" />
                  Resultado da vigência
                </CardTitle>
              </CardHeader>
              <CardContent>
                {painel.filho.tem_mesada ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3"><span>Mesada</span><strong>{dinheiro(painel.filho.valor_mesada ?? 0)}</strong></div>
                    <div className="flex justify-between gap-3"><span>Desconto por cada “Não fez”</span><strong>{dinheiro(descontoUnitario)}</strong></div>
                    <div className="flex justify-between gap-3"><span>Quantidade de “Não fez”</span><strong>{qtdNaoFez}</strong></div>
                    <div className="flex justify-between gap-3"><span>Total de descontos</span><strong>{dinheiro(desconto)}</strong></div>
                    <div className="flex justify-between gap-3 border-t pt-2"><span>Valor atual</span><strong>{dinheiro(mesadaFinal ?? 0)}</strong></div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <p><span className="text-muted-foreground">Penalidade:</span> <strong>{vigenciaAtual.penalidade || "—"}</strong></p>
                    <p><span className="text-muted-foreground">Quantidade de “Não fez” para ser penalizado:</span> <strong>{vigenciaAtual.qtd_ocorrencia}</strong></p>
                    <p><span className="text-muted-foreground">Quantidade atual:</span> <strong>{qtdNaoFez}</strong></p>
                    {vigenciaAtual.qtd_ocorrencia > 0 && qtdNaoFez >= vigenciaAtual.qtd_ocorrencia && (
                      <p className="rounded-lg border border-red-200 p-2 text-xs font-medium text-red-700">Limite atingido</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Não há uma vigência em andamento neste momento.</p>
            </CardContent>
          </Card>
        )}

        {vigenciasOrdenadas.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Vigências</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {vigenciasOrdenadas.map((v) => {
                const s = status(v);
                const fezV = v.tarefas.reduce((n, t) => n + t.ocorrencias.filter((o) => o.tipo === "FEZ").length, 0);
                const naoFezV = v.tarefas.reduce((n, t) => n + t.ocorrencias.filter((o) => o.tipo === "NAO_FEZ").length, 0);

                return (
                  <div key={v.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{dataHora(v.data_inicio)} até {dataHora(v.data_fim)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {v.tarefas.length} tarefa(s) · 👍 {fezV} Fez · 👎 {naoFezV} Não fez
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs">
                      <span className={`h-2 w-2 rounded-full ${corStatus(s)}`} />
                      {s}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <p className="flex items-center justify-center gap-1.5 pb-4 text-xs text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
          Atualizado {dataHora(painel.atualizado_em)}
        </p>
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

          <div className="max-h-[55vh] space-y-2 overflow-y-auto py-1">
            {resultados.map((o, i) => {
              const b = bonus(o);
              return (
                <div key={`${o.data}-${i}`} className="flex items-start gap-2 rounded-lg border px-3 py-2">
                  {o.tipo === "FEZ"
                    ? <ThumbsUp className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                    : <ThumbsDown className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{o.tipo === "FEZ" ? "Fez" : "Não fez"} · {data(o.data)}</p>
                    {b && <p className="mt-1 break-words text-xs text-muted-foreground">Bonificação: {b}</p>}
                  </div>
                </div>
              );
            })}
            {resultados.length === 0 && <p className="text-sm text-muted-foreground">Nenhum resultado registrado.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
