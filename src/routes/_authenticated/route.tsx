import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, CalendarRange, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Copy, ListTodo, LogOut, Users, Link2, Home, CircleHelp, ArrowRight, ArrowLeft, Menu, UserCog, ListPlus, MessageSquareText, ShieldCheck, Smartphone, Star, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ModalCloseIcon, modalCloseInlineButtonClass } from "@/components/ui/modal-close";
import { useActionLoading } from "@/components/ActionLoading";
import { OnboardingInicial } from "@/components/OnboardingInicial";
import { msgErro, useFilhos, useFilhoTarefas, useOcorrencias, useTarefas, useVigencias } from "@/lib/db";
import { pendenciasAnteriores, pendenciasDoDia, useDataBrasilAtual } from "@/lib/notificacoes";
import { clonarUltimaVigencia, obterUltimaVigencia } from "@/lib/clonar-vigencia";
import { ClonarVigenciaDialog } from "@/components/ClonarVigenciaDialog";
import { AppPushNotifications } from "@/components/AppPushNotifications";
import { AppVersion } from "@/components/AppVersion";
import { AppSystemStatus } from "@/components/AppSystemStatus";
import { AppBrand } from "@/components/AppBrand";
import { AppPageContent } from "@/components/AppPageContent";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { FilhoThemeToggle } from "@/components/FilhoThemeToggle";
import { Hint } from "@/components/Hint";
import { desativarPushAtual } from "@/lib/push-notifications";
import { registrarTelemetriaApp } from "@/lib/app-telemetry";
import {
  bloquearBiometriaNestaExecucao,
  podeAcessarAreaAutenticada,
} from "@/lib/biometric-auth";
import {
  encerrarSessaoResponsavelNesteAparelho,
  obterUsuarioResponsavelPersistido,
} from "@/lib/responsavel-session";
import {
  getThemePreference,
  resolveTheme,
  saveThemePreference,
  THEME_CHANGE_EVENT,
} from "@/lib/theme";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const podeAcessar = await podeAcessarAreaAutenticada();
    if (!podeAcessar) throw redirect({ to: "/" });

    const user = await obterUsuarioResponsavelPersistido();
    if (!user) throw redirect({ to: "/" });
    const { data: pai } = await supabase.from("t_usuario_pai").select("id, nome").maybeSingle();
    let nome = pai?.nome;
    let idPai = pai?.id;
    if (!pai) {
      const meta = user.user_metadata ?? {};
      nome = (meta["nome"] as string) || user.email?.split("@")[0] || "Responsável";
      const { data: criado, error: criarErro } = await supabase
        .from("t_usuario_pai")
        .insert({ nome, email: user.email ?? "" })
        .select("id, nome")
        .single();
      if (criarErro || !criado) {
        throw new Error("Não foi possível preparar os dados da conta do responsável.");
      }
      nome = criado.nome;
      idPai = criado.id;
    }

    const { data: admin } = await supabase
      .from("t_admin")
      .select("id")
      .eq("id_usuario_pai", idPai!)
      .eq("ativo", true)
      .maybeSingle();

    return { user, nomePai: nome ?? "", ehAdmin: Boolean(admin) };
  },
  component: AuthenticatedLayout,
});

type NavItem = {
  to: "/inicio" | "/ocorrencias" | "/filhos" | "/acesso-filhos" | "/estrelas" | "/tarefas" | "/vigencias" | "/atribuicoes";
  label: string;
  icon: typeof Home;
};

const NAV_ITENS: NavItem[] = [
  { to: "/inicio", label: "Início", icon: Home },
  { to: "/ocorrencias", label: "Fez / Não fez", icon: ClipboardCheck },
  { to: "/filhos", label: "Filhos", icon: Users },
  { to: "/acesso-filhos", label: "Acesso dos filhos", icon: Smartphone },
  { to: "/estrelas", label: "Estrelas e recompensas", icon: Star },
  { to: "/tarefas", label: "Tarefas", icon: ListTodo },
  { to: "/vigencias", label: "Vigências", icon: CalendarRange },
  { to: "/atribuicoes", label: "Atribuições", icon: Link2 },
];

const ETAPAS = [
  { to: "/filhos", label: "Filhos", title: "Cadastre os filhos", rule: "Informe o nome de cada filho. Se ele recebe mesada, marque essa opção e informe o valor. A consequência de cada “Não fez” será escolhida no momento da marcação." },
  { to: "/tarefas", label: "Tarefas", title: "Crie as tarefas", rule: "Cadastre as tarefas que você quer combinar com os filhos. Depois, você poderá atribuir a mesma tarefa a mais de um filho." },
  { to: "/vigencias", label: "Vigências", title: "Defina o período", rule: "Escolha apenas o início e o fim do combinado. A vigência organiza o período e as atribuições; as consequências pertencem a cada ocorrência." },
  { to: "/atribuicoes", label: "Atribuições", title: "Associe filhos e tarefas", rule: "Selecione a vigência, o filho e as tarefas. Uma atribuição que já tenha algum resultado não pode ser excluída; outras atribuições sem histórico continuam independentes." },
  { to: "/ocorrencias", label: "Fez / Não fez", title: "Acompanhe os combinados", rule: "Registre “Fez”, “Não fez” ou “Não precisou” na data em que aconteceu. “Não precisou” encerra a pendência sem estrela e sem consequência. Em cada “Não fez”, escolha de forma independente: nada, desconto da mesada (quando houver) ou penalidade." },
] as const;

function AuthenticatedLayout() {
  const { nomePai, user, ehAdmin } = Route.useRouteContext();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { data: filhos = [] } = useFilhos();
  const { data: tarefas = [] } = useTarefas();
  const { data: vigencias = [] } = useVigencias();
  const { data: atribuicoes = [] } = useFilhoTarefas();
  const { data: ocorrencias = [] } = useOcorrencias();
  const qc = useQueryClient();
  const { runAction } = useActionLoading();
  const hoje = useDataBrasilAtual();
  const [aberto, setAberto] = useState(false);
  const [etapa, setEtapa] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [menuUsuarioMobileAberto, setMenuUsuarioMobileAberto] = useState(false);
  const [menuDesktopRecolhido, setMenuDesktopRecolhido] = useState(false);
  const [menuUsuarioDesktopAberto, setMenuUsuarioDesktopAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [confirmarCloneMenuAberto, setConfirmarCloneMenuAberto] = useState(false);
  const [feedbackAberto, setFeedbackAberto] = useState(false);
  const [modoEscuro, setModoEscuro] = useState(() => resolveTheme(getThemePreference()) === "dark");

  useEffect(() => {
    void registrarTelemetriaApp();
  }, []);

  useEffect(() => {
    const sincronizarTema = () => setModoEscuro(resolveTheme(getThemePreference()) === "dark");
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    window.addEventListener(THEME_CHANGE_EVENT, sincronizarTema);
    media.addEventListener("change", sincronizarTema);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, sincronizarTema);
      media.removeEventListener("change", sincronizarTema);
    };
  }, []);

  const alterarModoEscuro = (escuro: boolean) => {
    setModoEscuro(escuro);
    saveThemePreference(escuro ? "dark" : "light");
  };

  async function clonarPeloMenu() {
    try {
      const { qtdAtribuicoes } = await clonarUltimaVigencia(vigencias);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["vigencias"] }),
        qc.invalidateQueries({ queryKey: ["filho_tarefas"] }),
        qc.invalidateQueries({ queryKey: ["ocorrencias"] }),
      ]);
      setConfirmarCloneMenuAberto(false);
      toast.success(`Vigência clonada com ${qtdAtribuicoes} atribuição(ões), todas zeradas`);
      navigate({ to: "/vigencias" });
    } catch (error) {
      toast.error(msgErro(error instanceof Error ? { message: error.message } : null));
    }
  }

  async function encerrar() {
    setAberto(false); setEtapa(null);
    if (user.user_metadata?.["guia_concluido"] === true) return;
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ data: { guia_concluido: true } });
    setSalvando(false);
    if (error) toast.error("Não foi possível salvar sua escolha. O guia poderá aparecer novamente no próximo acesso.");
  }

  function irParaEtapa(indice: number) {
    const destino = ETAPAS[indice];
    if (!destino) return;
    setAberto(false); setEtapa(indice); navigate({ to: destino.to });
  }

  function abrirGuia() { setEtapa(null); setAberto(true); }

  async function sair() {
    setSaindo(true);
    setSalvando(true);
    setMenuMobileAberto(false);
    setMenuUsuarioMobileAberto(false);
    await qc.cancelQueries();

    bloquearBiometriaNestaExecucao();

    try {
      await desativarPushAtual();
    } catch (error) {
      console.error("Não foi possível desativar o push deste aparelho ao sair:", error);
    }

    const { error } = await encerrarSessaoResponsavelNesteAparelho();
    if (error) {
      console.error("Não foi possível encerrar a sessão local:", error);
    }

    qc.clear();
    navigate({ to: "/", replace: true });
  }

  const passoAtual = etapa === null ? null : ETAPAS[etapa];
  const configuracaoInicialConcluida = filhos.length > 0 && tarefas.length > 0 && vigencias.length > 0 && atribuicoes.length > 0;
  const agoraBrasil = new Date(hoje + "T12:00:00-03:00");
  const pendenciasHoje = configuracaoInicialConcluida ? pendenciasDoDia(vigencias, atribuicoes, ocorrencias, agoraBrasil) : [];
  const pendenciasPassadas = configuracaoInicialConcluida ? pendenciasAnteriores(vigencias, atribuicoes, ocorrencias, agoraBrasil) : [];
  const totalPendencias = pendenciasHoje.length + pendenciasPassadas.length;
  const quantidadeNotificacoes = new Set([
    ...pendenciasHoje.map((p) => p.id_filho),
    ...pendenciasPassadas.map((p) => p.tarefa.id_filho),
  ]).size;
  const ultimaVigencia = obterUltimaVigencia(vigencias);
  const inicialResponsavel = nomePai.trim().charAt(0).toUpperCase() || "R";

  const AtalhosPrincipais = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={mobile ? "mt-5 space-y-2" : "mb-2 mt-7 space-y-1.5"}>
      <Link
        to="/cadastro-unico"
        onClick={() => mobile && setMenuMobileAberto(false)}
        className={mobile
          ? "flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35 px-2.5 py-2.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-950/55"
          : "flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35 px-1.5 py-1.5 text-[12px] font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-950/55"}
      >
        <span className={mobile ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/55 dark:text-amber-300" : "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/55 dark:text-amber-300"}>
          <ListPlus className={mobile ? "h-5 w-5" : "h-4 w-4"} />
        </span>
        <span className="min-w-0">
          <span className="block">Cadastro Fluxo</span>
          <span className={mobile ? "block text-[10px] font-medium opacity-75" : "block text-[8px] font-medium leading-tight opacity-75"}>Cadastre tudo em um só fluxo</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={() => {
          if (!ultimaVigencia) {
            toast.error("Não há vigência para clonar");
            return;
          }
          if (mobile) setMenuMobileAberto(false);
          setConfirmarCloneMenuAberto(true);
        }}
        className={mobile
          ? "flex w-full items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35 px-2.5 py-2.5 text-left text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-950/55"
          : "flex w-full items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35 px-1.5 py-1.5 text-left text-[12px] font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-950/55"}
      >
        <span className={mobile ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/55 dark:text-amber-300" : "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/55 dark:text-amber-300"}>
          <Copy className={mobile ? "h-5 w-5" : "h-4 w-4"} />
        </span>
        <span className="min-w-0">
          <span className="block">Clonar vigência</span>
          <span className={mobile ? "block text-[10px] font-medium opacity-75" : "block text-[8px] font-medium leading-tight opacity-75"}>Copie a última vigência</span>
        </span>
      </button>
    </div>
  );

  const MenuPrincipal = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={mobile ? "space-y-1.5" : "space-y-1.5"}>
      {NAV_ITENS.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={() => mobile && setMenuMobileAberto(false)}
          className={mobile
            ? "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            : "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[12px] font-medium leading-tight text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}
          activeProps={{ className: "!bg-primary/10 !text-primary" }}
        >
          <Icon className={mobile ? "h-5 w-5" : "h-4 w-4"} />
          <span className="min-w-0 flex-1">{label}</span>
          {to === "/ocorrencias" && quantidadeNotificacoes > 0 && (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-destructive-foreground">
              {quantidadeNotificacoes > 99 ? "99+" : quantidadeNotificacoes}
            </span>
          )}
        </Link>
      ))}
    </div>
  );

  const FeedbackButton = () => (
    <Button
      type="button"
      variant="ghost"
      className="h-auto w-full justify-start gap-2.5 rounded-md px-2 py-1.5 text-[12px] font-medium leading-tight text-muted-foreground"
      onClick={() => setFeedbackAberto(true)}
    >
      <MessageSquareText className="h-4 w-4" />
      Feedback
    </Button>
  );

  const MenuInferiorMobile = () => (
    <nav
      aria-label="Navegação inferior"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "var(--app-safe-bottom, env(safe-area-inset-bottom, 0px))" }}
    >
      <div
        className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex w-max min-w-full items-center justify-center gap-1 px-2 py-2">
          {NAV_ITENS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              title={label}
              aria-label={label}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors active:scale-95"
              activeProps={{ className: "!bg-primary/10 !text-primary" }}
            >
              <Icon className="h-5 w-5" />
              {to === "/ocorrencias" && quantidadeNotificacoes > 0 && (
                <span
                  className="absolute right-1 top-1 flex h-2.5 min-w-2.5 items-center justify-center rounded-full bg-destructive"
                  aria-label={`${quantidadeNotificacoes} notificações pendentes`}
                />
              )}
            </Link>
          ))}

        </div>
      </div>
    </nav>
  );

  return (
    <>
      {!saindo && <AppPushNotifications />}
      {!saindo && pathname !== "/cadastro-unico" && <OnboardingInicial />}
      <div className="min-h-screen md:flex">
        <aside
          className={`native-sticky-safe-top sticky top-0 z-30 border-b bg-sidebar transition-[width,border-color] duration-300 ease-out md:sticky md:top-0 md:z-auto md:flex md:h-screen md:shrink-0 md:flex-col md:border-b-0 ${
            menuDesktopRecolhido ? "md:w-0 md:border-r-0" : "md:w-56 md:border-r"
          }`}
        >
          <div
            className={`relative flex items-center px-4 py-3 transition-[transform,opacity] duration-200 ease-out md:w-56 md:justify-center md:px-2.5 md:pb-5 md:pt-4 ${
              menuDesktopRecolhido ? "md:pointer-events-none md:-translate-x-full md:opacity-0" : "md:translate-x-0 md:opacity-100"
            }`}
          >
            <Button
              variant="ghost"
              size="icon"
              className="relative z-10 md:hidden"
              onClick={() => {
                setMenuUsuarioMobileAberto(false);
                setMenuMobileAberto(true);
              }}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
              {quantidadeNotificacoes > 0 && (
                <span
                  className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-sidebar"
                  aria-label={`${quantidadeNotificacoes} notificações pendentes`}
                />
              )}
            </Button>

            <Link to="/inicio" className="absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0" aria-label="Ir para Início">
              <AppBrand />
            </Link>

            <button
              type="button"
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary text-sm font-bold uppercase text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 md:hidden"
              onClick={() => {
                setMenuMobileAberto(false);
                setMenuUsuarioMobileAberto((aberto) => !aberto);
              }}
              aria-label={`Abrir menu de ${nomePai}`}
              aria-haspopup="menu"
              aria-expanded={menuUsuarioMobileAberto}
            >
              {inicialResponsavel}
            </button>
          </div>

          <nav
            aria-label="Navegação principal"
            className={`hidden min-h-0 w-56 flex-1 overflow-y-auto transition-[transform,opacity] duration-200 ease-out md:flex md:flex-col md:px-1.5 md:pb-1 md:pt-1 ${
              menuDesktopRecolhido ? "md:pointer-events-none md:-translate-x-full md:opacity-0" : "md:translate-x-0 md:opacity-100"
            }`}
          >
            <MenuPrincipal />
            <AtalhosPrincipais />
            <div className="mt-1 border-t pt-2">
              <FeedbackButton />
            </div>
          </nav>

          <div
            className={`hidden w-56 shrink-0 p-1 transition-[transform,opacity] duration-200 ease-out md:block ${
              menuDesktopRecolhido ? "md:pointer-events-none md:-translate-x-full md:opacity-0" : "md:translate-x-0 md:opacity-100"
            }`}
          >
            <p className="px-1 pb-1 text-center text-[9px] leading-tight text-muted-foreground">© 2026 Combinado Família. Todos os direitos reservados.</p>
          </div>

          <button
            type="button"
            onClick={() => setMenuDesktopRecolhido((recolhido) => !recolhido)}
            aria-label={menuDesktopRecolhido ? "Abrir menu lateral" : "Fechar menu lateral"}
            aria-expanded={!menuDesktopRecolhido}
            className={`fixed top-5 z-40 hidden h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-[left,transform,background-color,color,box-shadow] duration-300 ease-out hover:bg-muted hover:text-foreground hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 md:flex ${
              menuDesktopRecolhido ? "left-2" : "left-[13.25rem]"
            }`}
          >
            {menuDesktopRecolhido ? <ChevronRight className="h-3.5 w-3.5 stroke-[2.25]" /> : <ChevronLeft className="h-3.5 w-3.5 stroke-[2.25]" />}
          </button>
        </aside>

        <AppPageContent className="pb-24 md:pb-10">
          <AppSystemStatus ehAdmin={ehAdmin} />
          <div className={`mb-5 hidden w-full items-center md:flex ${
            menuDesktopRecolhido
              ? "-mt-3 mx-auto justify-between border-b border-border pb-4"
              : "justify-end"
          }`}>
            {menuDesktopRecolhido && (
              <Link
                to="/inicio"
                className="opacity-100 transition-[opacity,transform] duration-300 ease-out"
                aria-label="Ir para Início"
              >
                <AppBrand />
              </Link>
            )}
            <div
              className="relative"
              onMouseEnter={() => setMenuUsuarioDesktopAberto(true)}
              onMouseLeave={() => setMenuUsuarioDesktopAberto(false)}
            >
              <div
                className="flex h-9 max-w-72 items-stretch overflow-hidden rounded-lg border border-border bg-background text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/40"
                aria-haspopup="menu"
                aria-expanded={menuUsuarioDesktopAberto}
              >
                <span className="flex min-w-0 items-center px-3">
                  <span className="truncate">{nomePai}</span>
                </span>
                <span className={`flex w-9 shrink-0 items-center justify-center border-l border-border bg-muted/25 text-muted-foreground transition-colors ${menuUsuarioDesktopAberto ? "bg-muted/70 text-foreground" : ""}`}>
                  <ChevronDown className={`h-4 w-4 stroke-[2.25] transition-transform duration-200 ${menuUsuarioDesktopAberto ? "rotate-180" : ""}`} />
                </span>
              </div>
              <div
                role="menu"
                className={`absolute right-0 top-full z-40 w-44 pt-1 transition-opacity ${menuUsuarioDesktopAberto ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
              >
                <div className="rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:bg-accent focus-visible:text-accent-foreground"
                    onClick={() => {
                      setMenuUsuarioDesktopAberto(false);
                      abrirGuia();
                    }}
                  >
                    <CircleHelp className="h-4 w-4" />
                    Ajuda
                  </button>
                  <Link
                    to="/admin"
                    role="menuitem"
                    onClick={() => setMenuUsuarioDesktopAberto(false)}
                    className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:bg-accent focus-visible:text-accent-foreground"
                  >
                    <UserCog className="h-4 w-4" />
                    Minha conta
                  </Link>
                  {ehAdmin && (
                    <Link
                      to="/administracao"
                      role="menuitem"
                      onClick={() => setMenuUsuarioDesktopAberto(false)}
                      className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:bg-accent focus-visible:text-accent-foreground"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Administração
                    </Link>
                  )}
                  <div className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Palette className="h-4 w-4" />
                      Aparência
                    </span>
                    <FilhoThemeToggle
                      modoEscuro={modoEscuro}
                      onChange={alterarModoEscuro}
                      comEstrela={false}
                    />
                  </div>
                  <div className="my-1 h-px bg-muted" />
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:bg-accent focus-visible:text-accent-foreground"
                    onClick={() => {
                      setMenuUsuarioDesktopAberto(false);
                      void runAction(sair);
                    }}
                    disabled={salvando}
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                  <div className="my-1 h-px bg-muted" />
                  <AppVersion className="block px-2.5 py-1 text-center text-[10px] leading-tight text-muted-foreground/80" />
                </div>
              </div>
            </div>
          </div>
          {etapa !== null && passoAtual && <section aria-label="Guia de primeiros passos" className="mb-6 border-l-4 border-primary bg-accent p-4 text-accent-foreground md:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-muted-foreground">Passo {etapa + 1} de {ETAPAS.length} · {passoAtual.label}</p><h2 className="mt-1 text-lg font-semibold">{passoAtual.title}</h2></div><Hint content="Pular guia"><button type="button" className={modalCloseInlineButtonClass} onClick={() => void runAction(encerrar)} disabled={salvando} aria-label="Pular guia"><ModalCloseIcon /></button></Hint></div><p className="mt-2 text-sm leading-relaxed">{passoAtual.rule}</p><div className="mt-4 flex flex-wrap items-center gap-2">{etapa > 0 && <Button variant="outline" size="sm" onClick={() => irParaEtapa(etapa - 1)}><ArrowLeft /> Anterior</Button>}<Button size="sm" onClick={() => etapa === ETAPAS.length - 1 ? void runAction(encerrar) : irParaEtapa(etapa + 1)} disabled={salvando}>{etapa === ETAPAS.length - 1 ? "Concluir" : "Próximo"} {etapa < ETAPAS.length - 1 && <ArrowRight />}</Button><Button variant="ghost" size="sm" onClick={() => void runAction(encerrar)} disabled={salvando}>Pular guia</Button></div></section>}
          <Outlet />
        </AppPageContent>

        <MenuInferiorMobile />

        {configuracaoInicialConcluida && totalPendencias > 0 && pathname !== "/ocorrencias" && (
          <Hint content="Fez / Não fez">
          <Button
            type="button"
            size="icon"
            onClick={() => navigate({ to: "/ocorrencias" })}
            style={{
              right: "calc(1rem + env(safe-area-inset-right))",
              bottom: "calc(5rem + env(safe-area-inset-bottom))",
            }}
            className="fixed z-30 h-12 w-12 rounded-full border border-primary/30 bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-95 md:hidden"
            aria-label="Ir para Fez / Não fez"
          >
            <Bell className="animate-notification-bell h-5 w-5" />
            <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-red-600 ring-2 ring-white" aria-hidden="true" />
          </Button>
          </Hint>
        )}

        {menuUsuarioMobileAberto && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/20 md:hidden"
              aria-label="Fechar menu do responsável"
              onClick={() => setMenuUsuarioMobileAberto(false)}
            />
            <div
              role="menu"
              aria-label="Menu do responsável"
              className="fixed z-50 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl md:hidden"
              style={{
                top: "calc(env(safe-area-inset-top) + 4.25rem)",
                right: "calc(env(safe-area-inset-right) + .75rem)",
              }}
            >
              <div className="flex items-start gap-3 border-b px-4 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold uppercase text-primary-foreground">
                  {inicialResponsavel}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="truncate text-sm font-semibold">{nomePai}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Responsável</p>
                </div>
                <button
                  type="button"
                  className={modalCloseInlineButtonClass}
                  onClick={() => setMenuUsuarioMobileAberto(false)}
                  aria-label="Fechar menu do responsável"
                >
                  <ModalCloseIcon />
                </button>
              </div>

              <div className="p-2">
                <Link
                  to="/admin"
                  role="menuitem"
                  onClick={() => setMenuUsuarioMobileAberto(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <UserCog className="h-4 w-4" />
                  Minha conta
                </Link>

                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    setMenuUsuarioMobileAberto(false);
                    abrirGuia();
                  }}
                >
                  <CircleHelp className="h-4 w-4" />
                  Ajuda
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  onClick={() => {
                    setMenuUsuarioMobileAberto(false);
                    setFeedbackAberto(true);
                  }}
                >
                  <MessageSquareText className="h-4 w-4" />
                  Feedback
                </button>

                {ehAdmin && (
                  <Link
                    to="/administracao"
                    role="menuitem"
                    onClick={() => setMenuUsuarioMobileAberto(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Administração
                  </Link>
                )}

                <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5">
                  <span className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                    <Palette className="h-4 w-4" />
                    Aparência
                  </span>
                  <FilhoThemeToggle
                    modoEscuro={modoEscuro}
                    onChange={alterarModoEscuro}
                    comEstrela={false}
                  />
                </div>

                <div className="my-2 h-px bg-border" />

                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
                  onClick={() => {
                    setMenuUsuarioMobileAberto(false);
                    void runAction(sair);
                  }}
                  disabled={salvando}
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            </div>
          </>
        )}

        {menuMobileAberto && <><button type="button" className="fixed inset-0 z-40 bg-black/40 md:hidden" aria-label="Fechar menu" onClick={() => setMenuMobileAberto(false)} /><aside className="native-safe-area fixed inset-y-0 left-0 z-50 w-[84vw] max-w-xs overflow-y-auto border-r bg-sidebar shadow-2xl md:hidden" aria-label="Menu lateral mobile">
          <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center border-b p-3"><span aria-hidden="true" /><Link to="/inicio" className="mx-auto" onClick={() => setMenuMobileAberto(false)} aria-label="Ir para Início"><AppBrand /></Link><button type="button" className={modalCloseInlineButtonClass} onClick={() => setMenuMobileAberto(false)} aria-label="Fechar menu"><ModalCloseIcon /></button></div>
          <nav className="flex flex-col px-2 pb-5 pt-4">
            <MenuPrincipal mobile />
            <AtalhosPrincipais mobile />

            <div className="mt-5 border-t px-2 pt-3">
              <AppVersion className="block text-center text-[9px] leading-tight text-muted-foreground" />
              <p className="mt-1 text-center text-[9px] leading-tight text-muted-foreground">
                © 2026 Combinado Família. Todos os direitos reservados.
              </p>
            </div>
          </nav>
        </aside></>}

        <FeedbackDialog
          open={feedbackAberto}
          onOpenChange={setFeedbackAberto}
          paginaOrigem={pathname}
        />

        <ClonarVigenciaDialog
          open={confirmarCloneMenuAberto}
          onOpenChange={setConfirmarCloneMenuAberto}
          onConfirm={() => void runAction(clonarPeloMenu)}
        />

        <Dialog open={aberto} onOpenChange={(open) => { if (!open) void runAction(encerrar); }}><DialogContent className="max-h-[90vh] max-w-md overflow-y-auto rounded-lg"><DialogHeader><DialogTitle>Boas-vindas ao Combinado</DialogTitle><DialogDescription>Um caminho simples para começar a organizar os combinados da família.</DialogDescription></DialogHeader><ol className="space-y-2 py-2">{ETAPAS.map((item, index) => <li key={item.to} className="flex gap-3 text-sm"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{index + 1}</span><span className="self-center font-medium">{item.title}</span></li>)}</ol><div className="flex flex-row justify-end gap-2"><Button variant="ghost" onClick={() => void runAction(encerrar)} disabled={salvando}>Pular guia</Button><Button onClick={() => irParaEtapa(0)}>Começar <ArrowRight /></Button></div></DialogContent></Dialog>
      </div>
    </>
  );
}
