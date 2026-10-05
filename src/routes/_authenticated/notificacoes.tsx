import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, CheckCircle2, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { fmtVigencia, useFilhos, useFilhoTarefas, useOcorrencias, useVigencias } from "@/lib/db";
import { pendenciasDoDia, useDataBrasilAtual } from "@/lib/notificacoes";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  component: Notificacoes,
});

function Notificacoes() {
  const { data: filhos = [] } = useFilhos();
  const { data: vigencias = [] } = useVigencias();
  const { data: atribuicoes = [] } = useFilhoTarefas();
  const { data: ocorrencias = [] } = useOcorrencias();
  const hoje = useDataBrasilAtual();
  const pendencias = pendenciasDoDia(vigencias, atribuicoes, ocorrencias, new Date(hoje + "T12:00:00-03:00"));
  const dataAtual = hoje.split("-").reverse().join("/");

  const grupos = vigencias
    .map((vigencia) => ({
      vigencia,
      filhos: filhos
        .map((filho) => ({
          filho,
          tarefas: pendencias.filter(
            (p) => p.id_vigencia === vigencia.id && p.id_filho === filho.id,
          ),
        }))
        .filter((grupo) => grupo.tarefas.length > 0),
    }))
    .filter((grupo) => grupo.filhos.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificações"
        description="Veja o que ainda precisa ser registrado hoje."
        icon={<Bell className="h-6 w-6" />}
      />

      {pendencias.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
          <h2 className="mt-3 text-lg font-semibold">Tudo em dia</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Todas as tarefas de hoje já têm Fez ou Não fez registrado.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border bg-primary/5 p-4">
            <p className="text-sm font-semibold">1 notificação pendente hoje</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Existe pelo menos uma tarefa de hoje ainda sem Fez ou Não fez.
            </p>
          </div>

          <div className="space-y-5">
            {grupos.map(({ vigencia, filhos: gruposFilhos }) => (
              <section key={vigencia.id} className="overflow-hidden rounded-2xl border bg-card">
                <div className="border-b bg-muted/30 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vigência</p>
                  <p className="mt-1 font-semibold">{fmtVigencia(vigencia)}</p>
                </div>

                <div className="divide-y">
                  {gruposFilhos.map(({ filho, tarefas }) => (
                    <div key={filho.id} className="p-4">
                      <p className="font-bold">{filho.nome}</p>
                      <ul className="mt-2 space-y-2">
                        {tarefas.map((tarefa) => (
                          <li key={tarefa.id} className="grid gap-1 rounded-lg bg-muted/30 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-3">
                            <span className="min-w-0 break-words font-medium">{tarefa.t_tarefa?.nome}</span>
                            <span className="text-xs text-muted-foreground sm:text-sm">{dataAtual}</span>
                            <span className="w-fit shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">Pendente</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="flex justify-end">
            <Button asChild>
              <Link to="/inicio">
                <ClipboardCheck className="h-4 w-4" />
                Resolver agora
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
