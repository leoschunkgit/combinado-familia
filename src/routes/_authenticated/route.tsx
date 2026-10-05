import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Bell, CalendarRange, ClipboardCheck, LayoutDashboard, ListTodo, LogOut, Users, Link2, Home, CircleHelp, ArrowRight, ArrowLeft, X, Menu, UserCog, FileText, TriangleAlert, ListPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useActionLoading } from "@/components/ActionLoading";
import { OnboardingInicial } from "@/components/OnboardingInicial";
import { CheckinDiario } from "@/components/CheckinDiario";
import { useFilhos, useFilhoTarefas, useOcorrencias, useTarefas, useVigencias } from "@/lib/db";
import { pendenciasAnteriores, pendenciasDoDia, useDataBrasilAtual } from "@/lib/notificacoes";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/" });
    const user = data.user;
    const { data: pai } = await supabase.from("t_usuario_pai").select("id, nome").maybeSingle();
    let nome = pai?.nome;
    if (!pai) {
      const meta = user.user_metadata ?? {};
      nome = (meta["nome"] as string) || user.email?.split("@")[0] || "Responsável";
      await supabase.from("t_usuario_pai").insert({ nome, email: user.email ?? "" });
    }
    return { user, nomePai: nome ?? "" };
  },
  component: AuthenticatedLayout,
});

const NAV_DIA_A_DIA = [
  { to: "/inicio", label: "Início", icon: Home },
  { to: "/ocorrencias", label: "Fez / Não fez", icon: ClipboardCheck },
  { to: "/notificacoes", label: "Notificações", icon: Bell },
] as const;

const NAV_CONFIGURACAO = [
  { to: "/filhos", label: "Filhos", icon: Users },
  { to: "/tarefas", label: "Tarefas", icon: ListTodo },
  { to: "/vigencias", label: "Vigências", icon: CalendarRange },
  { to: "/atribuicoes", label: "Atribuições", icon: Link2 },
  { to: "/link-filhos", label: "Gerar Link / Filho", icon: Link2 },
] as const;

const NAV_ACOMPANHAMENTO = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/relatorio", label: "Relatório / Histórico", icon: FileText },
] as const;

const NAV_GRUPOS = [
  { titulo: "Dia a dia", itens: NAV_DIA_A_DIA },
  { titulo: "Configuração", itens: NAV_CONFIGURACAO },
  { titulo: "Acompanhamento", itens: NAV_ACOMPANHAMENTO },
] as const;

const ETAPAS = [
  { to: "/filhos", label: "Filhos", title: "Cadastre os filhos", rule: "Informe o nome de cada filho. Se marcar ‘Tem mesada’, preencha também o valor: nesse caso, a penalidade será descontada da mesada." },
  { to: "/tarefas", label: "Tarefas", title: "Crie as tarefas", rule: "Cadastre as tarefas que você quer combinar com os filhos. Depois, você poderá atribuir a mesma tarefa a mais de um filho." },
  { to: "/vigencias", label: "Vigências", title: "Defina o período e as regras", rule: "Escolha as datas, o limite de ‘Não fez’, a penalidade escrita e o desconto por ocorrência. Com mesada, aplica-se o desconto; sem mesada, a penalidade escrita ao atingir o limite." },
  { to: "/atribuicoes", label: "Atribuições", title: "Associe filhos e tarefas", rule: "Selecione a vigência, o filho e as tarefas. Depois que houver um ‘Não fez’ para esse filho na vigência, as atribuições não poderão ser editadas ou excluídas." },
  { to: "/ocorrencias", label: "Fez / Não fez", title: "Acompanhe os combinados", rule: "Registre ‘Não fez’ na data em que aconteceu. O limite soma todas as tarefas do mesmo filho na vigência; você pode consultar as datas e penalidades em Relatório / Histórico." },
] as const;

function AuthenticatedLayout() {
  const { nomePai, user } = Route.useRouteContext();
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
  const [saindo, setSaindo] = useState(false);
  const [modalPendenciasAberto, setModalPendenciasAberto] = useState(false);

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
    await qc.cancelQueries();
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/", replace: true });
  }

  const passoAtual = etapa === null ? null : ETAPAS[etapa];
  const configuracaoInicialConcluida = filhos.length > 0 && tarefas.length > 0 && vigencias.length > 0 && atribuicoes.length > 0;
  const mostrarAtalhoLinkFilho = configuracaoInicialConcluida && pathname !== "/filhos" && pathname !== "/link-filhos";
  const agoraBrasil = new Date(hoje + "T12:00:00-03:00");
  const pendenciasHoje = configuracaoInicialConcluida ? pendenciasDoDia(vigencias, atribuicoes, ocorrencias, agoraBrasil) : [];
  const pendenciasPassadas = configuracaoInicialConcluida ? pendenciasAnteriores(vigencias, atribuicoes, ocorrencias, agoraBrasil) : [];
  const totalPendencias = pendenciasHoje.length + pendenciasPassadas.length;
  const quantidadeNotificacoes = new Set([
    ...pendenciasHoje.map((p) => p.id_filho),
    ...pendenciasPassadas.map((p) => p.tarefa.id_filho),
  ]).size;

  const ContaLink = ({ mobile = false }: { mobile?: boolean }) => (
    <Link to="/admin" onClick={() => mobile && setMenuMobileAberto(false)} className={mobile ? "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" : "flex items-center gap-2.5 rounded-md px-2 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"} activeProps={{ className: "!bg-primary !text-primary-foreground" }}>
      <UserCog className={mobile ? "h-5 w-5" : "h-4 w-4"} /> Minha conta
    </Link>
  );

  return (
    <>
      {!saindo && pathname !== "/cadastro-unico" && <OnboardingInicial />}
      {!saindo && configuracaoInicialConcluida && <CheckinDiario open={modalPendenciasAberto} onOpenChange={setModalPendenciasAberto} />}
      <div className="native-safe-area min-h-screen md:flex">
        <aside className="border-b bg-sidebar md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
          <div className="relative flex items-center px-4 py-3 md:px-3 md:py-3">
            <Button variant="ghost" size="icon" className="relative z-10 md:hidden" onClick={() => setMenuMobileAberto(true)} aria-label="Abrir menu"><Menu className="h-5 w-5" />{quantidadeNotificacoes > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-sidebar" aria-label={`${quantidadeNotificacoes} notificações pendentes`} />}</Button>
            <Link to="/inicio" className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 md:static md:translate-x-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Home className="h-4 w-4" /></span>
              <span className="flex flex-col items-start leading-none"><span className="font-display text-lg font-bold">Combinado</span><span className="-mt-1 text-[11px] font-semibold tracking-wide text-muted-foreground">família</span></span>
            </Link>
          </div>

          <nav aria-label="Navegação principal" className="hidden min-h-0 flex-1 overflow-hidden md:flex md:flex-col md:px-2">
            <Link to="/cadastro-unico" className="mb-2 flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100" activeProps={{ className: "!border-amber-300 !bg-amber-100 !text-amber-950" }}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700"><ListPlus className="h-4 w-4" /></span>
              <span className="min-w-0"><span className="block">Cadastro único</span><span className="block text-[9px] font-medium leading-tight opacity-75">Cadastre tudo em um só fluxo</span></span>
            </Link>
            {NAV_GRUPOS.map((grupo) => <div key={grupo.titulo} className="mb-2">
              <p className="mb-0.5 px-2 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/70">{grupo.titulo}</p>
              <div className="space-y-0.5">{grupo.itens.map(({ to, label, icon: Icon }) => <Link key={to} to={to} className="flex items-center gap-2.5 rounded-md px-2 py-1 text-[13px] font-medium leading-tight text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" activeProps={{ className: "!bg-primary !text-primary-foreground" }}><Icon className="h-3.5 w-3.5" /><span className="min-w-0 flex-1">{label}</span>{to === "/notificacoes" && quantidadeNotificacoes > 0 && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-destructive-foreground">{quantidadeNotificacoes > 99 ? "99+" : quantidadeNotificacoes}</span>}</Link>)}</div>
            </div>)}
            <div className="mt-auto border-t pt-1.5">
              <Button variant="ghost" className="h-auto w-full justify-start gap-2.5 rounded-md px-2 py-1 text-[13px] text-muted-foreground" onClick={abrirGuia} aria-label="Ajuda: rever guia de primeiros passos"><CircleHelp className="h-4 w-4" /> Ajuda</Button>
              <ContaLink />
            </div>
          </nav>
          <div className="hidden shrink-0 p-1.5 md:block md:w-64">
            <div className="rounded-md bg-muted px-2 py-1"><p className="text-[8px] leading-tight text-muted-foreground">Conectado como</p><p className="truncate text-[11px] font-semibold leading-tight">{nomePai}</p><Button variant="outline" size="sm" className="mt-1 h-6 w-full text-[10px]" onClick={() => void runAction(sair)}><LogOut className="h-3 w-3" /> Sair</Button></div>
            <p className="mt-1 px-1 text-center text-[8px] leading-tight text-muted-foreground">© 2026 Combinado Família. Todos os direitos reservados.</p>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-10"><div className="mx-auto max-w-5xl">
          {configuracaoInicialConcluida && totalPendencias > 0 && pathname !== "/notificacoes" && (
            <section className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950 shadow-sm" role="status" aria-live="polite">
              <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600" />
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">“Fez” ou “Não fez” pendentes</p>
              <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 border-amber-300 bg-white/70 px-3 text-xs hover:bg-white" onClick={() => setModalPendenciasAberto(true)}>
                Resolver
              </Button>
            </section>
          )}
          {!pathname.startsWith("/cadastro-unico") && (
            <section className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950 shadow-sm">
              <ListPlus className="h-4 w-4 shrink-0 text-amber-600" />
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">Cadastro único</p>
              <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 border-amber-300 bg-white/70 px-3 text-xs hover:bg-white" onClick={() => navigate({ to: "/cadastro-unico" })}>
                Acessar
              </Button>
            </section>
          )}
          {etapa !== null && passoAtual && <section aria-label="Guia de primeiros passos" className="mb-6 border-l-4 border-primary bg-accent p-4 text-accent-foreground md:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-muted-foreground">Passo {etapa + 1} de {ETAPAS.length} · {passoAtual.label}</p><h2 className="mt-1 text-lg font-semibold">{passoAtual.title}</h2></div><Button variant="ghost" size="icon" onClick={() => void runAction(encerrar)} disabled={salvando} aria-label="Pular guia" title="Pular guia"><X /></Button></div><p className="mt-2 text-sm leading-relaxed">{passoAtual.rule}</p><div className="mt-4 flex flex-wrap items-center gap-2">{etapa > 0 && <Button variant="outline" size="sm" onClick={() => irParaEtapa(etapa - 1)}><ArrowLeft /> Anterior</Button>}<Button size="sm" onClick={() => etapa === ETAPAS.length - 1 ? void runAction(encerrar) : irParaEtapa(etapa + 1)} disabled={salvando}>{etapa === ETAPAS.length - 1 ? "Concluir" : "Próximo"} {etapa < ETAPAS.length - 1 && <ArrowRight />}</Button><Button variant="ghost" size="sm" onClick={() => void runAction(encerrar)} disabled={salvando}>Pular guia</Button></div></section>}
          <Outlet />
        </div></main>

        {mostrarAtalhoLinkFilho && <Link to="/link-filhos" style={{ right: "calc(1rem + env(safe-area-inset-right))", bottom: "calc(1rem + env(safe-area-inset-bottom))" }} className="fixed z-30 inline-flex h-10 w-auto max-w-[calc(100vw-2rem)] items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full border border-primary/20 bg-primary/70 px-3.5 text-xs font-semibold leading-none text-primary-foreground shadow-md backdrop-blur-md transition hover:bg-primary/85 active:scale-[0.98] md:hidden" aria-label="Ir para Gerar Link / Filho"><Link2 className="h-4 w-4 shrink-0" /><span className="block shrink-0">Link/Filho</span></Link>}

        {menuMobileAberto && <><button type="button" className="fixed inset-0 z-40 bg-black/40 md:hidden" aria-label="Fechar menu" onClick={() => setMenuMobileAberto(false)} /><aside className="native-safe-area fixed inset-y-0 left-0 z-50 w-[84vw] max-w-xs overflow-y-auto border-r bg-sidebar shadow-2xl md:hidden" aria-label="Menu lateral mobile">
          <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center border-b p-3"><span aria-hidden="true" /><Link to="/inicio" className="mx-auto flex items-center gap-2" onClick={() => setMenuMobileAberto(false)}><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Home className="h-4 w-4" /></span><span className="flex flex-col items-start leading-none"><span className="font-display text-lg font-bold">Combinado</span><span className="mt-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">família</span></span></Link><Button variant="ghost" size="icon" onClick={() => setMenuMobileAberto(false)} aria-label="Fechar menu"><X className="h-5 w-5" /></Button></div>
          <nav className="flex flex-col p-2 pb-28">
            <Link to="/cadastro-unico" onClick={() => setMenuMobileAberto(false)} className="mb-2 flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2.5 text-sm font-semibold text-amber-950 shadow-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700"><ListPlus className="h-4.5 w-4.5" /></span>
              <span><span className="block">Cadastro único</span><span className="block text-[10px] font-medium opacity-75">Cadastre tudo em um só fluxo</span></span>
            </Link>
            {NAV_GRUPOS.map((grupo) => <div key={grupo.titulo} className="mb-2">
              <p className="mb-0.5 px-2.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/70">{grupo.titulo}</p>
              <div className="space-y-0.5">{grupo.itens.map(({ to, label, icon: Icon }) => <Link key={to} to={to} onClick={() => setMenuMobileAberto(false)} className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" activeProps={{ className: "!bg-primary !text-primary-foreground" }}><Icon className="h-4 w-4" /><span className="min-w-0 flex-1">{label}</span>{to === "/notificacoes" && quantidadeNotificacoes > 0 && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-destructive-foreground">{quantidadeNotificacoes > 99 ? "99+" : quantidadeNotificacoes}</span>}</Link>)}</div>
            </div>)}
            <div className="border-t pt-2"><Button variant="ghost" className="w-full justify-start gap-3 px-3 py-2 text-sm text-muted-foreground" onClick={() => { setMenuMobileAberto(false); abrirGuia(); }}><CircleHelp className="h-5 w-5" /> Ajuda</Button><ContaLink mobile /></div>
          </nav>
          <div className="fixed bottom-3 left-3 right-auto w-[calc(min(84vw,20rem)-1.5rem)] max-w-[calc(20rem-1.5rem)]"><div className="rounded-lg bg-muted p-2.5"><p className="text-[10px] text-muted-foreground">Conectado como</p><p className="truncate text-xs font-semibold">{nomePai}</p><Button variant="outline" size="sm" className="mt-2 h-8 w-full text-xs" onClick={sair} disabled={salvando}><LogOut className="h-4 w-4" /> Sair</Button></div><p className="mt-2 px-1 text-center text-[9px] leading-tight text-muted-foreground">© 2026 Combinado Família. Todos os direitos reservados.</p></div>
        </aside></>}

        <Dialog open={aberto} onOpenChange={(open) => { if (!open) void runAction(encerrar); }}><DialogContent className="max-h-[90vh] max-w-md overflow-y-auto rounded-lg"><DialogHeader><DialogTitle>Boas-vindas ao Combinado</DialogTitle><DialogDescription>Um caminho simples para começar a organizar os combinados da família.</DialogDescription></DialogHeader><ol className="space-y-2 py-2">{ETAPAS.map((item, index) => <li key={item.to} className="flex gap-3 text-sm"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{index + 1}</span><span className="self-center font-medium">{item.title}</span></li>)}</ol><div className="flex flex-wrap justify-end gap-2"><Button variant="ghost" onClick={() => void runAction(encerrar)} disabled={salvando}>Pular guia</Button><Button onClick={() => irParaEtapa(0)}>Começar <ArrowRight /></Button></div></DialogContent></Dialog>
      </div>
    </>
  );
}
