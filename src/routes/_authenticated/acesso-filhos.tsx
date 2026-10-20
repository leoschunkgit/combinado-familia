import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Smartphone } from "lucide-react";
import { FilhoAppAccessManager } from "@/components/FilhoAppAccessDialog";
import { FilhoAvatar } from "@/components/FilhoAvatar";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { useFilhos } from "@/lib/db";

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
  const filhosScrollRef = useRef<HTMLDivElement | null>(null);
  const [filhoSelecionadoId, setFilhoSelecionadoId] = useState<number | null>(null);

  useEffect(() => {
    setFilhoSelecionadoId((atual) => {
      if (filhoFocado && filhos.some((filho) => filho.id === filhoFocado)) {
        return filhoFocado;
      }

      if (atual && filhos.some((filho) => filho.id === atual)) {
        return atual;
      }

      return filhos[0]?.id ?? null;
    });
  }, [filhoFocado, filhos]);

  useEffect(() => {
    const area = filhosScrollRef.current;
    if (!area || !filhoSelecionadoId) return;

    const frame = window.requestAnimationFrame(() => {
      const alvo = area.querySelector<HTMLElement>(
        `[data-filho="${filhoSelecionadoId}"]`,
      );
      if (!alvo) return;

      const destino =
        alvo.offsetLeft - (area.clientWidth - alvo.clientWidth) / 2;

      area.scrollTo({
        left: Math.max(0, destino),
        behavior: "smooth",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [filhoSelecionadoId]);

  function rolarFilhos(direcao: "esquerda" | "direita") {
    const area = filhosScrollRef.current;
    if (!area) return;

    const distancia = Math.max(area.clientWidth * 0.75, 220);
    area.scrollBy({
      left: direcao === "direita" ? distancia : -distancia,
      behavior: "smooth",
    });
  }

  const filhoSelecionado =
    filhos.find((filho) => filho.id === filhoSelecionadoId) ?? null;

  return (
    <>
      <PageHeader
        title="Acesso dos filhos"
        description="Gere chaves de acesso, veja os aparelhos vinculados e revogue acessos quando necessário."
        icon={<Smartphone className="h-6 w-6" />}
      />

      {filhos.length === 0 ? (
        <EmptyState>Nenhum filho cadastrado ainda.</EmptyState>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-1 border-t pt-3 pb-1">
            <button
              type="button"
              onClick={() => rolarFilhos("esquerda")}
              className="flex h-9 w-9 shrink-0 items-center justify-center bg-transparent p-0 text-muted-foreground transition-colors hover:bg-transparent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label="Ver filhos anteriores"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div
              ref={filhosScrollRef}
              className="flex min-w-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain scroll-smooth px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label="Selecionar filho para gerenciar acesso"
            >
              {filhos.map((filho) => {
                const selecionado = filho.id === filhoSelecionadoId;

                return (
                  <button
                    key={filho.id}
                    data-filho={filho.id}
                    type="button"
                    role="tab"
                    aria-selected={selecionado}
                    onClick={() => setFilhoSelecionadoId(filho.id)}
                    className={`shrink-0 snap-start rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                      selecionado
                        ? "border-b-2 border-muted-foreground/80 bg-transparent text-foreground"
                        : "border-b-2 border-transparent bg-transparent text-foreground hover:bg-transparent"
                    }`}
                    style={
                      selecionado && filho.cor?.trim()
                        ? { borderBottomColor: filho.cor.trim() }
                        : undefined
                    }
                  >
                    <span className="flex items-center gap-1.5">
                      <FilhoAvatar
                        nome={filho.nome}
                        cor={filho.cor}
                        avatar={filho.avatar === "menino" || filho.avatar === "menina" ? filho.avatar : null}
                        className="h-5 w-5"
                      />
                      <span>{filho.nome}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => rolarFilhos("direita")}
              className="flex h-9 w-9 shrink-0 items-center justify-center bg-transparent p-0 text-muted-foreground transition-colors hover:bg-transparent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label="Ver próximos filhos"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {filhoSelecionado && (
            <section className="overflow-hidden rounded-2xl border bg-card">
              <div className="flex min-w-0 items-center gap-2.5 border-b px-4 py-4 sm:px-5">
                <FilhoAvatar
                  nome={filhoSelecionado.nome}
                  cor={filhoSelecionado.cor}
                  avatar={filhoSelecionado.avatar === "menino" || filhoSelecionado.avatar === "menina" ? filhoSelecionado.avatar : null}
                  className="h-8 w-8"
                />
                <div className="min-w-0">
                  <h2 className="break-words text-sm font-semibold sm:text-base">
                    {filhoSelecionado.nome}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Chave de acesso e aparelhos vinculados
                  </p>
                </div>
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
