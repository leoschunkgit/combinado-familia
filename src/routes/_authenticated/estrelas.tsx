import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Star } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { FilhoEstrelasPainel } from "@/components/FilhoEstrelasPainel";
import { FilhoAvatar } from "@/components/FilhoAvatar";
import { useFilhos } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/estrelas")({
  head: () => ({ meta: [
    { title: "Estrelas e recompensas — Combinado" },
    { name: "description", content: "Gerencie estrelas, recompensas e resgates dos filhos." },
  ] }),
  component: EstrelasPage,
});

function EstrelasPage() {
  const { data: filhos = [], isLoading } = useFilhos();
  const filhosScrollRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    const area = filhosScrollRef.current;
    if (!area || !filhoId) return;

    const frame = window.requestAnimationFrame(() => {
      const alvo = area.querySelector<HTMLElement>(`[data-filho="${filhoId}"]`);
      if (!alvo) return;

      const destino = alvo.offsetLeft - (area.clientWidth - alvo.clientWidth) / 2;
      area.scrollTo({
        left: Math.max(0, destino),
        behavior: "smooth",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [filhoId]);

  function rolarFilhos(direcao: "esquerda" | "direita") {
    const area = filhosScrollRef.current;
    if (!area) return;

    const distancia = Math.max(area.clientWidth * 0.75, 220);
    area.scrollBy({
      left: direcao === "direita" ? distancia : -distancia,
      behavior: "smooth",
    });
  }

  const filhoSelecionado = filhos.find((filho) => String(filho.id) === filhoId) ?? null;

  return (
    <>
      <PageHeader
        title="Estrelas e recompensas"
        description="Acompanhe o mérito de cada filho, cadastre recompensas e controle os resgates."
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
          <section className="border-b pb-4">
            <div className="flex items-center gap-1">
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
                aria-label="Selecionar filho para estrelas e recompensas"
              >
                {filhos.map((filho) => {
                  const selecionado = String(filho.id) === filhoId;

                  return (
                    <button
                      key={filho.id}
                      data-filho={filho.id}
                      type="button"
                      role="tab"
                      aria-selected={selecionado}
                      onClick={() => setFilhoId(String(filho.id))}
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

            <p className="mt-2.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              O primeiro “Fez” de cada tarefa em cada dia concede 1 estrela. As estrelas conquistadas são permanentes e continuam com o filho mesmo quando a vigência termina.
            </p>
          </section>

          {filhoSelecionado && <FilhoEstrelasPainel filho={filhoSelecionado} />}
        </div>
      )}
    </>
  );
}
