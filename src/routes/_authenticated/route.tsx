import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarRange, ClipboardCheck, ListTodo, LogOut, Users, Link2, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

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
      nome = (meta.nome as string) || user.email?.split("@")[0] || "Responsável";
      await supabase.from("t_usuario_pai").insert({
        nome,
        cpf: (meta.cpf as string) || "",
        email: user.email ?? "",
      });
    }
    return { user, nomePai: nome ?? "" };
  },
  component: AppLayout,
});

const NAV = [
  { to: "/ocorrencias", label: "Ocorrências", icon: ClipboardCheck },
  { to: "/atribuicoes", label: "Atribuições", icon: Link2 },
  { to: "/filhos", label: "Filhos", icon: Users },
  { to: "/tarefas", label: "Tarefas", icon: ListTodo },
  { to: "/vigencias", label: "Vigências", icon: CalendarRange },
] as const;

function AppLayout() {
  const { nomePai } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

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
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:px-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "!bg-primary !text-primary-foreground" }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
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
          <Outlet />
        </div>
      </main>
    </div>
  );
}
