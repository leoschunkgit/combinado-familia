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
import { fmtDataHora, msgErro, useFilhos, useFilhoTarefas, useTarefas, useVigencias } from "@/lib/db";
import { useActionLoading } from "@/components/ActionLoading";
import { compararVigencias, situacaoVigencia, VigenciaStatus } from "@/components/VigenciaStatus";
import { FilhoAvatar } from "@/components/FilhoAvatar";
import { CollapseChevron } from "@/components/CollapseChevron";
import { TarefaIcone } from "@/components/TarefaIcone";
import { useVigenciaAutomatica } from "@/lib/vigencia-automatica";
import { lerPreferenciaLocal, salvarPreferenciaLocal } from "@/lib/preferencias-ui";

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

const CHAVE_ACCORDIONS_ATRIBUICOES = "combinado.ui.atribuicoes.accordions.v2";

function AtribuicoesPage() {
  const { adicionar, vigencia } = Route.useSearch();
  const qc = useQueryClient();
  const { runAction } = useActionLoading();
  const { data: vigencias = [] } = useVigencias();
  const { data: filhos = [] } = useFilhos();
  const { data: tarefas = [] } = useTarefas();
  const { data: existentes = [] } = useFilhoTarefas();
  const { ativa: vigenciaAutomaticaAtiva } = useVigenciaAutomatica();
  const [novoAberto, setNovoAberto] = useState(adicionar);
  const [confirmarExclusao, setConfirmarExclusao] = useState<number | null>(null);
  const [filhoContextoId, setFilhoContextoId] = useState<number | null>(null);
  const [filhoAbertoPorVigencia, setFilhoAbertoPorVigencia] = useState<Record<string, number | null>>(
    () => lerPreferenciaLocal<Record<string, number | null>>(CHAVE_ACCORDIONS_ATRIBUICOES, {}),
  );
  const [vigenciaSelecionadaId, setVigenciaSelecionadaId] = useState<number | null>(
    vigencia ? Number(vigencia) : null,
  );
  const [filtrosRascunho, setFiltrosRascunho] = useState({ filho: "all", tarefa: "all" });
  const [filtrosAplicados, setFiltrosAplicados] = useState({ filho: "all", tarefa: "all" });
  const ultimaVigenciaAtivaIdRef = useRef<number | null>(null);

  const vigenciasOrdenadas = useMemo(() => [...vigencias].sort(compararVigencias), [vigencias]);
  const vigenciaAtiva = vigenciasOrdenadas.find(
    (item) => situacaoVigencia(item) === "andamento",
  );
  const vigenciaSelecionada = vigenciasOrdenadas.find(
    (item) => item.id === vigenciaSelecionadaId,
  ) ?? null;
  const vigenciaSelecionadaFinalizada = Boolean(
    vigenciaSelecionada && situacaoVigencia(vigenciaSelecionada) === "finalizada",
  );
  const vigenciaSelecionadaAceitaAtribuicoes = Boolean(
    vigenciaSelecionada && situacaoVigencia(vigenciaSelecionada) !== "finalizada",
  );
  const filhoContexto = filhoContextoId === null
    ? null
    : filhos.find((filho) => filho.id === filhoContextoId) ?? null;

  useEffect(() => {
    if (vigenciasOrdenadas.length === 0) {
      if (vigenciaSelecionadaId !== null) setVigenciaSelecionadaId(null);
      return;
    }

    const selecionadaAindaExiste = vigenciasOrdenadas.some((item) => item.id === vigenciaSelecionadaId);
    if (selecionadaAindaExiste) return;

    setVigenciaSelecionadaId(vigenciaAtiva?.id ?? vigenciasOrdenadas[0]?.id ?? null);
  }, [vigenciaAtiva?.id, vigenciaSelecionadaId, vigenciasOrdenadas]);

  useEffect(() => {
    const vigenciaAtivaId = vigenciaAtiva?.id ?? null;
    if (vigenciaAtivaId === null) return;

    const vigenciaAtivaAnteriorId = ultimaVigenciaAtivaIdRef.current;

    if (
      vigenciaAutomaticaAtiva
      && vigenciaAtivaAnteriorId !== null
      && vigenciaAtivaAnteriorId !== vigenciaAtivaId
      && vigenciaSelecionadaId === vigenciaAtivaAnteriorId
    ) {
      setVigenciaSelecionadaId(vigenciaAtivaId);
    }

    ultimaVigenciaAtivaIdRef.current = vigenciaAtivaId;
  }, [vigenciaAtiva?.id, vigenciaAutomaticaAtiva, vigenciaSelecionadaId]);

  function alterarFilhoAberto(idVigencia: number, idFilho: number, aberto: boolean) {
    setFilhoAbertoPorVigencia((atual) => {
      const proximo = {
        ...atual,
        [String(idVigencia)]: aberto ? idFilho : null,
      };
      salvarPreferenciaLocal(CHAVE_ACCORDIONS_ATRIBUICOES, proximo);
      return proximo;
    });
  }

  async function excluir(id: number) {
    const { error } = await supabase.rpc("excluir_atribuicao_com_regra", {
      p_id_filho_tarefa: id,
    });

    if (error) {
      toast.error(msgErro(error));
      return;
    }

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

  const atribuicoesDaVigenciaSelecionada = vigenciaSelecionadaId === null
    ? []
    : existentes.filter((item) => item.id_vigencia === vigenciaSelecionadaId);

  const idsFilhosDisponiveis = new Set(
    atribuicoesDaVigenciaSelecionada.map((item) => item.id_filho),
  );
  const idsTarefasDisponiveis = new Set(
    atribuicoesDaVigenciaSelecionada.map((item) => item.id_tarefa),
  );

  const filhosDisponiveis = vigenciaSelecionadaAceitaAtribuicoes
    ? filhos
    : filhos.filter((filho) => idsFilhosDisponiveis.has(filho.id));
  const tarefasDisponiveis = tarefas.filter((tarefa) =>
    idsTarefasDisponiveis.has(tarefa.id),
  );

  function selecionarVigencia(id: number) {
    const atribuicoesAlvo = existentes.filter((item) => item.id_vigencia === id);
    const filhosAlvo = new Set(atribuicoesAlvo.map((item) => item.id_filho));
    const tarefasAlvo = new Set(atribuicoesAlvo.map((item) => item.id_tarefa));
    const vigenciaAlvo = vigenciasOrdenadas.find((item) => item.id === id) ?? null;
    const aceitaNovasAtribuicoes = Boolean(
      vigenciaAlvo && situacaoVigencia(vigenciaAlvo) !== "finalizada",
    );

    const ajustar = (atual: { filho: string; tarefa: string }) => ({
      filho:
        atual.filho === "all"
        || (aceitaNovasAtribuicoes
          ? filhos.some((filho) => filho.id === Number(atual.filho))
          : filhosAlvo.has(Number(atual.filho)))
          ? atual.filho
          : "all",
      tarefa:
        atual.tarefa === "all" || tarefasAlvo.has(Number(atual.tarefa))
          ? atual.tarefa
          : "all",
    });

    setVigenciaSelecionadaId(id);
    setFiltrosRascunho(ajustar);
    setFiltrosAplicados(ajustar);
  }

  const atribuicoesVigenciaSelecionada = vigenciaSelecionadaId === null
    ? []
    : filtradas.filter((item) => item.id_vigencia === vigenciaSelecionadaId);

  const gruposFilhos = filhos
    .filter((filhoItem) =>
      filtrosAplicados.filho === "all" || filhoItem.id === Number(filtrosAplicados.filho)
    )
    .map((filhoItem) => ({
      filho: filhoItem,
      atribuicoes: atribuicoesVigenciaSelecionada
        .filter((item) => item.id_filho === filhoItem.id)
        .sort((a, b) =>
          (a.t_tarefa?.nome ?? "").localeCompare(
            b.t_tarefa?.nome ?? "",
            "pt-BR",
            { sensitivity: "base" },
          ),
        ),
    }))
    .filter((grupo) =>
      vigenciaSelecionadaAceitaAtribuicoes && filtrosAplicados.tarefa === "all"
        ? true
        : grupo.atribuicoes.length > 0
    );

  const periodoCurto = (item: (typeof vigencias)[number]) =>
    `${fmtDataHora(item.data_inicio)} à ${fmtDataHora(item.data_fim)}`;

  const indiceVigenciaSelecionada = vigenciaSelecionada
    ? vigenciasOrdenadas.findIndex((item) => item.id === vigenciaSelecionada.id)
    : -1;

  function navegarVigencia(direcao: -1 | 1) {
    if (indiceVigenciaSelecionada < 0) return;
    const proxima = vigenciasOrdenadas[indiceVigenciaSelecionada + direcao];
    if (proxima) selecionarVigencia(proxima.id);
  }

  return (
    <>
      <PageHeader
        title="Atribuições"
        description="Associe tarefas aos filhos"
        icon={<Link2 className="h-6 w-6" />}
        action={<Button size="sm" className="h-8 px-2 text-xs sm:px-2.5" onClick={() => setNovoAberto(true)}><Plus className="h-3.5 w-3.5" /> Adicionar</Button>}
      />

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
              <Pick label="Filho" childIcons value={filtrosRascunho.filho} onChange={(filho) => setFiltrosRascunho((atual) => ({ ...atual, filho }))} allLabel="Todos" options={filhosDisponiveis.map((filho) => ({ value: String(filho.id), label: filho.nome, cor: filho.cor, avatar: filho.avatar === "menino" || filho.avatar === "menina" ? filho.avatar : null }))} />
              <Pick label="Tarefa" taskIcons value={filtrosRascunho.tarefa} onChange={(tarefa) => setFiltrosRascunho((atual) => ({ ...atual, tarefa }))} allLabel="Todas" options={tarefasDisponiveis.map((tarefa) => ({ value: String(tarefa.id), label: tarefa.nome }))} />
            </>
          )}
        />
      )}

      {vigenciasOrdenadas.length === 0 ? (
        <EmptyState>
          {vigenciaAutomaticaAtiva
            ? "Ainda não há uma vigência automática. Use Adicionar para fazer a primeira atribuição; o período será criado automaticamente ao salvar."
            : "Nenhuma vigência cadastrada."}
        </EmptyState>
      ) : (
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          {vigenciaSelecionada && (
            <div className="border-b border-border/60 bg-white px-3 py-2.5 dark:bg-background sm:px-4 sm:py-3">
              <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2">
                <span className="h-7 w-7" aria-hidden="true" />

                <div className="flex min-w-0 items-center justify-center gap-5 sm:gap-6">
                  <button
                    type="button"
                    onClick={() => navegarVigencia(1)}
                    disabled={indiceVigenciaSelecionada < 0 || indiceVigenciaSelecionada >= vigenciasOrdenadas.length - 1}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/50 text-muted-foreground shadow-sm transition-all duration-200 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-muted/50 disabled:hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label="Ir para a vigência anterior"
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={3} />
                  </button>

                  <p className="min-w-0 truncate whitespace-nowrap text-center text-base font-bold tabular-nums">
                    {periodoCurto(vigenciaSelecionada)}
                  </p>

                  <button
                    type="button"
                    onClick={() => navegarVigencia(-1)}
                    disabled={indiceVigenciaSelecionada <= 0}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/50 text-muted-foreground shadow-sm transition-all duration-200 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-muted/50 disabled:hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label="Ir para a próxima vigência"
                  >
                    <ChevronRight className="h-4 w-4" strokeWidth={3} />
                  </button>
                </div>

                <span className="h-7 w-7" aria-hidden="true" />
              </div>

              <div className="mt-2 flex justify-center">
                <VigenciaStatus vigencia={vigenciaSelecionada} />
              </div>
            </div>
          )}

          <div className="p-3 sm:p-4">
            {gruposFilhos.length === 0 ? (
              <EmptyState>
                {vigenciaSelecionadaAceitaAtribuicoes && filhos.length === 0
                  ? "Nenhum filho cadastrado."
                  : "Nenhuma atribuição encontrada para esta vigência e filtros."}
              </EmptyState>
            ) : (
              <div className="space-y-4 sm:space-y-5">
                {gruposFilhos.map(({ filho: filhoItem, atribuicoes: atribuicoesFilho }) => {
                  const temAtribuicoes = atribuicoesFilho.length > 0;
                  const aberto = Boolean(
                    temAtribuicoes
                    && vigenciaSelecionadaId !== null
                    && filhoAbertoPorVigencia[String(vigenciaSelecionadaId)] === filhoItem.id,
                  );

                  return (
                    <section key={filhoItem.id} className="overflow-hidden rounded-xl border bg-card">
                      <div className="flex w-full items-center justify-between gap-4 border-b bg-muted/15 px-4 py-3.5 text-left sm:px-5 sm:py-4">
                        <button
                          type="button"
                          className="group flex min-w-0 flex-1 items-center gap-2.5 text-left"
                          onClick={() => {
                            if (!temAtribuicoes) return;
                            if (vigenciaSelecionadaId !== null) alterarFilhoAberto(vigenciaSelecionadaId, filhoItem.id, !aberto);
                          }}
                          aria-expanded={temAtribuicoes ? aberto : undefined}
                          aria-label={temAtribuicoes ? `${aberto ? "Recolher" : "Expandir"} tarefas de ${filhoItem.nome}` : undefined}
                        >
                          {temAtribuicoes ? <CollapseChevron open={aberto} /> : <span className="h-5 w-5 shrink-0" aria-hidden="true" />}
                          <FilhoAvatar nome={filhoItem.nome} cor={filhoItem.cor} avatar={filhoItem.avatar === "menino" || filhoItem.avatar === "menina" ? filhoItem.avatar : null} className="h-7 w-7" />
                          <p className="min-w-0 truncate font-bold">{filhoItem.nome}</p>
                        </button>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
                          disabled={vigenciaSelecionadaFinalizada}
                          onClick={() => setFilhoContextoId(filhoItem.id)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add tarefa
                        </Button>
                      </div>

                      {temAtribuicoes && aberto && (
                        <div className="bg-muted/10 p-2.5 sm:p-3">
                          <div className="space-y-2">
                            {atribuicoesFilho.map((e) => (
                              <div key={e.id} className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-white px-3 py-2.5 dark:bg-card sm:px-4 sm:py-3">
                                <div className="flex min-w-0 items-start gap-2">
                                  <TarefaIcone nome={e.t_tarefa?.nome ?? "Tarefa"} className="mt-0.5" />
                                  <p className="min-w-0 break-words text-sm font-medium leading-tight">{e.t_tarefa?.nome}</p>
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
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      <AtribuicaoDialog
        open={novoAberto}
        onOpenChange={setNovoAberto}
        mode="NORMAL"
        vigenciaInicialId={vigenciaSelecionadaId ?? vigenciaAtiva?.id ?? null}
      />

      <AtribuicaoDialog
        open={filhoContexto !== null}
        onOpenChange={(open) => {
          if (!open) setFilhoContextoId(null);
        }}
        mode="CONTEXTO_FILHO_VIGENCIA"
        vigenciaInicialId={vigenciaSelecionadaId}
        filhoInicial={filhoContexto}
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
