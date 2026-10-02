import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, ClipboardCheck, History, Link2, ListTodo, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/inicio")({
  component: Inicio,
});

function Inicio() {
  const etapas = [
    { numero: "1", titulo: "Cadastre os filhos", texto: "Comece informando quem participa dos combinados da família.", to: "/filhos", icon: Users },
    { numero: "2", titulo: "Crie as tarefas", texto: "Defina o que cada filho precisa fazer no dia a dia.", to: "/tarefas", icon: ListTodo },
    { numero: "3", titulo: "Faça as atribuições", texto: "Associe os filhos às tarefas e defina as vigências dos combinados.", to: "/atribuicoes", icon: Link2 },
    { numero: "4", titulo: "Registre as ocorrências", texto: "Marque quando um combinado não foi cumprido e acompanhe os registros.", to: "/ocorrencias", icon: ClipboardCheck },
    { numero: "5", titulo: "Consulte o histórico", texto: "Veja o que aconteceu ao longo das vigências e acompanhe os registros.", to: "/historico", icon: History },
  ];

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="grid items-center gap-8 p-6 md:grid-cols-[1.15fr_.85fr] md:p-10">
          <div>
            <p className="text-sm font-semibold text-primary">Bem-vindo ao Combinado</p>
            <h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">
              Organize os combinados da família de forma simples e clara.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              O Combinado ajuda você a organizar tarefas, definir regras para cada período e registrar quando um combinado não foi cumprido. Assim, toda a família sabe o que foi combinado e pode acompanhar o que acontece.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/filhos">
                  Cadastrar os filhos <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/tarefas">Conhecer as tarefas</Link>
              </Button>
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm" aria-label="Ilustração de uma família organizando seus combinados">
            <svg viewBox="0 0 420 300" role="img" className="h-auto w-full">
              <rect x="18" y="20" width="384" height="260" rx="28" className="fill-primary/5" />
              <path d="M75 160h270v88H75z" className="fill-background stroke-border" strokeWidth="3" />
              <path d="M55 160 210 58l155 102" className="fill-accent/20 stroke-primary" strokeWidth="5" strokeLinejoin="round" />
              <circle cx="145" cy="127" r="23" className="fill-primary/15 stroke-primary" strokeWidth="4" />
              <circle cx="210" cy="108" r="28" className="fill-primary/20 stroke-primary" strokeWidth="4" />
              <circle cx="275" cy="127" r="23" className="fill-primary/15 stroke-primary" strokeWidth="4" />
              <path d="M116 190c7-31 51-31 58 0v33h-58zm64-6c9-38 55-38 64 0v39h-64zm64 6c7-31 51-31 58 0v33h-58z" className="fill-primary/20 stroke-primary" strokeWidth="4" />
              <rect x="155" y="180" width="110" height="55" rx="10" className="fill-background stroke-primary" strokeWidth="4" />
              <path d="m177 207 10 10 19-22m18 10h24" className="stroke-primary" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="326" cy="67" r="25" className="fill-accent stroke-primary" strokeWidth="3" />
              <path d="m316 67 7 7 14-16" className="stroke-primary" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Como começar</h2>
          <p className="mt-1 text-sm text-muted-foreground">Siga estes passos para configurar seu primeiro combinado.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {etapas.map(({ numero, titulo, texto, to, icon: Icon }) => (
            <Link key={to} to={to} className="group rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/30">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{numero}</span>
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">{titulo}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{texto}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">Acessar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-muted/30 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <h2 className="font-semibold">A primeira ação é cadastrar os filhos</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Depois disso, você poderá criar as tarefas, fazer as atribuições e definir as vigências. Quando estiver tudo configurado, as ocorrências ficam prontas para serem registradas e o histórico para ser consultado.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
