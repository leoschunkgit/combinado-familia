import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { FilhoEstrelasPainel } from "@/components/FilhoEstrelasPainel";
import { Pick } from "@/components/Pick";
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

  return (
    <>
      <PageHeader
        title="Estrelas e recompensas"
        description="Acompanhe o saldo de cada filho, cadastre recompensas e controle os resgates."
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
          <section className="rounded-2xl border bg-card p-4">
            <div className="max-w-sm">
              <Pick
                label="Filho"
                childIcons
                value={filhoId}
                onChange={setFilhoId}
                placeholder="Selecione o filho"
                options={filhos.map((filho) => ({
                  value: String(filho.id),
                  label: filho.nome,
                  cor: filho.cor,
                  avatar: filho.avatar === "menino" || filho.avatar === "menina" ? filho.avatar : null,
                }))}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Cada tarefa marcada como “Fez” vale 1 estrela. O saldo continua acumulado mesmo quando uma vigência termina.
            </p>
          </section>

          {filhoSelecionado && <FilhoEstrelasPainel filho={filhoSelecionado} />}
        </div>
      )}
    </>
  );
}
