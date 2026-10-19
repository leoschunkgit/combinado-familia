import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BellRing,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Gift,
  History,
  House,
  Loader2,
  LogOut,
  Send,
  Star,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { situacaoVigencia } from "@/components/VigenciaStatus";
import { FilhoAvatar } from "@/components/FilhoAvatar";
import { TarefaIcone } from "@/components/TarefaIcone";
import { FilhoEstrelasPage } from "@/components/FilhoEstrelasPage";
import { AppBrand } from "@/components/AppBrand";
import { AppFilhoPushNotifications } from "@/components/AppFilhoPushNotifications";
import { AppPageContent, appPageHorizontalPaddingClass, appPageInnerClass } from "@/components/AppPageContent";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  avisarTarefaConcluida,
  encerrarSessaoFilho,
  lerSessaoFilhoLocal,
  limparSessaoFilhoLocal,
  obterPainelFilhoApp,
  type OcorrenciaFilho,
  type PainelFilho,
  type TarefaFilho,
  type VigenciaFilho,
} from "@/lib/child-app-session";

type AbaFilho = "inicio" | "tarefas" | "registros" | "estrelas" | "historico";

const ABAS: Array<{ id: Exclude<AbaFilho, "historico">; label: string; icon: typeof House }> = [
  { id: "inicio", label: "Início", icon: House },
  { id: "tarefas", label: "Tarefas", icon: ClipboardList },
  { id: "registros", label: "Fez / Não", icon: ClipboardCheck },
  { id: "estrelas", label: "Estrelas", icon: Star },
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

const dataSaoPaulo = (v = new Date()) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(v);

function status(v: VigenciaFilho) {
  const s = situacaoVigencia(v);
  return s === "andamento" ? "Em andamento" : s === "futura" ? "Irá começar" : "Finalizada";
}

function bonus(o: OcorrenciaFilho) {
  if (o.tipo !== "FEZ") return null;
  if (o.bonificacao_tipo === "TEXTO" && o.bonificacao_descricao) return o.bonificacao_descricao;
  if (o.bonificacao_tipo === "VALOR" && o.bonificacao_valor !== null) return dinheiro(Number(o.bonificacao_valor));
  return null;
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
  const [menuAberto, setMenuAberto] = useState(false);
  const [tarefaDatas, setTarefaDatas] = useState<TarefaFilho | null>(null);
  const [resultadoAberto, setResultadoAberto] = useState(false);
  const [tarefasAbertas, setTarefasAbertas] = useState(true);
  const [registroAberto, setRegistroAberto] = useState<string | null>(null);
  const [historicoAbertoId, setHistoricoAbertoId] = useState<number | null>(null);
  const [saindo, setSaindo] = useState(false);
  const [avisoTarefa, setAvisoTarefa] = useState<TarefaFilho | null>(null);
  const [observacaoAviso, setObservacaoAviso] = useState("");
  const [enviandoAviso, setEnviandoAviso] = useState(false);
  const abrirInicioPeloPush = useCallback(() => setAba("inicio"), []);

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

  const estrelas = painel.estrelas ?? {
    hoje: 0,
    vigencia_atual: qtdFez,
    saldo: qtdFez,
    total_conquistado: qtdFez,
    recompensas: [],
    resgates: [],
  };

  const proximaRecompensa = useMemo(
    () => [...estrelas.recompensas].sort((a, b) => a.estrelas_necessarias - b.estrelas_necessarias)[0] ?? null,
    [estrelas.recompensas],
  );

  const progressoProximaRecompensa = proximaRecompensa
    ? Math.min(100, Math.max(0, (estrelas.saldo / proximaRecompensa.estrelas_necessarias) * 100))
    : 0;

  const registrosAtuais = useMemo(
    () => tarefasAtual
      .flatMap((tarefa) => tarefa.ocorrencias
        .filter((o) => o.tipo === "FEZ" || o.tipo === "NAO_FEZ")
        .map((ocorrencia) => ({ tarefa, ocorrencia })))
      .sort((a, b) => +new Date(b.ocorrencia.data) - +new Date(a.ocorrencia.data)),
    [tarefasAtual],
  );

  const registrosPorData = useMemo(() => {
    const grupos: Array<{
      data: string;
      itens: Array<{ tarefa: TarefaFilho; ocorrencia: OcorrenciaFilho }>;
    }> = [];

    registrosAtuais.forEach((item) => {
      const rotulo = data(item.ocorrencia.data);
      const ultimo = grupos[grupos.length - 1];

      if (ultimo?.data === rotulo) {
        ultimo.itens.push(item);
      } else {
        grupos.push({ data: rotulo, itens: [item] });
      }
    });

    return grupos;
  }, [registrosAtuais]);

  useEffect(() => {
    if (registrosPorData.length === 0) {
      setRegistroAberto(null);
      return;
    }

    if (!registroAberto || !registrosPorData.some((grupo) => grupo.data === registroAberto)) {
      setRegistroAberto(registrosPorData[0].data);
    }
  }, [registrosPorData, registroAberto]);

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

  async function enviarAvisoTarefa() {
    if (!avisoTarefa || enviandoAviso) return;

    setEnviandoAviso(true);
    try {
      const resposta = await avisarTarefaConcluida(avisoTarefa.id, observacaoAviso);
      const token = await lerSessaoFilhoLocal();

      if (token) {
        const atual = await obterPainelFilhoApp(token);
        if (atual) setPainel(atual);
      }

      setAvisoTarefa(null);
      setObservacaoAviso("");

      toast.success(
        resposta.ja_existia
          ? "Você já avisou o responsável sobre esta tarefa hoje."
          : "Aviso enviado ao responsável.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o aviso.",
      );
    } finally {
      setEnviandoAviso(false);
    }
  }

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
    <div className="rounded-2xl border border-dashed bg-card p-5 text-center">
      <Clock3 className="mx-auto h-5 w-5 text-muted-foreground" />
      <p className="mt-2 text-sm font-medium">Nenhum combinado em andamento agora.</p>
      <p className="mt-1 text-xs text-muted-foreground">Quando começar uma nova vigência, ela aparece aqui.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/20">
      <AppFilhoPushNotifications onAbrir={abrirInicioPeloPush} />
      <header className="native-sticky-safe-top sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className={`${appPageHorizontalPaddingClass} py-2.5`}>
          <div className={`${appPageInnerClass} grid grid-cols-[1fr_auto_1fr] items-center gap-2`}>
          <span aria-hidden="true" />
          <button
            type="button"
            onClick={() => setAba("inicio")}
            className="min-w-0 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label="Ir para o início"
          >
            <AppBrand />
          </button>

          <div className="flex items-center justify-self-end gap-2">
            <button
              type="button"
              onClick={() => setAba("estrelas")}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 transition-transform active:scale-95"
              aria-label="Abrir estrelas"
            >
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
              {estrelas.saldo}
            </button>

            <button
              type="button"
              className="flex items-center gap-2 rounded-full p-0.5 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              onClick={() => setMenuAberto(true)}
              aria-label="Abrir perfil"
            >
              <FilhoAvatar
                nome={painel.filho.nome}
                cor={painel.filho.cor}
                avatar={painel.filho.avatar === "menino" || painel.filho.avatar === "menina" ? painel.filho.avatar : null}
                className="h-9 w-9"
              />
            </button>
          </div>
          </div>
        </div>
      </header>

      <Dialog open={menuAberto} onOpenChange={setMenuAberto}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Meu perfil</DialogTitle>
            <DialogDescription>Atalhos e acesso do filho.</DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border bg-muted/20 p-4">
            <div className="flex items-center gap-3">
              <FilhoAvatar
                nome={painel.filho.nome}
                cor={painel.filho.cor}
                avatar={painel.filho.avatar === "menino" || painel.filho.avatar === "menina" ? painel.filho.avatar : null}
                className="h-12 w-12"
              />
              <div className="min-w-0">
                <p className="truncate font-semibold">{painel.filho.nome}</p>
                <p className="truncate text-xs text-muted-foreground">Responsável: {painel.responsavel?.nome}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between"
              onClick={() => {
                setAba("historico");
                setMenuAberto(false);
              }}
            >
              <span className="flex items-center gap-2"><History className="h-4 w-4" /> Histórico</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full justify-center"
              onClick={() => void sair()}
              disabled={saindo}
            >
              {saindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Sair
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AppPageContent className="pb-24 md:pb-28">
        {aba === "inicio" && (
          <div className="space-y-4">
            <section
              className="relative overflow-hidden rounded-3xl border border-t-4 bg-card p-4 sm:p-5"
              style={{ borderTopColor: painel.filho.cor?.trim() || "var(--primary)" }}
            >
              <div className="flex items-start gap-3">
                <FilhoAvatar
                  nome={painel.filho.nome}
                  cor={painel.filho.cor}
                  avatar={painel.filho.avatar === "menino" || painel.filho.avatar === "menina" ? painel.filho.avatar : null}
                  className="h-12 w-12"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seu painel</p>
                  <h1 className="mt-0.5 truncate text-2xl font-bold">Oi, {painel.filho.nome}!</h1>
                  <p className="mt-1 text-sm text-muted-foreground">Seus combinados em um só lugar.</p>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setAba("registros")} className="rounded-2xl border border-green-200 bg-green-50 p-3 text-left transition-transform active:scale-[0.98]">
                <ThumbsUp className="h-5 w-5 text-green-700" />
                <p className="mt-2 text-2xl font-bold leading-none text-green-800 tabular-nums">{qtdFez}</p>
                <p className="mt-1 text-[11px] font-semibold text-green-700">Fez</p>
              </button>
              <button type="button" onClick={() => setAba("registros")} className="rounded-2xl border border-red-200 bg-red-50 p-3 text-left transition-transform active:scale-[0.98]">
                <ThumbsDown className="h-5 w-5 text-red-600" />
                <p className="mt-2 text-2xl font-bold leading-none text-red-700 tabular-nums">{qtdNaoFez}</p>
                <p className="mt-1 text-[11px] font-semibold text-red-600">Não fez</p>
              </button>
              <button type="button" onClick={() => setAba("tarefas")} className="rounded-2xl border bg-card p-3 text-left transition-transform active:scale-[0.98]">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                <p className="mt-2 text-2xl font-bold leading-none tabular-nums">{tarefasAtual.length}</p>
                <p className="mt-1 text-[11px] font-semibold text-muted-foreground">Tarefas</p>
              </button>
            </div>

            {proximaRecompensa && (
              <button type="button" onClick={() => setAba("estrelas")} className="w-full rounded-2xl border bg-card p-4 text-left transition-transform active:scale-[0.99]">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                    <Gift className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Próxima recompensa</p>
                        <p className="mt-0.5 break-words text-sm font-semibold">{proximaRecompensa.nome}</p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                        {proximaRecompensa.estrelas_necessarias}
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progressoProximaRecompensa}%` }} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                      <span>{estrelas.saldo} de {proximaRecompensa.estrelas_necessarias}</span>
                      <span className="inline-flex items-center gap-1 font-medium text-foreground">Ver recompensas <ChevronRight className="h-3 w-3" /></span>
                    </div>
                  </div>
                </div>
              </button>
            )}

            {vigenciaAtual ? (
              <>
                <section className="rounded-2xl border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Combinado atual</p>
                      <p className="mt-1 text-sm font-medium">{data(vigenciaAtual.data_inicio)} até {data(vigenciaAtual.data_fim)}</p>
                    </div>
                    <Badge className="h-5 shrink-0 border-green-200 bg-green-100 px-1.5 py-0 text-[10px] font-semibold text-green-700">Em andamento</Badge>
                  </div>
                </section>

                <CollapsibleSection
                  title="Meu combinado"
                  description={painel.filho.tem_mesada
                    ? `Valor atual: ${dinheiro(mesadaFinal ?? 0)}`
                    : `${qtdNaoFez} de ${vigenciaAtual.qtd_ocorrencia} Não fez`}
                  open={resultadoAberto}
                  onOpenChange={setResultadoAberto}
                >
                  <div className="px-4 py-4 sm:px-5">
                    {painel.filho.tem_mesada ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Mesada</span><strong>{dinheiro(painel.filho.valor_mesada ?? 0)}</strong></div>
                        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Desconto por Não fez</span><strong>{dinheiro(descontoUnitario)}</strong></div>
                        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Não fez</span><strong>{qtdNaoFez}</strong></div>
                        <div className="flex justify-between gap-3 border-t pt-2"><span>Valor atual</span><strong>{dinheiro(mesadaFinal ?? 0)}</strong></div>
                      </div>
                    ) : (
                      <div className="space-y-2 text-sm">
                        <p><span className="text-muted-foreground">Penalidade:</span> <strong>{vigenciaAtual.penalidade || "—"}</strong></p>
                        <p><span className="text-muted-foreground">Limite:</span> <strong>{vigenciaAtual.qtd_ocorrencia} Não fez</strong></p>
                        <p><span className="text-muted-foreground">Atual:</span> <strong>{qtdNaoFez} Não fez</strong></p>
                        {vigenciaAtual.qtd_ocorrencia > 0 && qtdNaoFez >= vigenciaAtual.qtd_ocorrencia && <Badge variant="destructive">Limite atingido</Badge>}
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              </>
            ) : <SemVigencia />}
          </div>
        )}

        {aba === "tarefas" && (
          <div>
            <PageHeader
              title="Tarefas"
              description="O que está combinado com você agora."
              icon={<ClipboardList className="h-6 w-6" />}
            />

            {vigenciaAtual ? (
              <CollapsibleSection
                title="Tarefas atuais"
                count={tarefasAtual.length}
                open={tarefasAbertas}
                onOpenChange={setTarefasAbertas}
              >
                <div className="space-y-2 p-4 sm:p-5">
                  {tarefasAtual.map((t) => {
                    const fezCount = t.ocorrencias.filter((o) => o.tipo === "FEZ").length;
                    const naoFezCount = t.ocorrencias.filter((o) => o.tipo === "NAO_FEZ").length;
                    const temResultado = fezCount > 0 || naoFezCount > 0;
                    const hoje = dataSaoPaulo();
                    const registroHoje = t.ocorrencias.find(
                      (o) => dataSaoPaulo(new Date(o.data)) === hoje,
                    );
                    const solicitacaoHoje = (painel.solicitacoes_hoje ?? []).find(
                      (s) => s.id_filho_tarefa === t.id && s.data_referencia === hoje,
                    );

                    return (
                      <div key={t.id} className="flex min-w-0 flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                        <span className="flex min-w-0 items-start gap-2">
                          <TarefaIcone nome={t.nome} className="mt-0.5" />
                          <span className="min-w-0 break-words text-sm font-medium">{t.nome}</span>
                        </span>

                        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
                          {fezCount > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700"><ThumbsUp className="h-3 w-3" /> {fezCount} Fez</span>}
                          {naoFezCount > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700"><ThumbsDown className="h-3 w-3" /> {naoFezCount} Não fez</span>}

                          {!registroHoje && solicitacaoHoje && (
                            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                              <BellRing className="h-3.5 w-3.5 shrink-0" />
                              Aguardando confirmação
                            </span>
                          )}

                          {!registroHoje && !solicitacaoHoje && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => {
                                setObservacaoAviso("");
                                setAvisoTarefa(t);
                              }}
                            >
                              <Send className="h-3.5 w-3.5" />
                              Avisei que terminei
                            </Button>
                          )}

                          {temResultado && (
                            <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setTarefaDatas(t)}>
                              <CalendarDays className="h-3.5 w-3.5" /> Ver resultados
                            </Button>
                          )}

                          {!registroHoje && solicitacaoHoje?.observacao && (
                            <span className="basis-full break-words text-right text-[11px] text-muted-foreground">
                              “{solicitacaoHoje.observacao}”
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {tarefasAtual.length === 0 && <EmptyState>Nenhuma tarefa atribuída nesta vigência.</EmptyState>}
                </div>
              </CollapsibleSection>
            ) : <SemVigencia />}
          </div>
        )}

        {aba === "registros" && (
          <div>
            <PageHeader
              title="Fez / Não fez"
              description="Seus registros do combinado atual."
              icon={<ClipboardCheck className="h-6 w-6" />}
            />

            {vigenciaAtual ? (
              registrosPorData.length > 0 ? (
                <div className="space-y-3">
                  {registrosPorData.map((grupo) => (
                    <CollapsibleSection
                      key={grupo.data}
                      title={grupo.data}
                      count={grupo.itens.length}
                      open={registroAberto === grupo.data}
                      onOpenChange={(open) => setRegistroAberto(open ? grupo.data : null)}
                    >
                      <div className="divide-y">
                        {grupo.itens.map(({ tarefa, ocorrencia }, i) => {
                          const b = bonus(ocorrencia);
                          return (
                            <div key={`${tarefa.id}-${ocorrencia.data}-${i}`} className="flex min-w-0 items-start gap-3 px-4 py-3.5 sm:px-5">
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ocorrencia.tipo === "FEZ" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                                {ocorrencia.tipo === "FEZ" ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-start gap-2">
                                  <TarefaIcone nome={tarefa.nome} className="mt-0.5" />
                                  <p className="min-w-0 break-words text-sm font-semibold">{tarefa.nome}</p>
                                </div>
                                <p className={`mt-1 text-xs font-medium ${ocorrencia.tipo === "FEZ" ? "text-green-700" : "text-red-600"}`}>
                                  {ocorrencia.tipo === "FEZ" ? "Fez" : "Não fez"}
                                </p>
                                {ocorrencia.tipo === "FEZ" && (
                                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-600">
                                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" /> +1 estrela
                                  </p>
                                )}
                                {b && <p className="mt-1 break-words text-xs text-muted-foreground">Recompensa extra: {b}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleSection>
                  ))}
                </div>
              ) : <EmptyState>Nenhum registro de Fez / Não fez nesta vigência.</EmptyState>
            ) : <SemVigencia />}

            <Button type="button" variant="outline" className="mt-4 w-full justify-between" onClick={() => setAba("historico")}>
              <span className="flex items-center gap-2"><History className="h-4 w-4" /> Ver histórico completo</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        )}

        {aba === "estrelas" && <FilhoEstrelasPage estrelas={estrelas} />}

        {aba === "historico" && (
          <div>
            <PageHeader
              title="Histórico"
              description="Resultados das vigências encerradas."
              icon={<History className="h-6 w-6" />}
            />

            {vigenciasFinalizadas.length > 0 ? (
              <div className="space-y-3">
                {vigenciasFinalizadas.map((v) => {
                  const fezV = v.tarefas.reduce((n, t) => n + t.ocorrencias.filter((o) => o.tipo === "FEZ").length, 0);
                  const naoFezV = v.tarefas.reduce((n, t) => n + t.ocorrencias.filter((o) => o.tipo === "NAO_FEZ").length, 0);

                  return (
                    <CollapsibleSection
                      key={v.id}
                      title={`${data(v.data_inicio)} até ${data(v.data_fim)}`}
                      description={`${fezV} Fez · ${naoFezV} Não fez`}
                      count={v.tarefas.length}
                      open={historicoAbertoId === v.id}
                      onOpenChange={(open) => setHistoricoAbertoId(open ? v.id : null)}
                    >
                      <div className="divide-y">
                        {v.tarefas.map((tarefa) => {
                          const fez = tarefa.ocorrencias.filter((o) => o.tipo === "FEZ").length;
                          const naoFez = tarefa.ocorrencias.filter((o) => o.tipo === "NAO_FEZ").length;
                          return (
                            <div key={tarefa.id} className="flex min-w-0 items-start justify-between gap-3 px-4 py-3.5 text-xs sm:px-5">
                              <span className="flex min-w-0 items-start gap-1.5">
                                <TarefaIcone nome={tarefa.nome} className="mt-0.5" />
                                <span className="min-w-0 break-words">{tarefa.nome}</span>
                              </span>
                              <span className="shrink-0 text-muted-foreground">{fez} Fez · {naoFez} Não fez</span>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleSection>
                  );
                })}
              </div>
            ) : <EmptyState>Ainda não há vigências finalizadas no seu histórico.</EmptyState>}
          </div>
        )}

        {aba === "inicio" && (
          <p className="flex items-center justify-center gap-1.5 pb-2 pt-3 text-[11px] text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            Atualizado {dataHora(painel.atualizado_em)}
          </p>
        )}
      </AppPageContent>

      <nav
        aria-label="Navegação principal do filho"
        className="native-safe-bottom fixed bottom-0 left-1/2 z-40 w-[calc(100%-3rem)] max-w-[22rem] -translate-x-1/2 pb-2"
      >
        <div className="grid grid-cols-4 gap-0.5 rounded-2xl border bg-background/95 p-1 shadow-lg backdrop-blur">
          {ABAS.map(({ id, label, icon: Icon }) => {
            const ativo = aba === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setAba(id)}
                aria-current={ativo ? "page" : undefined}
                className={`flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[9px] font-semibold transition-all active:scale-95 ${ativo ? "bg-muted/60 text-foreground" : "text-muted-foreground"}`}
                style={ativo ? { boxShadow: `inset 0 2px 0 ${painel.filho.cor?.trim() || "var(--primary)"}` } : undefined}
              >
                <Icon
                  className={`h-4.5 w-4.5 ${id === "estrelas" && ativo ? "fill-amber-400 text-amber-500" : ""}`}
                  style={ativo && id !== "estrelas" ? { color: painel.filho.cor?.trim() || "var(--primary)" } : undefined}
                />
                <span className="max-w-full truncate leading-tight">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <Dialog
        open={avisoTarefa !== null}
        onOpenChange={(open) => {
          if (!open && !enviandoAviso) {
            setAvisoTarefa(null);
            setObservacaoAviso("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Avisar que terminei</DialogTitle>
            <DialogDescription>
              {avisoTarefa
                ? `Avise seu responsável que você terminou “${avisoTarefa.nome}”. A marcação de Fez / Não fez continua sendo feita pelo responsável.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="observacao-aviso-filho">Observação opcional</Label>
            <Textarea
              id="observacao-aviso-filho"
              value={observacaoAviso}
              onChange={(event) => setObservacaoAviso(event.target.value.slice(0, 120))}
              maxLength={120}
              placeholder="Ex.: Pode conferir meu quarto."
              disabled={enviandoAviso}
              className="min-h-24 resize-none"
            />
            <p className="text-right text-[11px] text-muted-foreground">
              {observacaoAviso.length}/120
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAvisoTarefa(null);
                setObservacaoAviso("");
              }}
              disabled={enviandoAviso}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void enviarAvisoTarefa()}
              disabled={enviandoAviso}
            >
              {enviandoAviso
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
              Enviar aviso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    {o.tipo === "FEZ" && <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-700"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" /> +1 estrela</p>}
                    {b && <p className="mt-1 break-words text-xs text-muted-foreground">Recompensa extra: {b}</p>}
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
