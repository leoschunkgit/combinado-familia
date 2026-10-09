import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  beforeLoad: () => {
    throw redirect({ to: "/ocorrencias" });
  },
});
