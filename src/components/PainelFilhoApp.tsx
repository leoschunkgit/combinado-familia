import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  History,
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

type AbaFilho = "inicio" | "tarefas" | "registros" | "historico";

const ABAS: Array<{ id: AbaFilho; label: string; icon: typeof House }> = [
  { id: "inicio", label: "Início", icon: House },
  { id: "tarefas", label: "Tarefas", icon: ClipboardList },
  { id: "registros", label: "Fez / Não fez", icon: ClipboardCheck },
  { id: "historico", label: "Histórico", icon: History },
];

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
  const [aba, setAba] = useState<AbaFilho>("inicio");
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

  const vigenciasFinalizadas = useMemo(
    () => vigenciasOrdenadas.filter((v) => status(v) === "Finalizada"),
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

  const registrosAtuais = useMemo(
    () => tarefasAtual
      .flatMap((tarefa) => tarefa.ocorrencias
        .filter((o) => o.tipo === "FEZ" || o.tipo === "NAO_FEZ")
        .map((ocorrencia) => ({ tarefa, ocorrencia })))
      .sort((a, b) => +new Date(b.ocorrencia.data) - +new Date(a.ocorrencia.data)),
    [tarefasAtual],
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

  const SemVigencia = () => (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">Não há uma vigência em andamento neste momento.</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="native-sticky-safe-top sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6">
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <House className="h-[18px] w-[18px]" />
            </span>
            <span className="flex flex-col items-start leading-none">
              <span className="font-display text-lg font-bold sm:text-xl">Combinado</span>
              <span className="-mt-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground sm:text-[11px]">família</span>
            </span>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <FilhoAvatar
                nome={painel.filho.nome}
                cor={painel.filho.cor}
                avatar={painel.filho.avatar === "menino" || painel.filho.avatar === "menina" ? painel.filho.avatar : null}
                className="h-8 w-8 shrink-0"
              />
              <span className="hidden max-w-40 truncate text-sm font-semibold sm:block">{painel.filho.nome}</span>
            </div>
            <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 px-2.5 text-xs" onClick={() => void sair()} disabled={saindo}>
              {saindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
              Sair
            </Button>
          </div>
        </div>

        <nav aria-label="Navegação do filho" className="border-t bg-background">
          <div className="mx-auto flex w-full max-w-6xl overflow-x-auto px-3 sm:px-6">
            {ABAS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setAba(id)}
                aria-current={aba === id ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                  aba === id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="native-safe-area mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
        {aba === "inicio" && (
          <div className="space-y-4">
            <section className="rounded-2xl border bg-card p-4 sm:p-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <FilhoAvatar
                  nome={painel.filho.nome}
                  cor={painel.filho.cor}
                  avatar={painel.filho.avatar === "menino" || painel.filho.avatar === "menina" ? painel.filho.avatar : null}
                  className="h-9 w-9"
                />
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-bold sm:text-2xl">Olá, {painel.filho.nome}</h1>
                  <p className="text-sm text-muted-foreground">Acompanhe seus combinados. Esta área é somente para consulta.</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Responsável: {painel.responsavel?.nome}</p>
            </section>

            {vigenciaAtual ? (
              <>
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
              </>
            ) : <SemVigencia />}
          </div>
        )}

        {aba === "tarefas" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold">Tarefas</h1>
              <p className="mt-1 text-sm text-muted-foreground">Tarefas atribuídas a você na vigência atual.</p>
            </div>

            {vigenciaAtual ? (
              <Card>
                <CardContent className="space-y-2 pt-6">
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
            ) : <SemVigencia />}
          </div>
        )}

        {aba === "registros" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold">Fez / Não fez</h1>
              <p className="mt-1 text-sm text-muted-foreground">Registros da sua vigência atual, somente para consulta.</p>
            </div>

            {vigenciaAtual ? (
              <Card>
                <CardContent className="space-y-2 pt-6">
                  {registrosAtuais.map(({ tarefa, ocorrencia }, i) => {
                    const b = bonus(ocorrencia);
                    return (
                      <div key={`${tarefa.id}-${ocorrencia.data}-${i}`} className="flex min-w-0 items-start gap-3 rounded-xl border p-3">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          ocorrencia.tipo === "FEZ" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                        }`}>
                          {ocorrencia.tipo === "FEZ" ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-start gap-2">
                            <TarefaIcone nome={tarefa.nome} className="mt-0.5" />
                            <p className="min-w-0 break-words text-sm font-semibold">{tarefa.nome}</p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {ocorrencia.tipo === "FEZ" ? "Fez" : "Não fez"} · {data(ocorrencia.data)}
                          </p>
                          {b && <p className="mt-1 break-words text-xs text-muted-foreground">Bonificação: {b}</p>}
                        </div>
                      </div>
                    );
                  })}
                  {registrosAtuais.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro de Fez / Não fez nesta vigência.</p>}
                </CardContent>
              </Card>
            ) : <SemVigencia />}
          </div>
        )}

        {aba === "historico" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold">Histórico</h1>
              <p className="mt-1 text-sm text-muted-foreground">Vigências finalizadas e seus resultados.</p>
            </div>

            {vigenciasFinalizadas.length > 0 ? (
              <Card>
                <CardContent className="space-y-2 pt-6">
                  {vigenciasFinalizadas.map((v) => {
                    const fezV = v.tarefas.reduce((n, t) => n + t.ocorrencias.filter((o) => o.tipo === "FEZ").length, 0);
                    const naoFezV = v.tarefas.reduce((n, t) => n + t.ocorrencias.filter((o) => o.tipo === "NAO_FEZ").length, 0);

                    return (
                      <div key={v.id} className="rounded-xl border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{dataHora(v.data_inicio)} até {dataHora(v.data_fim)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {v.tarefas.length} tarefa(s) · {fezV} Fez · {naoFezV} Não fez
                            </p>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs">
                            <span className={`h-2 w-2 rounded-full ${corStatus(status(v))}`} />
                            Finalizada
                          </span>
                        </div>

                        <div className="mt-3 space-y-1.5 border-t pt-3">
                          {v.tarefas.map((tarefa) => {
                            const fez = tarefa.ocorrencias.filter((o) => o.tipo === "FEZ").length;
                            const naoFez = tarefa.ocorrencias.filter((o) => o.tipo === "NAO_FEZ").length;
                            return (
                              <div key={tarefa.id} className="flex min-w-0 items-start justify-between gap-3 text-xs">
                                <span className="flex min-w-0 items-start gap-1.5">
                                  <TarefaIcone nome={tarefa.nome} className="mt-0.5" />
                                  <span className="min-w-0 break-words">{tarefa.nome}</span>
                                </span>
                                <span className="shrink-0 text-muted-foreground">{fez} Fez · {naoFez} Não fez</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Ainda não há vigências finalizadas no seu histórico.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <p className="flex items-center justify-center gap-1.5 pb-4 pt-5 text-xs text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
          Atualizado {dataHora(painel.atualizado_em)}
        </p>
      </main>

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
    </div>
  );
}
