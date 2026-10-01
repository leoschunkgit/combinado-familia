import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarRange, ClipboardCheck, History, ListTodo, LogOut, Users, Link2, Home, CircleHelp, ArrowRight, ArrowLeft, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/" });
    const user = data.user;
    // Garante o registro em T_USUARIO_PAI (criado no primeiro acesso)
    const { data: pai } = await supabase.from("t_usuario_pai").select("id, nome").maybeSingle();
    let nome = pai?.nome;
    if (!pai) {
      const meta = user.user_metadata ?? {};
      nome = (meta["nome"] as string) || user.email?.split("@")[0] || "Responsável";
      await supabase.from("t_usuario_pai").insert({
        nome,
        cpf: (meta["cpf"] as string) || "",
        email: user.email ?? "",
      });
    }
    return { user, nomePai: nome ?? "" };
  },
  component: AppLayout,
});

const NAV = [
  { to: "/ocorrencias", label: "Ocorrências", icon: ClipboardCheck },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/atribuicoes", label: "Atribuições", icon: Link2 },
  { to: "/filhos", label: "Filhos", icon: Users },
  { to: "/tarefas", label: "Tarefas", icon: ListTodo },
  { to: "/vigencias", label: "Vigências", icon: CalendarRange },
] as const;

const ETAPAS = [
  { to: "/filhos", label: "Filhos", title: "Cadastre os filhos", rule: "Informe o nome de cada filho. Se marcar ‘Tem mesada’, preencha também o valor: nesse caso, a penalidade será descontada da mesada." },
  { to: "/tarefas", label: "Tarefas", title: "Crie as tarefas", rule: "Cadastre as tarefas que você quer combinar com os filhos. Depois, você poderá atribuir a mesma tarefa a mais de um filho." },
  { to: "/vigencias", label: "Vigências", title: "Defina o período e as regras", rule: "Escolha as datas, o limite de ‘Não fez’, a penalidade escrita e o desconto por ocorrência. Com mesada, aplica-se o desconto; sem mesada, a penalidade escrita ao atingir o limite." },
  { to: "/atribuicoes", label: "Atribuições", title: "Associe filhos e tarefas", rule: "Selecione a vigência, o filho e as tarefas. Depois que houver um ‘Não fez’ para esse filho na vigência, as atribuições não poderão ser editadas ou excluídas." },
  { to: "/ocorrencias", label: "Ocorrências", title: "Acompanhe os combinados", rule: "Registre ‘Não fez’ na data em que aconteceu. O limite soma todas as tarefas do mesmo filho na vigência; você pode consultar as datas e penalidades no Histórico." },
] as const;

function AppLayout() {
  const { nomePai, user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(user.user_metadata?.["guia_concluido"] !== true);
  const [etapa, setEtapa] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function encerrar() {
    setAberto(false);
    setEtapa(null);
    if (user.user_metadata?.["guia_concluido"] === true) return;
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ data: { guia_concluido: true } });
    setSalvando(false);
    if (error) toast.error("Não foi possível salvar sua escolha. O guia poderá aparecer novamente no próximo acesso.");
  }

  function irParaEtapa(indice: number) {
    setAberto(false);
    setEtapa(indice);
    navigate({ to: ETAPAS[indice].to });
  }

  function abrirGuia() {
    setEtapa(null);
    setAberto(true);
  }

  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b bg-sidebar md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between p-4 md:p-6">
          <Link to="/ocorrencias" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Home className="h-5 w-5" />
            </span>
            <span className="font-display text-xl font-bold">Combinado</span>
          </Link>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={sair} aria-label="Sair">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
        <nav aria-label="Navegação principal" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:px-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${etapa !== null && ETAPAS[etapa].to === to ? "ring-2 ring-sidebar-ring ring-offset-2 ring-offset-sidebar" : ""}`}
              activeProps={{ className: "!bg-primary !text-primary-foreground" }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-3 pb-3 md:px-4">
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" onClick={abrirGuia} aria-label="Ajuda: rever guia de primeiros passos">
            <CircleHelp className="h-4 w-4" /> Ajuda
          </Button>
        </div>
        <div className="hidden p-4 md:absolute md:bottom-0 md:block md:w-64">
          <div className="rounded-xl bg-muted p-3">
            <p className="text-xs text-muted-foreground">Conectado como</p>
            <p className="truncate font-semibold">{nomePai}</p>
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={sair}>
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-10">
        <div className="mx-auto max-w-5xl">
          {etapa !== null && (
            <section aria-label="Guia de primeiros passos" className="mb-6 border-l-4 border-primary bg-accent p-4 text-accent-foreground md:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Passo {etapa + 1} de {ETAPAS.length} · {ETAPAS[etapa].label}</p>
                  <h2 className="mt-1 text-lg font-semibold">{ETAPAS[etapa].title}</h2>
                </div>
                <Button variant="ghost" size="icon" onClick={encerrar} disabled={salvando} aria-label="Pular guia" title="Pular guia"><X /></Button>
              </div>
              <p className="mt-2 text-sm leading-relaxed">{ETAPAS[etapa].rule}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {etapa > 0 && <Button variant="outline" size="sm" onClick={() => irParaEtapa(etapa - 1)}><ArrowLeft /> Anterior</Button>}
                <Button size="sm" onClick={() => etapa === ETAPAS.length - 1 ? encerrar() : irParaEtapa(etapa + 1)} disabled={salvando}>
                  {etapa === ETAPAS.length - 1 ? "Concluir" : "Próximo"} {etapa < ETAPAS.length - 1 && <ArrowRight />}
                </Button>
                <Button variant="ghost" size="sm" onClick={encerrar} disabled={salvando}>Pular guia</Button>
              </div>
            </section>
          )}
          <Outlet />
        </div>
      </main>
      <Dialog open={aberto} onOpenChange={(open) => { if (!open) void encerrar(); }}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto rounded-lg">
          <DialogHeader>
            <DialogTitle>Boas-vindas ao Combinado</DialogTitle>
            <DialogDescription>Um caminho simples para começar a organizar os combinados da família.</DialogDescription>
          </DialogHeader>
          <ol className="space-y-2 py-2">
            {ETAPAS.map((item, index) => (
              <li key={item.to} className="flex gap-3 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{index + 1}</span>
                <span className="self-center font-medium">{item.title}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={encerrar} disabled={salvando}>Pular guia</Button>
            <Button onClick={() => irParaEtapa(0)}>Começar <ArrowRight /></Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
