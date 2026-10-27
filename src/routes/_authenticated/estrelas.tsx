import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Star } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { FilhoEstrelasPainel } from "@/components/FilhoEstrelasPainel";
import { FilhoAvatar } from "@/components/FilhoAvatar";
import { useFilhos } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/estrelas")({
  head: () => ({ meta: [
    { title: "Estrelas e recompensas — Combinado" },
    { name: "description", content: "Gerencie estrelas e recompensas dos filhos." },
  ] }),
  component: EstrelasPage,
});

function EstrelasPage() {
  const { data: filhos = [], isLoading } = useFilhos();
  const [filhoId, setFilhoId] = useState("");

  useEffect(() => {
    if (filhos.length === 0) {
      if (filhoId !== "") setFilhoId("");
      return;
    }

    if (!filhos.some((filho) => String(filho.id) === filhoId)) {
      setFilhoId(String(filhos[0].id));
    }
  }, [filhos, filhoId]);

  const filhoSelecionado = filhos.find((filho) => String(filho.id) === filhoId) ?? null;
  const indiceFilhoSelecionado = filhoSelecionado
    ? filhos.findIndex((filho) => filho.id === filhoSelecionado.id)
    : -1;

  function navegarFilho(direcao: -1 | 1) {
    if (indiceFilhoSelecionado < 0) return;
    const destino = filhos[indiceFilhoSelecionado + direcao];
    if (!destino) return;
    setFilhoId(String(destino.id));
  }

  return (
    <>
      <PageHeader
        title="Estrelas e recompensas"
        description="Cadastre recompensas e defina quantas estrelas são necessárias. Acompanhe."
        icon={<Star className="h-6 w-6" />}
      />

      {isLoading ? (
        <div className="flex min-h-48 items-center justify-center rounded-2xl border bg-card">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filhos.length === 0 ? (
        <EmptyState>Cadastre um filho antes de configurar estrelas e recompensas.</EmptyState>
      ) : (
        <div className="space-y-5">
          {filhoSelecionado && (
            <FilhoEstrelasPainel
              filho={filhoSelecionado}
              seletorFilho={
                <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 border-b border-border/60 px-3 py-2.5 sm:px-4 sm:py-3">
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
              }
            />
          )}
        </div>
      )}
    </>
  );
}
