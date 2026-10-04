import { createFileRoute, Link } from "@tanstack/react-router";
import { Home } from "lucide-react";

function ExclusaoConta() {
  return (
    <main className="native-safe-area min-h-screen bg-muted/30 px-4 py-6 sm:px-6 md:py-10">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border bg-background p-5 shadow-sm sm:p-6 md:p-8">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Home className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="font-display text-xl font-bold">Combinado</div>
            <div className="text-xs font-medium text-muted-foreground">família</div>
          </div>
        </div>

        <h1 className="text-2xl font-bold md:text-3xl">Exclusão de conta e dados</h1>

        <div className="mt-8 space-y-7 text-sm leading-6 text-foreground/90 md:text-base md:leading-7">
          <section>
            <p>
              O titular da conta pode solicitar a exclusão da conta do Combinado Família e dos dados
              associados a ela.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">O que pode ser excluído</h2>
            <p className="mt-2">
              A solicitação pode abranger os dados da conta do responsável e os dados vinculados à
              utilização do serviço, incluindo filhos cadastrados, tarefas, vigências, atribuições,
              ocorrências, histórico e demais registros associados à conta.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Como solicitar</h2>
            <p className="mt-2">
              O canal oficial para envio da solicitação será informado nesta página antes da
              publicação definitiva do aplicativo nas lojas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Confirmação de identidade</h2>
            <p className="mt-2">
              Para proteger a conta, poderá ser necessário confirmar que a solicitação foi feita
              pelo titular antes da exclusão.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Prazo e retenção</h2>
            <p className="mt-2">
              O prazo final de atendimento e eventuais hipóteses de retenção obrigatória serão
              informados nesta página antes da publicação definitiva.
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4 border-t pt-5">
          <Link to="/politica-de-privacidade" className="text-sm font-medium text-primary hover:underline">
            Política de Privacidade
          </Link>
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            Voltar para o Combinado Família
          </Link>
        </div>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/exclusao-de-conta")({
  head: () => ({
    meta: [
      { title: "Exclusão de conta e dados — Combinado Família" },
      {
        name: "description",
        content: "Informações sobre exclusão de conta e dados no Combinado Família.",
      },
      { property: "og:title", content: "Exclusão de conta e dados — Combinado Família" },
      {
        property: "og:description",
        content: "Saiba como solicitar a exclusão de conta e dados no Combinado Família.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExclusaoConta,
});
