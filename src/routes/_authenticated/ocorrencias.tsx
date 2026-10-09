import { createFileRoute } from "@tanstack/react-router";
import { FezNaoFezPage } from "@/components/FezNaoFezPage";

export const Route = createFileRoute("/_authenticated/ocorrencias")({
  head: () => ({
    meta: [
      { title: "Fez / Não fez — Combinado" },
      {
        name: "description",
        content:
          "Registre e consulte Fez / Não fez de cada filho, tarefa e data por vigência.",
      },
    ],
  }),
  component: OcorrenciasPage,
});

function OcorrenciasPage() {
  return <FezNaoFezPage modo="todos" />;
}
