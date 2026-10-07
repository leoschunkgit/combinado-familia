import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AtribuicaoDialog } from "@/components/AtribuicaoDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { ResponsiveFilters } from "@/components/ResponsiveFilters";
import { Pick } from "@/components/Pick";
import { fmtVigencia, msgErro, useFilhos, useFilhoTarefas, useTarefas, useVigencias } from "@/lib/db";
import { useActionLoading } from "@/components/ActionLoading";
import { compararVigencias, situacaoVigencia, VigenciaStatus } from "@/components/VigenciaStatus";

export const Route = createFileRoute("/_authenticated/atribuicoes")({
  head: () => ({ meta: [
    { title: "Atribuições — Combinado" },
    { name: "description", content: "Associe tarefas aos filhos dentro de cada vigência." },
    { property: "og:title", content: "Atribuições — Combinado" },
    { property: "og:description", content: "Associe tarefas aos filhos dentro de cada vigência." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AtribuicoesPage,
});

function AtribuicoesPage() {
  const qc = useQueryClient();
  const { runAction } = useActionLoading();
  const { data: vigencias = [] } = useVigencias();
  const { data: filhos = [] } = useFilhos();
  const { data: tarefas = [] } = useTarefas();
  const { data: existentes = [] } = useFilhoTarefas();
  const [novoAberto, setNovoAberto] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState<number | null>(null);
  const [filtrosRascunho, setFiltrosRascunho] = useState({ vig: "all", filho: "all", tarefa: "all" });
  const [filtrosAplicados, setFiltrosAplicados] = useState({ vig: "all", filho: "all", tarefa: "all" });

  const vigenciasOrdenadas = [...vigencias].sort(compararVigencias);

  async function excluir(id: number) {
    const alvo = existentes.find((item) => item.id === id);
    if (!alvo) return;
    const periodo = vigencias.find((v) => v.id === alvo.id_vigencia);
    if (!periodo) return;

    const agora = Date.now();
    const futura = new Date(periodo.data_inicio).getTime() > agora;
    const finalizada = new Date(periodo.data_fim).getTime() < agora;

    if (finalizada) {
      toast.error("Atribuições de vigências finalizadas não podem ser excluídas");
      return;
    }

    if (!futura) {
      const { count, error: historicoErro } = await supabase
        .from("t_ocorrencia")
        .select("id", { count: "exact", head: true })
        .eq("id_filho_tarefa", alvo.id);
      if (historicoErro) { toast.error(msgErro(historicoErro)); return; }
      if (count) { toast.error("Esta atribuição já tem registros de Fez/Não fez e não pode ser excluída."); return; }
    }

    const { error } = await supabase.from("t_filho_tarefa").delete().eq("id", id);
    if (error) { toast.error(msgErro(error)); return; }
    qc.invalidateQueries({ queryKey: ["filho_tarefas"] });
  }

  const faltando = vigencias.length === 0 || filhos.length === 0 || tarefas.length === 0;
  const filtradas = existentes.filter((item) =>
    (filtrosAplicados.vig === "all" || item.id_vigencia === Number(filtrosAplicados.vig)) &&
    (filtrosAplicados.filho === "all" || item.id_filho === Number(filtrosAplicados.filho)) &&
    (filtrosAplicados.tarefa === "all" || item.id_tarefa === Number(filtrosAplicados.tarefa))
  );

  function aplicarFiltros() {
    setFiltrosAplicados({ ...filtrosRascunho });
  }

  const grupos = vigenciasOrdenadas
    .map((vigencia) => ({
      vigencia,
      filhos: filhos
        .map((filhoItem) => ({
          filho: filhoItem,
          atribuicoes: filtradas.filter((item) => item.id_vigencia === vigencia.id && item.id_filho === filhoItem.id),
        }))
        .filter((grupo) => grupo.atribuicoes.length > 0),
    }))
    .filter((grupo) => grupo.filhos.length > 0);

  const statusVigencia = (v: (typeof vigencias)[number]) => ({
    value: String(v.id),
    label: fmtVigencia(v),
    status: situacaoVigencia(v),
  });

  return (
    <>
      <PageHeader
        title="Atribuições"
        description="Associe tarefas aos filhos dentro de uma vigência."
        icon={<Link2 className="h-6 w-6" />}
        action={<Button size="sm" onClick={() => setNovoAberto(true)}><Plus className="h-4 w-4" /> Adicionar</Button>}
      />

      {faltando && (
        <div className="mb-6 rounded-2xl bg-accent/30 p-4 text-sm">
          Para atribuir, cadastre antes pelo menos uma vigência, um filho e uma tarefa.
        </div>
      )}

      {existentes.length > 0 && (
        <ResponsiveFilters
          desktopClassName="md:grid-cols-[1fr_1fr_1fr_auto]"
          onApply={aplicarFiltros}
          renderFilters={() => (
            <>
              <Pick label="Vigência" value={filtrosRascunho.vig} onChange={(vig) => setFiltrosRascunho((atual) => ({ ...atual, vig }))} allLabel="Todas" options={vigenciasOrdenadas.map(statusVigencia)} />
              <Pick label="Filho" value={filtrosRascunho.filho} onChange={(filho) => setFiltrosRascunho((atual) => ({ ...atual, filho }))} allLabel="Todos" options={filhos.map((filho) => ({ value: String(filho.id), label: filho.nome }))} />
              <Pick label="Tarefa" value={filtrosRascunho.tarefa} onChange={(tarefa) => setFiltrosRascunho((atual) => ({ ...atual, tarefa }))} allLabel="Todas" options={tarefas.map((tarefa) => ({ value: String(tarefa.id), label: tarefa.nome }))} />
            </>
          )}
        />
      )}

      {existentes.length === 0 ? (
        <EmptyState>Nenhuma atribuição ainda.</EmptyState>
      ) : filtradas.length === 0 ? (
        <EmptyState>Nenhuma atribuição encontrada para estes filtros.</EmptyState>
      ) : (
        <div className="space-y-4">
          {grupos.map(({ vigencia, filhos: gruposFilhos }) => {
            const totalVigencia = gruposFilhos.reduce((soma, grupo) => soma + grupo.atribuicoes.length, 0);
            return (
              <section key={vigencia.id} className="overflow-hidden rounded-2xl border bg-card">
                <div className="flex w-full items-center justify-between gap-3 border-b bg-primary/5 px-4 py-3 text-left sm:px-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Vigência</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="break-words font-semibold">{fmtVigencia(vigencia)}</p>
                        <VigenciaStatus vigencia={vigencia} />
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border">
                    {totalVigencia} {totalVigencia === 1 ? "tarefa" : "tarefas"}
                  </span>
                </div>

                <div className="divide-y">
                  {gruposFilhos.map(({ filho: filhoItem, atribuicoes: atribuicoesFilho }) => {
                    const chave = `${vigencia.id}|${filhoItem.id}`;
                    return (
                      <div key={chave}>
                        <div className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Filho</p>
                              <p className="truncate font-bold">{filhoItem.nome}</p>
                            </div>
                          </div>
                          <span className="shrink-0 text-xs font-medium text-muted-foreground">
                            {atribuicoesFilho.length} {atribuicoesFilho.length === 1 ? "tarefa" : "tarefas"}
                          </span>
                        </div>
                        <div className="border-t bg-muted/10 px-2 py-1.5 sm:px-3">
                          <div className="divide-y rounded-md border bg-background">
                            {atribuicoesFilho.map((e) => (
                              <div key={e.id} className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2.5 py-1.5 sm:px-3">
                                <div className="min-w-0">
                                  <p className="break-words text-sm font-medium leading-tight">{e.t_tarefa?.nome}</p>
                                </div>
                                <div className="flex shrink-0 items-center gap-0.5">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setConfirmarExclusao(e.id)} aria-label={`Excluir atribuição de ${e.t_tarefa?.nome ?? "tarefa"}`}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <AtribuicaoDialog
        open={novoAberto}
        onOpenChange={setNovoAberto}
        mode="NORMAL"
      />

      <Dialog open={confirmarExclusao !== null} onOpenChange={(open) => !open && setConfirmarExclusao(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader>
          <p>Tem certeza que deseja excluir esta atribuição?</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmarExclusao(null)}>Cancelar</Button>
            <Button type="button" variant="destructive" onClick={() => { if (confirmarExclusao !== null) void runAction(() => excluir(confirmarExclusao)); setConfirmarExclusao(null); }}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
