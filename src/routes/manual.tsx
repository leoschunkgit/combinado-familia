import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Download, ExternalLink, Home } from "lucide-react";
import { AppBrand } from "@/components/AppBrand";

export const Route = createFileRoute("/manual")({
  head: () => ({
    meta: [
      { title: "Manual do Usuário | Combinado Família" },
      { name: "description", content: "Manual oficial do usuário do Combinado Família." },
    ],
  }),
  component: ManualPage,
});

const secoes = [
  "Primeiros passos",
  "Cadastro de filhos",
  "Tarefas",
  "Vigências",
  "Atribuições",
  "Fez, Não fez e Não precisou",
  "Mesada e penalidades",
  "Estrelas e recompensas",
  "Acesso do filho",
  "Notificações",
  "Histórico e PDF",
  "Dúvidas frequentes",
];

function ManualPage() {
  const pdfUrl =
    "https://radwzkgpgdcwyjcpfcqw.supabase.co/storage/v1/object/public/documentos-publicos/Manual-Combinado-Familia.pdf";

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link to="/" aria-label="Voltar para o início" className="shrink-0">
            <AppBrand />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Home className="h-4 w-4" />
            Início
          </Link>
        </header>

        <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BookOpen className="h-6 w-6" />
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Manual do Usuário
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            Consulte o passo a passo completo para usar o Combinado Família.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir manual
            </a>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              <Download className="h-4 w-4" />
              Baixar PDF
            </a>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border bg-card p-5 sm:p-8">
          <h2 className="text-xl font-semibold text-foreground">O que você encontra no manual</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {secoes.map((secao) => (
              <div key={secao} className="rounded-lg border px-4 py-3 text-sm text-foreground">
                {secao}
              </div>
            ))}
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Combinado é combinado. Em família também.
        </p>
      </div>
    </main>
  );
}
