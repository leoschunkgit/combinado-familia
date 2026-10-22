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
  Info,
  Loader2,
  LogOut,
  RotateCcw,
  Send,
  Star,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { situacaoVigencia } from "@/components/VigenciaStatus";
import { FilhoAvatar } from "@/components/FilhoAvatar";
import { FilhoTarefaItem } from "@/components/FilhoTarefaItem";
import { FilhoAppPageHeader } from "@/components/FilhoAppPageHeader";
import { FilhoThemeToggle } from "@/components/FilhoThemeToggle";
import { TarefaIcone } from "@/components/TarefaIcone";
import { FilhoEstrelasPage } from "@/components/FilhoEstrelasPage";
import { AppBrand } from "@/components/AppBrand";
import { AppGlobalMessage } from "@/components/AppGlobalMessage";
import {
  consequenciaEhDescontoAplicado,
  consequenciaEhPenalidadePendente,
  descreverConsequenciaOcorrencia,
} from "@/lib/ocorrencia-model";
import { AppFilhoPushNotifications } from "@/components/AppFilhoPushNotifications";
import { AppPageContent, appPageHorizontalPaddingClass, appPageInnerClass } from "@/components/AppPageContent";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { EmptyState } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModalCloseIcon, modalCloseInlineButtonClass } from "@/components/ui/modal-close";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  avisarTarefaConcluida,
  confirmarRecompensaAproveitada,
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

const CHAVE_TEMA_FILHO = "combinado-familia:filho:tema";

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
  const [modoEscuro, setModoEscuro] = useState(false);
  const [registroAberto, setRegistroAberto] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);
  const [avisoTarefa, setAvisoTarefa] = useState<TarefaFilho | null>(null);
  const [revisaoTarefa, setRevisaoTarefa] = useState<{
    tarefa: TarefaFilho;
    ocorrencia: OcorrenciaFilho;
  } | null>(null);
  const [enviandoAviso, setEnviandoAviso] = useState(false);
  const abrirTarefasPeloPush = useCallback(() => setAba("tarefas"), []);

  const alterarModoEscuro = useCallback((escuro: boolean) => {
    setModoEscuro(escuro);

    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", escuro);
    }

    try {
      window.localStorage.setItem(CHAVE_TEMA_FILHO, escuro ? "dark" : "light");
    } catch {
      // Preferência visual não deve bloquear o uso do app.
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const raiz = document.documentElement;
    const temaAnterior = raiz.classList.contains("dark");
    let escuro = false;

    try {
      escuro = window.localStorage.getItem(CHAVE_TEMA_FILHO) === "dark";
    } catch {
      escuro = false;
    }

    raiz.classList.toggle("dark", escuro);
    setModoEscuro(escuro);

    return () => {
      raiz.classList.toggle("dark", temaAnterior);
    };
  }, []);

  useEffect(() => {
    let ativo = true;

    async function atualizar() {
      const token = await lerSessaoFilhoLocal();
      if (!token) {
        // Uma falha transitória de leitura do cofre local não é logout.
        // A sessão só é encerrada quando o backend confirma que foi revogada.
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
    const timer = window.setInterval(() => void atualizar(), 5000);

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

  const solicitacaoHoje = (tarefa: TarefaFilho) => {
    const solicitacoes = (painel.solicitacoes_hoje ?? []).filter(
      (s) => s.id_filho_tarefa === tarefa.id && s.data_referencia === hoje,
    );
    return solicitacoes.find((s) => s.status === "PENDENTE") ?? solicitacoes[0];
  };

  const revisaoDaOcorrencia = (idOcorrencia: number) =>
    (painel.revisoes ?? []).find(
      (revisao) => revisao.id_ocorrencia === idOcorrencia,
    );

  const revisaoHoje = (tarefa: TarefaFilho) => {
    const registro = registroHoje(tarefa);
    return registro ? revisaoDaOcorrencia(registro.id) : undefined;
  };

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

  const tarefasParaFazerHoje = tarefasAtual.filter((tarefa) => {
    const solicitacao = solicitacaoHoje(tarefa);
    const revisao = revisaoHoje(tarefa);
    return (
      !registroHoje(tarefa) &&
      solicitacao?.status !== "PENDENTE" &&
      revisao?.status !== "PENDENTE"
    );
  }).length;
  const tarefasResolvidasPainelHoje = Math.max(
    0,
    tarefasAtual.length - tarefasParaFazerHoje - tarefasAguardandoHoje,
  );

  const qtdNaoFez =
    vigenciaAtual?.qtd_nao_fez ??
    tarefasAtual.reduce(
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
    total_conquistado: qtdFez,
    recompensas: [],
    resgates: [],
  };



  const registrosAtuais = useMemo(
    () => tarefasAtual
      .flatMap((tarefa) => tarefa.ocorrencias
        .filter((o) => o.tipo === "FEZ" || o.tipo === "NAO_FEZ")
        .map((ocorrencia) => ({ tarefa, ocorrencia })))
      .sort((a, b) => +new Date(b.ocorrencia.data) - +new Date(a.ocorrencia.data)),
    [tarefasAtual],
  );

  const revisoesPendentesDetalhadas = useMemo(() => {
    const revisoesPendentes = new Map(
      (painel.revisoes ?? [])
        .filter((revisao) => revisao.status === "PENDENTE")
        .map((revisao) => [revisao.id_ocorrencia, revisao]),
    );
    const itens: Array<{
      revisaoId: number;
      tarefaNome: string;
      data: string;
    }> = [];

    for (const vigencia of painel.vigencias) {
      for (const tarefa of vigencia.tarefas) {
        for (const ocorrencia of tarefa.ocorrencias) {
          const revisao = revisoesPendentes.get(ocorrencia.id);
          if (!revisao) continue;
          itens.push({
            revisaoId: revisao.id,
            tarefaNome: tarefa.nome,
            data: ocorrencia.data,
          });
        }
      }
    }

    return itens.sort((a, b) => +new Date(b.data) - +new Date(a.data));
  }, [painel.revisoes, painel.vigencias]);

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
    if (registroAberto && !registrosPorData.some((grupo) => grupo.data === registroAberto)) {
      setRegistroAberto(null);
    }
  }, [registrosPorData, registroAberto]);

  const desconto = painel.filho.tem_mesada
    ? tarefasAtual.reduce(
        (total, tarefa) =>
          total +
          tarefa.ocorrencias.reduce((subtotal, ocorrencia) => {
            const consequencia = ocorrencia.consequencia;
            return consequenciaEhDescontoAplicado(consequencia)
              ? subtotal + Number(consequencia?.desconto_valor ?? 0)
              : subtotal;
          }, 0),
        0,
      )
    : 0;
  const mesadaFinal = painel.filho.valor_mesada === null
    ? null
    : Math.max(0, painel.filho.valor_mesada - desconto);
  const penalidadesPendentes = tarefasAtual.reduce(
    (total, tarefa) =>
      total +
      tarefa.ocorrencias.filter(
        (ocorrencia) =>
          consequenciaEhPenalidadePendente(ocorrencia.consequencia),
      ).length,
    0,
  );

  async function enviarAvisoTarefa() {
    if (!avisoTarefa || enviandoAviso) return;

    setEnviandoAviso(true);
    try {
      const resposta = await avisarTarefaConcluida(avisoTarefa.id, "");
      const token = await lerSessaoFilhoLocal();

      if (token) {
        const atual = await obterPainelFilhoApp(token);
        if (atual) setPainel(atual);
      }

      setAvisoTarefa(null);

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
      const { ocorrencia } = revisaoTarefa;
      if (ocorrencia.tipo !== "NAO_FEZ") {
        throw new Error("O registro de “Não fez” não está mais disponível para revisão.");
      }

      const resposta = await pedirRevisaoTarefa(ocorrencia.id, "");
      const token = await lerSessaoFilhoLocal();

      if (token) {
        const atual = await obterPainelFilhoApp(token);
        if (atual) setPainel(atual);
      }

      setRevisaoTarefa(null);

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

  async function concluirRecompensa(idRecompensa: number) {
    try {
      const resposta = await confirmarRecompensaAproveitada(idRecompensa);

      if (resposta.estrelas) {
        setPainel((atual) => ({
          ...atual,
          estrelas: resposta.estrelas,
        }));
      } else {
        const token = await lerSessaoFilhoLocal();

        if (token) {
          const atual = await obterPainelFilhoApp(token);
          if (atual) setPainel(atual);
        }
      }

      toast.success(
        resposta.ja_concluida
          ? "Essa recompensa já estava concluída."
          : "Boa! Agora começa uma nova contagem para essa recompensa.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a recompensa.",
      );
      throw error;
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
    setRevisaoTarefa(null);
    setAvisoTarefa(tarefa);
  };

  const abrirRevisao = (
    tarefa: TarefaFilho,
    ocorrencia: OcorrenciaFilho,
  ) => {
    setAvisoTarefa(null);
    setRevisaoTarefa({ tarefa, ocorrencia });
  };

  const itensTarefasHoje = tarefasAtual.map((tarefa) => (
    <FilhoTarefaItem
      key={tarefa.id}
      tarefa={tarefa}
      registroHoje={registroHoje(tarefa)}
      solicitacaoHoje={solicitacaoHoje(tarefa)}
      revisaoHoje={revisaoHoje(tarefa)}
      onAvisar={() => abrirAviso(tarefa)}
      onPedirRevisao={() => {
        const ocorrencia = registroHoje(tarefa);
        if (ocorrencia?.tipo === "NAO_FEZ") abrirRevisao(tarefa, ocorrencia);
      }}
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
      <AppFilhoPushNotifications onAbrir={abrirTarefasPeloPush} />

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
                className="animate-subtle-shake inline-flex h-9 items-center gap-1.5 rounded-full border bg-background px-2.5 text-xs font-bold transition-transform active:scale-95"
                aria-label="Abrir estrelas"
              >
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                {estrelas.total_conquistado}
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

      {menuAberto && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/20"
            aria-label="Fechar menu do filho"
            onClick={() => setMenuAberto(false)}
          />
          <div
            role="menu"
            aria-label="Menu do filho"
            className="fixed z-50 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl"
            style={{
              top: "calc(env(safe-area-inset-top) + 4.25rem)",
              right: "calc(env(safe-area-inset-right) + .75rem)",
            }}
          >
            <div className="flex items-start gap-3 border-b px-4 py-4">
              <FilhoAvatar
                nome={painel.filho.nome}
                cor={painel.filho.cor}
                avatar={painel.filho.avatar === "menino" || painel.filho.avatar === "menina" ? painel.filho.avatar : null}
                className="h-10 w-10"
              />
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-sm font-semibold">{painel.filho.nome}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  Responsável: {painel.responsavel?.nome}
                </p>
              </div>
              <button
                type="button"
                className={modalCloseInlineButtonClass}
                onClick={() => setMenuAberto(false)}
                aria-label="Fechar menu do filho"
              >
                <ModalCloseIcon />
              </button>
            </div>

            <div className="p-2">
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
                onClick={() => {
                  setMenuAberto(false);
                  void sair();
                }}
                disabled={saindo}
              >
                {saindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                Sair
              </button>
            </div>

            <div className="border-t px-4 py-3 text-center text-[10px] leading-relaxed text-muted-foreground">
              <p>Versão 1.2.17</p>
              <p>© 2026 Combinado Família. Todos os direitos reservados.</p>
            </div>
          </div>
        </>
      )}

      <AppPageContent className="pb-24 md:pb-28">
        <AppGlobalMessage
          ativa={painel.comunicacao?.mensagem_global_ativa === true}
          mensagem={painel.comunicacao?.mensagem_global ?? null}
          className="mb-4"
        />

        {aba === "inicio" && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 pt-1">
              <div className="min-w-0">
                <h1 className="break-words text-2xl font-bold leading-tight">Oi, {painel.filho.nome}!</h1>
                <p className="mt-1 text-sm text-muted-foreground">Seu foco é o combinado de hoje.</p>
              </div>
              <FilhoThemeToggle
                modoEscuro={modoEscuro}
                onChange={alterarModoEscuro}
                className="mt-0.5 shrink-0"
              />
            </div>

            {revisoesPendentesDetalhadas.length > 0 && (
              <section className="overflow-hidden rounded-2xl border border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20">
                <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                    <BellRing className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {revisoesPendentesDetalhadas.length === 1
                        ? "Revisão aguardando o responsável"
                        : `${revisoesPendentesDetalhadas.length} revisões aguardando o responsável`}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      O pedido continua pendente até o responsável decidir, mesmo que a vigência já tenha terminado.
                    </p>
                  </div>
                </div>
                <div className="divide-y border-t border-amber-200/80 dark:border-amber-900/70">
                  {revisoesPendentesDetalhadas.map((item) => (
                    <div
                      key={item.revisaoId}
                      className="flex min-w-0 items-center gap-2 px-4 py-2.5 text-xs sm:px-5"
                    >
                      <TarefaIcone nome={item.tarefaNome} className="shrink-0" />
                      <span className="min-w-0 flex-1 break-words font-medium">
                        {item.tarefaNome}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {data(item.data)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

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



                <section className="overflow-hidden rounded-2xl border bg-card">
                  <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">Combinado atual</p>
                      <p className="mt-0.5 text-sm font-semibold">{data(vigenciaAtual.data_inicio)} até {data(vigenciaAtual.data_fim)}</p>
                    </div>
                    <Badge className="h-5 shrink-0 border-green-200 bg-green-100 px-1.5 py-0 text-[10px] font-semibold text-green-700 dark:border-green-800 dark:bg-green-950/45 dark:text-green-300">Em andamento</Badge>
                  </div>

                  {painel.filho.tem_mesada ? (
                    <div className="grid grid-cols-3 border-t text-sm">
                      <div className="min-w-0 px-2 py-3 text-center sm:px-4">
                        <p className="text-[11px] leading-tight text-muted-foreground sm:text-xs">Valor da mesada</p>
                        <p className="mt-1 break-words font-semibold">{dinheiro(painel.filho.valor_mesada ?? 0)}</p>
                      </div>
                      <div className="min-w-0 border-l px-2 py-3 text-center sm:px-4">
                        <p className="text-[11px] leading-tight text-muted-foreground sm:text-xs">Descontos</p>
                        <p className="mt-1 break-words font-semibold">{dinheiro(desconto)}</p>
                      </div>
                      <div className="min-w-0 border-l px-2 py-3 text-center sm:px-4">
                        <p className="text-[11px] leading-tight text-muted-foreground sm:text-xs">Valor atual</p>
                        <p className="mt-1 break-words font-semibold">{dinheiro(mesadaFinal ?? 0)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 border-t text-sm">
                      <div className="px-4 py-3 sm:px-5">
                        <p className="text-xs text-muted-foreground">Não fez nesta vigência</p>
                        <p className="mt-0.5 font-semibold">{qtdNaoFez}</p>
                      </div>
                      <div className="border-l px-4 py-3 sm:px-5">
                        <p className="text-xs text-muted-foreground">Penalidades pendentes</p>
                        <p className="mt-0.5 break-words font-semibold">{penalidadesPendentes}</p>
                      </div>
                    </div>
                  )}
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
                      <BellRing className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                      <span className="text-lg font-bold leading-none tabular-nums">{tarefasAguardandoHoje}</span>
                      <span className="text-[11px] font-medium leading-tight text-muted-foreground">Aguardando</span>
                    </div>
                    <div className="flex min-w-0 flex-col items-center justify-center gap-1 px-2 py-3 text-center">
                      <ClipboardCheck className="h-4 w-4 text-green-600 dark:text-green-300" />
                      <span className="text-lg font-bold leading-none tabular-nums">{tarefasResolvidasPainelHoje}</span>
                      <span className="text-[11px] font-medium leading-tight text-muted-foreground">Resolvidas</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 border-b bg-muted/20 px-4 py-2.5 sm:px-5">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Cada registro de “Não fez” pode ter apenas 1 pedido de revisão.
                    </p>
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
                          const revisao =
                            ocorrencia.tipo === "NAO_FEZ"
                              ? revisaoDaOcorrencia(ocorrencia.id)
                              : undefined;
                          const consequencia = ocorrencia.consequencia;
                          const detalheConsequencia =
                            ocorrencia.tipo === "NAO_FEZ"
                              ? descreverConsequenciaOcorrencia(
                                  consequencia,
                                  dinheiro,
                                )
                              : null;

                          return (
                            <div key={ocorrencia.id ?? `${tarefa.id}-${ocorrencia.data}-${i}`} className="flex min-w-0 items-start gap-3 px-4 py-3.5 sm:px-5">
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${ocorrencia.tipo === "FEZ" ? "bg-green-50 text-green-700 dark:bg-green-950/35 dark:text-green-300" : "bg-red-50 text-red-600 dark:bg-red-950/35 dark:text-red-300"}`}>
                                {ocorrencia.tipo === "FEZ" ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-start gap-2">
                                  <TarefaIcone nome={tarefa.nome} className="mt-0.5" />
                                  <p className="min-w-0 break-words text-sm font-semibold">{tarefa.nome}</p>
                                </div>
                                <p className={`mt-1 text-xs font-medium ${ocorrencia.tipo === "FEZ" ? "text-green-700 dark:text-green-300" : "text-red-600 dark:text-red-300"}`}>
                                  {ocorrencia.tipo === "FEZ" ? "Fez" : "Não fez"}
                                </p>
                                {b && <p className="mt-1 break-words text-xs text-muted-foreground">Extra: {b}</p>}
                                {detalheConsequencia && (
                                  <p className="mt-1 break-words text-xs text-muted-foreground">
                                    {detalheConsequencia}
                                  </p>
                                )}
                                {ocorrencia.tipo === "NAO_FEZ" && (
                                  <div className="mt-2">
                                    {!revisao ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-2.5 text-xs"
                                        onClick={() => abrirRevisao(tarefa, ocorrencia)}
                                      >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        Pedir revisão
                                      </Button>
                                    ) : revisao.status === "PENDENTE" ? (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                        <BellRing className="h-3.5 w-3.5" />
                                        Revisão enviada
                                      </span>
                                    ) : revisao.status === "MANTEVE_NAO_FEZ" ? (
                                      <span className="text-xs font-medium text-red-600 dark:text-red-300">
                                        Não fez mantido
                                      </span>
                                    ) : revisao.status === "ALTERADO_PARA_FEZ" ? (
                                      <span className="text-xs font-medium text-green-700 dark:text-green-300">
                                        Alterado para Fez
                                      </span>
                                    ) : (
                                      <span className="text-xs font-medium text-muted-foreground">
                                        Marcação desfeita
                                      </span>
                                    )}
                                  </div>
                                )}
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

        {aba === "estrelas" && (
          <FilhoEstrelasPage
            estrelas={estrelas}
            onConfirmarAproveitada={concluirRecompensa}
          />
        )}
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
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{revisaoTarefa ? "Pedir revisão" : "Avisar que terminei"}</DialogTitle>
            <DialogDescription>
              {revisaoTarefa
                ? `Você marcou que fez “${revisaoTarefa.tarefa.nome}”, mas o responsável registrou Não fez. Envie uma revisão para ele conferir.`
                : avisoTarefa
                  ? `Avise seu responsável que você terminou “${avisoTarefa.nome}”. A confirmação continua sendo feita pelo responsável.`
                  : ""}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAvisoTarefa(null);
                setRevisaoTarefa(null);
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
