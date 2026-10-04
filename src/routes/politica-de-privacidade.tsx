import { createFileRoute, Link } from "@tanstack/react-router";
import { Home } from "lucide-react";

function PoliticaPrivacidade() {
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

        <h1 className="text-2xl font-bold md:text-3xl">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: 04/10/2026</p>

        <div className="mt-8 space-y-7 text-sm leading-6 text-foreground/90 md:text-base md:leading-7">
          <section>
            <p>
              O Combinado Família é uma aplicação destinada à organização de tarefas, combinados e
              acompanhamentos familiares.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Dados tratados</h2>
            <p className="mt-2">
              A aplicação pode tratar informações fornecidas pelo usuário, como nome, endereço de
              email, nomes dos filhos cadastrados, tarefas, vigências, ocorrências, registros de
              “Fez” e “Não fez”, bonificações, penalidades e informações relacionadas a mesada,
              quando utilizadas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Finalidade</h2>
            <p className="mt-2">
              Esses dados são utilizados para autenticar e manter a conta do responsável, permitir o
              cadastro e organização de filhos, registrar tarefas, vigências e ocorrências, gerar
              histórico e relatórios, disponibilizar o painel de acompanhamento do filho e permitir
              o compartilhamento de links e relatórios.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Permissões do dispositivo</h2>
            <p className="mt-2">
              Na configuração atual, o aplicativo não solicita acesso nativo à câmera, localização,
              microfone, contatos, fotos, vídeos, áudio ou armazenamento externo desnecessário.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Painel público do filho</h2>
            <p className="mt-2">
              O responsável pode gerar um link de acompanhamento para um filho. Esse painel não
              exige login, funciona em modo somente leitura, utiliza um token de acesso e pode ser
              regenerado ou desativado pelo responsável.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Segurança</h2>
            <p className="mt-2">
              A aplicação utiliza infraestrutura de autenticação e banco de dados para armazenar e
              proteger as informações necessárias ao funcionamento do serviço. As comunicações são
              realizadas por conexão segura HTTPS.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Exclusão e atualização de dados</h2>
            <p className="mt-2">
              O responsável pode excluir a própria conta diretamente na área “Minha conta” do
              Combinado Família. A exclusão exige confirmação explícita e remove a conta de
              autenticação e os dados vinculados à conta, incluindo filhos, tarefas, vigências,
              atribuições, ocorrências e links públicos de acompanhamento.
            </p>
            <p className="mt-2">
              Após a exclusão, os links públicos anteriormente gerados para acompanhamento dos
              filhos deixam de funcionar. O usuário também pode atualizar os dados disponíveis na
              aplicação enquanto a conta estiver ativa.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Contato</h2>
            <p className="mt-2">
              Para dúvidas, suporte ou solicitações relacionadas à privacidade e aos dados pessoais,
              entre em contato pelo email{" "}
              <a className="font-medium text-primary hover:underline" href="mailto:leoschunk@gmail.com">
                leoschunk@gmail.com
              </a>.
            </p>
          </section>
        </div>

        <div className="mt-10 border-t pt-5">
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            Voltar para o Combinado Família
          </Link>
        </div>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/politica-de-privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Combinado Família" },
      {
        name: "description",
        content: "Política de Privacidade do Combinado Família.",
      },
      { property: "og:title", content: "Política de Privacidade — Combinado Família" },
      {
        property: "og:description",
        content: "Consulte a Política de Privacidade do Combinado Família.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PoliticaPrivacidade,
});
