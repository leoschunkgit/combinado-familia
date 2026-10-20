import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Clock3,
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
import { FilhoTarefaItem } from "@/components/FilhoTarefaItem";
import { FilhoAppPageHeader } from "@/components/FilhoAppPageHeader";
import { TarefaIcone } from "@/components/TarefaIcone";
import { FilhoEstrelasPage } from "@/components/FilhoEstrelasPage";
import { AppBrand } from "@/components/AppBrand";
import { AppFilhoPushNotifications } from "@/components/AppFilhoPushNotifications";
import { AppPageContent, appPageHorizontalPaddingClass, appPageInnerClass } from "@/components/AppPageContent";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { EmptyState } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  avisarTarefaConcluida,
  pedirRevisaoTarefa,
  encerrarSessaoFilho,
  lerSessaoFilhoLocal,
  limparSessaoFilhoLocal,
  obterPainelFilhoApp,
  type OcorrenciaFilho,
  type PainelFilho,
  type TarefaFilho,
  type VigenciaFilho,
} from "@/lib/child-app-session";

type AbaFilho = "inicio" | "tarefas" | "registros" | "estrelas";

const ABAS: Array<{ id: AbaFilho; label: string; icon: typeof House }> = [
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

const formatarDataHoje = (valor: string) => {
  const formatada = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${valor}T12:00:00-03:00`));

  return formatada.charAt(0).toUpperCase() + formatada.slice(1);
};

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
  const [registroAberto, setRegistroAberto] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);
  const [avisoTarefa, setAvisoTarefa] = useState<TarefaFilho | null>(null);
  const [revisaoTarefa, setRevisaoTarefa] = useState<TarefaFilho | null>(null);
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

  const tarefasAtual = vigenciaAtual?.tarefas ?? [];
  const hoje = dataSaoPaulo();

  const registroHoje = (tarefa: TarefaFilho) =>
    tarefa.ocorrencias.find((o) => dataSaoPaulo(new Date(o.data)) === hoje);

  const solicitacaoHoje = (tarefa: TarefaFilho) =>
    (painel.solicitacoes_hoje ?? []).find(
      (s) => s.id_filho_tarefa === tarefa.id && s.data_referencia === hoje,
    );

  const revisaoHoje = (tarefa: TarefaFilho) =>
    (painel.revisoes_hoje ?? []).find(
      (r) => r.id_filho_tarefa === tarefa.id && r.data_referencia === hoje,
    );

  const tarefasResolvidasHoje = tarefasAtual.filter((tarefa) => Boolean(registroHoje(tarefa))).length;
  const tarefasAguardandoHoje = tarefasAtual.filter((tarefa) => {
    const registro = registroHoje(tarefa);
    const solicitacao = solicitacaoHoje(tarefa);
    const revisao = revisaoHoje(tarefa);
    return (
      (!registro && solicitacao?.status === "PENDENTE") ||
      (registro?.tipo === "NAO_FEZ" && revisao?.status === "PENDENTE")
    );
  }).length;
  const progressoHoje = tarefasAtual.length > 0
    ? Math.round((tarefasResolvidasHoje / tarefasAtual.length) * 100)
    : 0;

  const tarefasParaFazerHoje = tarefasAtual.filter((tarefa) =>
    !registroHoje(tarefa) &&
    !solicitacaoHoje(tarefa) &&
    !revisaoHoje(tarefa)
  ).length;
  const tarefasResolvidasPainelHoje = Math.max(
    0,
    tarefasAtual.length - tarefasParaFazerHoje - tarefasAguardandoHoje,
  );

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

  const recompensasOrdenadas = useMemo(
    () => [...estrelas.recompensas].sort((a, b) => a.estrelas_necessarias - b.estrelas_necessarias),
    [estrelas.recompensas],
  );
  const proximaRecompensa = recompensasOrdenadas.find((item) => !item.disponivel) ?? null;
  const ultimaConquistada = recompensasOrdenadas.filter((item) => item.disponivel).at(-1) ?? null;
  const recompensaDestaque = proximaRecompensa ?? ultimaConquistada;
  const progressoRecompensa = recompensaDestaque
    ? Math.min(100, Math.max(0, (estrelas.saldo / recompensaDestaque.estrelas_necessarias) * 100))
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

  async function enviarRevisaoTarefa() {
    if (!revisaoTarefa || enviandoAviso) return;

    setEnviandoAviso(true);
    try {
      const resposta = await pedirRevisaoTarefa(revisaoTarefa.id, observacaoAviso);
      const token = await lerSessaoFilhoLocal();

      if (token) {
        const atual = await obterPainelFilhoApp(token);
        if (atual) setPainel(atual);
      }

      setRevisaoTarefa(null);
      setObservacaoAviso("");

      toast.success(
        resposta.ja_existia
          ? "A revisão desta tarefa já foi enviada."
          : "Pedido de revisão enviado ao responsável.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível pedir a revisão.",
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

  const abrirAviso = (tarefa: TarefaFilho) => {
    setObservacaoAviso("");
    setRevisaoTarefa(null);
    setAvisoTarefa(tarefa);
  };

  const abrirRevisao = (tarefa: TarefaFilho) => {
    setObservacaoAviso("");
    setAvisoTarefa(null);
    setRevisaoTarefa(tarefa);
  };

  const itensTarefasHoje = tarefasAtual.map((tarefa) => (
    <FilhoTarefaItem
      key={tarefa.id}
      tarefa={tarefa}
      registroHoje={registroHoje(tarefa)}
      solicitacaoHoje={solicitacaoHoje(tarefa)}
      revisaoHoje={revisaoHoje(tarefa)}
      onAvisar={() => abrirAviso(tarefa)}
      onPedirRevisao={() => abrirRevisao(tarefa)}
    />
  ));

  const SemVigencia = () => (
    <div className="rounded-2xl border border-dashed bg-card p-5 text-center">
      <Clock3 className="mx-auto h-5 w-5 text-muted-foreground" />
      <p className="mt-2 text-sm font-medium">Nenhum combinado em andamento agora.</p>
      <p className="mt-1 text-xs text-muted-foreground">Quando começar uma nova vigência, ela aparece aqui.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/10">
      <AppFilhoPushNotifications onAbrir={abrirInicioPeloPush} />

      <header className="native-sticky-safe-top sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className={`${appPageHorizontalPaddingClass} py-2.5`}>
          <div className={`${appPageInnerClass} flex items-center justify-between gap-3`}>
            <button
              type="button"
              onClick={() => setAba("inicio")}
              className="min-w-0 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label="Ir para o início"
            >
              <AppBrand />
            </button>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setAba("estrelas")}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-background px-2.5 text-xs font-bold transition-transform active:scale-95"
                aria-label="Abrir estrelas"
              >
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                {estrelas.saldo}
              </button>

              <button
                type="button"
                className="rounded-full p-0.5 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
            <DialogDescription>Seu acesso ao Combinado Família.</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 rounded-2xl border p-4">
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
        </DialogContent>
      </Dialog>

      <AppPageContent className="pb-24 md:pb-28">
        {aba === "inicio" && (
          <div className="space-y-4">
            <div className="pt-1">
              <h1 className="text-2xl font-bold leading-tight">Oi, {painel.filho.nome}!</h1>
              <p className="mt-1 text-sm text-muted-foreground">Seu foco é o combinado de hoje.</p>
            </div>

            {vigenciaAtual ? (
              <>
                <button
                  type="button"
                  onClick={() => setAba("tarefas")}
                  className="w-full rounded-2xl border bg-card p-4 text-left transition-colors active:bg-muted/30 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Progresso de hoje</p>
                      <p className="mt-1 text-lg font-bold">
                        {tarefasResolvidasHoje} de {tarefasAtual.length} tarefas
                      </p>
                      {tarefasAguardandoHoje > 0 ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {tarefasAguardandoHoje} aguardando confirmação
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Ver tarefas de hoje
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-2xl font-bold tabular-nums">{progressoHoje}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progressoHoje}%` }} />
                  </div>
                  <div
                    className="mt-3 flex items-center justify-end gap-1.5 text-xs font-bold"
                    style={{ color: painel.filho.cor?.trim() || "var(--primary)" }}
                  >
                    <span>Ver minhas tarefas</span>
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full border"
                      style={{ borderColor: painel.filho.cor?.trim() || "var(--primary)" }}
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </button>

                {recompensaDestaque && (
                  <button
                    type="button"
                    onClick={() => setAba("estrelas")}
                    className="w-full rounded-2xl border bg-card p-4 text-left transition-colors active:bg-muted/30"
                  >
                    {recompensaDestaque.disponivel ? (
                      <div className="flex items-center gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border bg-amber-50">
                          <Star className="h-7 w-7 fill-amber-400 text-amber-500" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-green-700">Conquistado!</p>
                          <p className="mt-0.5 break-words text-sm font-semibold">{recompensaDestaque.nome}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">Veja sua recompensa.</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">Próxima recompensa</p>
                            <p className="mt-0.5 break-words text-sm font-semibold">{recompensaDestaque.nome}</p>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                            {recompensaDestaque.estrelas_necessarias}
                          </span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progressoRecompensa}%` }} />
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          Faltam {Math.max(0, recompensaDestaque.estrelas_necessarias - estrelas.saldo)} para conquistar
                        </p>
                      </>
                    )}
                    <div
                      className="mt-3 flex items-center justify-end gap-1.5 text-xs font-bold"
                      style={{ color: painel.filho.cor?.trim() || "var(--primary)" }}
                    >
                      <span>Ver minhas estrelas</span>
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full border"
                        style={{ borderColor: painel.filho.cor?.trim() || "var(--primary)" }}
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </button>
                )}

                <section className="overflow-hidden rounded-2xl border bg-card">
                  <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Combinado atual</p>
                      <p className="mt-0.5 text-sm font-semibold">{data(vigenciaAtual.data_inicio)} até {data(vigenciaAtual.data_fim)}</p>
                    </div>
                    <Badge className="h-5 shrink-0 border-green-200 bg-green-100 px-1.5 py-0 text-[10px] font-semibold text-green-700">Em andamento</Badge>
                  </div>

                  <div className="grid grid-cols-2 border-t text-sm">
                    <div className="px-4 py-3 sm:px-5">
                      <p className="text-xs text-muted-foreground">{painel.filho.tem_mesada ? "Valor atual" : "Não fez"}</p>
                      <p className="mt-0.5 font-semibold">
                        {painel.filho.tem_mesada ? dinheiro(mesadaFinal ?? 0) : `${qtdNaoFez} de ${vigenciaAtual.qtd_ocorrencia}`}
                      </p>
                    </div>
                    <div className="border-l px-4 py-3 sm:px-5">
                      <p className="text-xs text-muted-foreground">{painel.filho.tem_mesada ? "Desconto por Não fez" : "Penalidade"}</p>
                      <p className="mt-0.5 break-words font-semibold">
                        {painel.filho.tem_mesada ? dinheiro(descontoUnitario) : (vigenciaAtual.penalidade || "—")}
                      </p>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <SemVigencia />
            )}

            <p className="flex items-center justify-center gap-1.5 pb-1 pt-1 text-[11px] text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              Atualizado {dataHora(painel.atualizado_em)}
            </p>
          </div>
        )}

        {aba === "tarefas" && (
          <div>
            <FilhoAppPageHeader
              title="Tarefas de hoje"
              description="Veja o que você precisa fazer hoje."
              icon={<ClipboardList className="h-4.5 w-4.5" />}
            />

            {vigenciaAtual ? (
              tarefasAtual.length > 0 ? (
                <section className="overflow-hidden rounded-2xl border bg-card">
                  <div className="flex items-center gap-3 border-b px-4 py-3.5 sm:px-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/60">
                      <CalendarDays
                        className="h-5 w-5"
                        style={{ color: painel.filho.cor?.trim() || "var(--primary)" }}
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hoje</p>
                      <p className="mt-0.5 text-base font-bold leading-tight">{formatarDataHoje(hoje)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 border-b">
                    <div className="flex min-w-0 flex-col items-center justify-center gap-1 px-2 py-3 text-center">
                      <Clock3 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-lg font-bold leading-none tabular-nums">{tarefasParaFazerHoje}</span>
                      <span className="text-[11px] font-medium leading-tight text-muted-foreground">Pra fazer</span>
                    </div>
                    <div className="flex min-w-0 flex-col items-center justify-center gap-1 border-x px-2 py-3 text-center">
                      <BellRing className="h-4 w-4 text-amber-600" />
                      <span className="text-lg font-bold leading-none tabular-nums">{tarefasAguardandoHoje}</span>
                      <span className="text-[11px] font-medium leading-tight text-muted-foreground">Aguardando</span>
                    </div>
                    <div className="flex min-w-0 flex-col items-center justify-center gap-1 px-2 py-3 text-center">
                      <ClipboardCheck className="h-4 w-4 text-green-600" />
                      <span className="text-lg font-bold leading-none tabular-nums">{tarefasResolvidasPainelHoje}</span>
                      <span className="text-[11px] font-medium leading-tight text-muted-foreground">Resolvidas</span>
                    </div>
                  </div>

                  <div className="divide-y">
                    {itensTarefasHoje}
                  </div>
                </section>
              ) : (
                <EmptyState>Nenhuma tarefa atribuída nesta vigência.</EmptyState>
              )
            ) : (
              <SemVigencia />
            )}
          </div>
        )}

        {aba === "registros" && (
          <div>
            <FilhoAppPageHeader
              title="Fez / Não fez"
              description="Resultados do seu combinado atual."
              icon={<ClipboardCheck className="h-4.5 w-4.5" />}
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
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${ocorrencia.tipo === "FEZ" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
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
                                {b && <p className="mt-1 break-words text-xs text-muted-foreground">Extra: {b}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleSection>
                  ))}
                </div>
              ) : (
                <EmptyState>Nenhum registro nesta vigência.</EmptyState>
              )
            ) : (
              <SemVigencia />
            )}
          </div>
        )}

        {aba === "estrelas" && <FilhoEstrelasPage estrelas={estrelas} />}
      </AppPageContent>

      <nav
        aria-label="Navegação principal do filho"
        className="native-safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur"
      >
        <div className={`${appPageHorizontalPaddingClass}`}>
          <div className={`${appPageInnerClass} grid grid-cols-4`}>
            {ABAS.map(({ id, label, icon: Icon }) => {
              const ativo = aba === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAba(id)}
                  aria-current={ativo ? "page" : undefined}
                  className={`relative flex min-w-0 flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[10px] font-semibold transition-colors active:bg-muted/30 ${ativo ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {ativo && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-5 top-0 h-0.5 rounded-full"
                      style={{ backgroundColor: painel.filho.cor?.trim() || "var(--primary)" }}
                    />
                  )}
                  <Icon
                    className={`h-5 w-5 ${id === "estrelas" && ativo ? "fill-amber-400 text-amber-500" : ""}`}
                    style={ativo && id !== "estrelas" ? { color: painel.filho.cor?.trim() || "var(--primary)" } : undefined}
                  />
                  <span className="max-w-full truncate leading-tight">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <Dialog
        open={avisoTarefa !== null || revisaoTarefa !== null}
        onOpenChange={(open) => {
          if (!open && !enviandoAviso) {
            setAvisoTarefa(null);
            setRevisaoTarefa(null);
            setObservacaoAviso("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{revisaoTarefa ? "Pedir revisão" : "Avisar que terminei"}</DialogTitle>
            <DialogDescription>
              {revisaoTarefa
                ? `Você marcou que fez “${revisaoTarefa.nome}”, mas o responsável registrou Não fez. Envie uma revisão para ele conferir.`
                : avisoTarefa
                  ? `Avise seu responsável que você terminou “${avisoTarefa.nome}”. A confirmação continua sendo feita pelo responsável.`
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
            <p className="text-right text-[11px] text-muted-foreground">{observacaoAviso.length}/120</p>
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAvisoTarefa(null);
                setRevisaoTarefa(null);
                setObservacaoAviso("");
              }}
              disabled={enviandoAviso}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void (revisaoTarefa ? enviarRevisaoTarefa() : enviarAvisoTarefa())}
              disabled={enviandoAviso}
            >
              {enviandoAviso ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
