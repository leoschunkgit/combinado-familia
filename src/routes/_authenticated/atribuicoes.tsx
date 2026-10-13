import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Link2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AtribuicaoDialog } from "@/components/AtribuicaoDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { ResponsiveFilters } from "@/components/ResponsiveFilters";
import { Hint } from "@/components/Hint";
import { Pick } from "@/components/Pick";
import { msgErro, useFilhos, useFilhoTarefas, useTarefas, useVigencias } from "@/lib/db";
import { useActionLoading } from "@/components/ActionLoading";
import { compararVigencias, situacaoVigencia, VigenciaStatus } from "@/components/VigenciaStatus";

export const Route = createFileRoute("/_authenticated/atribuicoes")({
  validateSearch: (search: Record<string, unknown>) => ({
    adicionar: search.adicionar === "1",
    vigencia: typeof search.vigencia === "string" ? search.vigencia : undefined,
  }),
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
  const { adicionar, vigencia } = Route.useSearch();
  const qc = useQueryClient();
  const { runAction } = useActionLoading();
  const { data: vigencias = [] } = useVigencias();
  const { data: filhos = [] } = useFilhos();
  const { data: tarefas = [] } = useTarefas();
  const { data: existentes = [] } = useFilhoTarefas();
  const vigenciasScrollRef = useRef<HTMLDivElement>(null);
  const [novoAberto, setNovoAberto] = useState(adicionar);
  const [confirmarExclusao, setConfirmarExclusao] = useState<number | null>(null);
  const [vigenciaSelecionadaId, setVigenciaSelecionadaId] = useState<number | null>(
    vigencia ? Number(vigencia) : null,
  );
  const [filtrosRascunho, setFiltrosRascunho] = useState({ filho: "all", tarefa: "all" });
  const [filtrosAplicados, setFiltrosAplicados] = useState({ filho: "all", tarefa: "all" });

  const vigenciasOrdenadas = useMemo(() => [...vigencias].sort(compararVigencias), [vigencias]);
  const vigenciaAtiva = vigenciasOrdenadas.find(
    (item) => situacaoVigencia(item) === "andamento",
  );

  useEffect(() => {
    if (vigenciasOrdenadas.length === 0) {
      if (vigenciaSelecionadaId !== null) setVigenciaSelecionadaId(null);
      return;
    }

    const selecionadaAindaExiste = vigenciasOrdenadas.some((item) => item.id === vigenciaSelecionadaId);
    if (selecionadaAindaExiste) return;

    setVigenciaSelecionadaId(vigenciaAtiva?.id ?? vigenciasOrdenadas[0]?.id ?? null);
  }, [vigenciaAtiva?.id, vigenciaSelecionadaId, vigenciasOrdenadas]);

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
      if (count) { toast.error("Esta atribuição já tem registros de “Fez”/“Não fez” e não pode ser excluída."); return; }
    }

    const { error } = await supabase.from("t_filho_tarefa").delete().eq("id", id);
    if (error) { toast.error(msgErro(error)); return; }
    qc.invalidateQueries({ queryKey: ["filho_tarefas"] });
  }

  const faltando = vigencias.length === 0 || filhos.length === 0 || tarefas.length === 0;
  const filtradas = existentes.filter((item) =>
    (filtrosAplicados.filho === "all" || item.id_filho === Number(filtrosAplicados.filho)) &&
    (filtrosAplicados.tarefa === "all" || item.id_tarefa === Number(filtrosAplicados.tarefa))
  );

  function aplicarFiltros() {
    setFiltrosAplicados({ ...filtrosRascunho });
  }

  const atribuicoesVigenciaSelecionada = vigenciaSelecionadaId === null
    ? []
    : filtradas.filter((item) => item.id_vigencia === vigenciaSelecionadaId);

  const gruposFilhos = filhos
    .map((filhoItem) => ({
      filho: filhoItem,
      atribuicoes: atribuicoesVigenciaSelecionada.filter((item) => item.id_filho === filhoItem.id),
    }))
    .filter((grupo) => grupo.atribuicoes.length > 0);

  const formatadorDataCurta = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

  const periodoCurto = (item: (typeof vigencias)[number]) =>
    `${formatadorDataCurta.format(new Date(item.data_inicio))} – ${formatadorDataCurta.format(new Date(item.data_fim))}`;

  function rolarVigencias(direcao: "esquerda" | "direita") {
    const area = vigenciasScrollRef.current;
    if (!area) return;
    const distancia = Math.max(area.clientWidth * 0.75, 220);
    area.scrollBy({
      left: direcao === "direita" ? distancia : -distancia,
      behavior: "smooth",
    });
  }

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
          desktopClassName="md:grid-cols-[1fr_1fr_auto]"
          onApply={aplicarFiltros}
          hasActiveFilters={Object.values(filtrosAplicados).some((value) => value !== "all")}
          onClear={() => {
            const limpos = { filho: "all", tarefa: "all" };
            setFiltrosRascunho(limpos);
            setFiltrosAplicados(limpos);
          }}
          renderFilters={() => (
            <>
              <Pick label="Filho" value={filtrosRascunho.filho} onChange={(filho) => setFiltrosRascunho((atual) => ({ ...atual, filho }))} allLabel="Todos" options={filhos.map((filho) => ({ value: String(filho.id), label: filho.nome }))} />
              <Pick label="Tarefa" value={filtrosRascunho.tarefa} onChange={(tarefa) => setFiltrosRascunho((atual) => ({ ...atual, tarefa }))} allLabel="Todas" options={tarefas.map((tarefa) => ({ value: String(tarefa.id), label: tarefa.nome }))} />
            </>
          )}
        />
      )}

      {existentes.length === 0 ? (
        <EmptyState>Nenhuma atribuição ainda.</EmptyState>
      ) : vigenciasOrdenadas.length === 0 ? (
        <EmptyState>Nenhuma vigência cadastrada.</EmptyState>
      ) : (
        <>
          <section className="mb-5">
            <div className="mb-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vigências</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Deslize para os lados e escolha o período.</p>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => rolarVigencias("esquerda")}
                className="flex h-9 w-9 shrink-0 items-center justify-center bg-transparent p-0 text-muted-foreground transition-colors hover:bg-transparent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label="Ver vigências anteriores"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div
                ref={vigenciasScrollRef}
                className="flex min-w-0 flex-1 snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain scroll-smooth px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="tablist"
                aria-label="Selecionar vigência"
              >
                {vigenciasOrdenadas.map((item) => {
                  const selecionada = item.id === vigenciaSelecionadaId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={selecionada}
                      onClick={() => setVigenciaSelecionadaId(item.id)}
                      className="min-w-[150px] shrink-0 snap-start bg-transparent px-1 py-2 text-left transition-colors hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:min-w-[166px]"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold tabular-nums ${selecionada ? "text-primary" : "text-foreground"}`}>
                          {periodoCurto(item)}
                        </span>
                        {selecionada && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
                      </div>
                      <div className="mt-1.5">
                        <VigenciaStatus vigencia={item} />
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => rolarVigencias("direita")}
                className="flex h-9 w-9 shrink-0 items-center justify-center bg-transparent p-0 text-muted-foreground transition-colors hover:bg-transparent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label="Ver próximas vigências"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </section>

          {gruposFilhos.length === 0 ? (
            <EmptyState>Nenhuma atribuição encontrada para esta vigência e filtros.</EmptyState>
          ) : (
            <div className="space-y-4 md:space-y-5">
              {gruposFilhos.map(({ filho: filhoItem, atribuicoes: atribuicoesFilho }) => (
                <section key={filhoItem.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                  <div className="flex w-full items-center justify-between gap-4 border-b bg-muted/15 px-4 py-3.5 text-left sm:px-5 sm:py-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Filho</p>
                      <p className="truncate font-bold">{filhoItem.nome}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      {atribuicoesFilho.length} {atribuicoesFilho.length === 1 ? "tarefa" : "tarefas"}
                    </span>
                  </div>

                  <div className="bg-muted/10 p-2.5 sm:p-3">
                    <div className="space-y-2">
                      {atribuicoesFilho.map((e) => (
                        <div key={e.id} className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-white px-3 py-2.5 dark:bg-card sm:px-4 sm:py-3">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-medium leading-tight">{e.t_tarefa?.nome}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Hint content="Excluir atribuição">
                              <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 rounded-md" onClick={() => setConfirmarExclusao(e.id)} aria-label={`Excluir atribuição de ${e.t_tarefa?.nome ?? "tarefa"}`}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </Hint>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <AtribuicaoDialog
        open={novoAberto}
        onOpenChange={setNovoAberto}
        mode="NORMAL"
        vigenciaInicialId={vigenciaSelecionadaId ?? vigenciaAtiva?.id ?? null}
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
