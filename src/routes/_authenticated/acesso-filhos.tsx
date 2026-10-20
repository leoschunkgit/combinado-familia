import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { FilhoAppAccessManager } from "@/components/FilhoAppAccessDialog";
import { FilhoAvatar } from "@/components/FilhoAvatar";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { useFilhos } from "@/lib/db";
import { uiTypography } from "@/lib/ui-typography";

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
  const [filhosAbertos, setFilhosAbertos] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!filhoFocado || !filhos.some((filho) => filho.id === filhoFocado)) return;
    setFilhosAbertos((atuais) => ({ ...atuais, [filhoFocado]: true }));
  }, [filhoFocado, filhos]);

  return (
    <>
      <PageHeader
        title="Acesso dos filhos"
        description="Gere chaves de acesso, veja os aparelhos vinculados e revogue acessos quando necessário."
        icon={<Smartphone className="h-6 w-6" />}
      />

      <div className="space-y-3">
        {filhos.length === 0 && <EmptyState>Nenhum filho cadastrado ainda.</EmptyState>}

        {filhos.map((filho) => {
          const aberto = filhosAbertos[filho.id] === true;

          return (
            <CollapsibleSection
              key={filho.id}
              title={
                <span className="flex min-w-0 items-center gap-2.5">
                  <FilhoAvatar
                    nome={filho.nome}
                    cor={filho.cor}
                    avatar={filho.avatar === "menino" || filho.avatar === "menina" ? filho.avatar : null}
                    className="h-7 w-7"
                  />
                  <span className={`min-w-0 break-words ${uiTypography.secondaryTitle}`}>{filho.nome}</span>
                </span>
              }
              description="Chave de acesso e aparelhos vinculados"
              open={aberto}
              onOpenChange={(open) =>
                setFilhosAbertos((atuais) => ({ ...atuais, [filho.id]: open }))
              }
              contentClassName="p-4 sm:p-5"
            >
              <FilhoAppAccessManager filho={filho} />
            </CollapsibleSection>
          );
        })}
      </div>
    </>
  );
}
