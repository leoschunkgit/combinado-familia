import { createFileRoute } from "@tanstack/react-router";
import { FezNaoFezPage } from "@/components/FezNaoFezPage";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({
    meta: [
      { title: "Pendências — Combinado" },
      {
        name: "description",
        content:
          "Marque rapidamente os dias que ainda estão sem Fez ou Não fez.",
      },
    ],
  }),
  component: NotificacoesPage,
});

function NotificacoesPage() {
  return <FezNaoFezPage modo="pendentes" />;
}
