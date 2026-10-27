import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Smartphone } from "lucide-react";
import { FilhoAppAccessManager } from "@/components/FilhoAppAccessDialog";
import { FilhoAvatar } from "@/components/FilhoAvatar";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { useFilhos } from "@/lib/db";
import { definirFilhoSelecionadoCompartilhado, obterFilhoSelecionadoCompartilhado } from "@/lib/filho-selecionado-contexto";

type AcessoFilhosSearch = {
  filho?: number;
};

export const Route = createFileRoute("/_authenticated/acesso-filhos")({
  validateSearch: (search: Record<string, unknown>): AcessoFilhosSearch => {
    const filho = Number(search["filho"]);
    return Number.isInteger(filho) && filho > 0 ? { filho } : {};
  },
  head: () => ({ meta: [
    { title: "Acesso dos filhos — Combinado" },
    { name: "description", content: "Gerencie chaves e aparelhos conectados ao acesso dos filhos." },
  ] }),
  component: AcessoFilhosPage,
});

function AcessoFilhosPage() {
  const { data: filhos = [] } = useFilhos();
  const { filho: filhoFocado } = Route.useSearch();
  const [filhoSelecionadoId, setFilhoSelecionadoId] = useState<number | null>(() => obterFilhoSelecionadoCompartilhado());

  useEffect(() => {
    setFilhoSelecionadoId((atual) => {
      if (filhoFocado && filhos.some((filho) => filho.id === filhoFocado)) {
        return filhoFocado;
      }

      if (atual && filhos.some((filho) => filho.id === atual)) {
        return atual;
      }

      const idInicial = filhos[0]?.id ?? null;
      if (idInicial) definirFilhoSelecionadoCompartilhado(idInicial);
      return idInicial;
    });
  }, [filhoFocado, filhos]);

  const filhoSelecionado =
    filhos.find((filho) => filho.id === filhoSelecionadoId) ?? null;
  const indiceFilhoSelecionado = filhoSelecionado
    ? filhos.findIndex((filho) => filho.id === filhoSelecionado.id)
    : -1;

  function navegarFilho(direcao: -1 | 1) {
    if (indiceFilhoSelecionado < 0) return;
    const proximo = filhos[indiceFilhoSelecionado + direcao];
    if (proximo) {
      setFilhoSelecionadoId(proximo.id);
      definirFilhoSelecionadoCompartilhado(proximo.id);
    }
  }

  return (
    <>
      <PageHeader
        title="Acesso dos filhos"
        icon={<Smartphone className="h-6 w-6" />}
      />

      {filhos.length === 0 ? (
        <EmptyState>Nenhum filho cadastrado ainda.</EmptyState>
      ) : (
        <div>
          {filhoSelecionado && (
            <section className="overflow-hidden rounded-2xl border bg-card">
              <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 border-b border-border/60 bg-white px-3 py-[18px] dark:bg-background sm:px-4">
                <span className="h-7 w-7" aria-hidden="true" />

                <div className="flex min-w-0 items-center justify-center gap-5 sm:gap-6">
                  <button
                    type="button"
                    onClick={() => navegarFilho(-1)}
                    disabled={indiceFilhoSelecionado <= 0}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/50 text-muted-foreground shadow-sm transition-all duration-200 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-muted/50 disabled:hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label="Ir para o filho anterior"
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={3} />
                  </button>

                  <div className="flex min-w-0 items-center justify-center gap-2">
                    <FilhoAvatar
                      nome={filhoSelecionado.nome}
                      cor={filhoSelecionado.cor}
                      avatar={filhoSelecionado.avatar === "menino" || filhoSelecionado.avatar === "menina" ? filhoSelecionado.avatar : null}
                      className="h-6 w-6 shrink-0"
                    />
                    <span className="truncate whitespace-nowrap text-center text-sm font-extrabold">
                      {filhoSelecionado.nome}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => navegarFilho(1)}
                    disabled={indiceFilhoSelecionado < 0 || indiceFilhoSelecionado >= filhos.length - 1}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/50 text-muted-foreground shadow-sm transition-all duration-200 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-muted/50 disabled:hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label="Ir para o próximo filho"
                  >
                    <ChevronRight className="h-4 w-4" strokeWidth={3} />
                  </button>
                </div>

                <span className="h-7 w-7" aria-hidden="true" />
              </div>

              <div className="p-4 sm:p-5">
                <FilhoAppAccessManager filho={filhoSelecionado} />
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
