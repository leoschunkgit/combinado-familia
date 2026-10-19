import { createFileRoute } from "@tanstack/react-router";
import { FezNaoFezPage, type FocoSolicitacaoTarefa } from "@/components/FezNaoFezPage";

type OcorrenciasSearch = {
  filho?: number;
  atribuicao?: number;
  data?: string;
  aviso?: number;
  revisao?: number;
};

function inteiroPositivo(valor: unknown) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : undefined;
}

function dataValida(valor: unknown) {
  return typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? valor
    : undefined;
}

export const Route = createFileRoute("/_authenticated/ocorrencias")({
  validateSearch: (search: Record<string, unknown>): OcorrenciasSearch => ({
    filho: inteiroPositivo(search["filho"]),
    atribuicao: inteiroPositivo(search["atribuicao"]),
    data: dataValida(search["data"]),
    aviso: inteiroPositivo(search["aviso"]),
    revisao: inteiroPositivo(search["revisao"]),
  }),
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
  const search = Route.useSearch();

  const foco: FocoSolicitacaoTarefa | undefined = search.atribuicao
    ? {
        idFilho: search.filho,
        idFilhoTarefa: search.atribuicao,
        data: search.data,
        idSolicitacao: search.aviso,
        idRevisao: search.revisao,
      }
    : undefined;

  return <FezNaoFezPage modo="todos" focoSolicitacao={foco} />;
}
