import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicDocumentPage } from "@/components/PublicDocumentPage";

function ExclusaoConta() {
  return (
    <PublicDocumentPage>
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
            <h2 className="text-lg font-semibold">Como excluir a conta</h2>
            <p className="mt-2">
              A exclusão pode ser iniciada diretamente pelo titular dentro do Combinado Família, em
              “Minha conta” → “Excluir minha conta”. Para concluir, é necessário confirmar
              explicitamente a operação digitando “EXCLUIR”.
            </p>
            <p className="mt-2">
              Em caso de dificuldade para acessar a conta ou concluir a exclusão, entre em contato
              pelo email{" "}
              <a className="font-medium text-primary hover:underline" href="mailto:leoschunk@gmail.com">
                leoschunk@gmail.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Confirmação de identidade</h2>
            <p className="mt-2">
              A exclusão dentro do aplicativo exige que o usuário esteja autenticado na própria
              conta e confirme explicitamente a operação.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">O que acontece após a exclusão</h2>
            <p className="mt-2">
              Quando a exclusão é concluída, a conta de autenticação e os dados vinculados à conta
              são removidos do serviço, incluindo filhos, tarefas, vigências, atribuições,
              ocorrências e links públicos de acompanhamento. Os links públicos anteriormente
              gerados deixam de funcionar.
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
    </PublicDocumentPage>
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
