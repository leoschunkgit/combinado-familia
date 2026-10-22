import {
  fmtData,
  fmtDataHora,
  fmtVigencia,
  type Filho,
  type FilhoTarefa,
  type Ocorrencia,
  type Vigencia,
} from "@/lib/db";
import {
  reais,
  saldoMesada,
  totalDescontosAplicados,
} from "@/lib/mesada";
import {
  gerarRelatorioPdf,
  type RelatorioPdfDados,
} from "@/lib/relatorio-pdf";
import { situacaoVigencia } from "@/components/VigenciaStatus";
import { descreverConsequenciaOcorrencia } from "@/lib/ocorrencia-model";

function detalheOcorrencia(ocorrencia: Ocorrencia) {
  if (ocorrencia.tipo === "FEZ") {
    return undefined;
  }

  return descreverConsequenciaOcorrencia(
    ocorrencia.t_ocorrencia_consequencia,
    reais,
  );
}

function compararOcorrenciasPorData(a: Ocorrencia, b: Ocorrencia) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function statusVigencia(vigencia: Vigencia) {
  const status = situacaoVigencia(vigencia);
  return status === "andamento"
    ? "Em andamento"
    : status === "finalizada"
      ? "Finalizada"
      : "Irá começar";
}

export function podeExtrairPdfVigencia(
  vigencia: Vigencia,
  atribuicoes: FilhoTarefa[],
) {
  return (
    situacaoVigencia(vigencia) !== "futura" &&
    atribuicoes.some((atribuicao) => atribuicao.id_vigencia === vigencia.id)
  );
}

export async function extrairPdfVigencia(args: {
  vigencia: Vigencia;
  filhos: Filho[];
  atribuicoes: FilhoTarefa[];
  ocorrencias: Ocorrencia[];
}) {
  const { vigencia, filhos, atribuicoes, ocorrencias } = args;

  if (situacaoVigencia(vigencia) === "futura") {
    throw new Error(
      "Vigências que ainda não começaram não possuem PDF disponível.",
    );
  }

  const tarefasDaVigencia = atribuicoes.filter(
    (atribuicao) => atribuicao.id_vigencia === vigencia.id,
  );

  if (!tarefasDaVigencia.length) {
    throw new Error("Esta vigência ainda não possui atribuições para exportar.");
  }

  const gruposFilhos = filhos
    .map((filho) => {
      const tarefas = tarefasDaVigencia.filter(
        (atribuicao) => atribuicao.id_filho === filho.id,
      );
      const registros = tarefas.flatMap((tarefa) =>
        ocorrencias.filter(
          (ocorrencia) => ocorrencia.id_filho_tarefa === tarefa.id,
        ),
      );

      return { filho, tarefas, registros };
    })
    .filter(({ tarefas }) => tarefas.length > 0);

  const dadosPdf: RelatorioPdfDados = {
    geradoEm: fmtDataHora(new Date().toISOString()),
    filtros: {
      vigencia: fmtVigencia(vigencia),
      filho: "Todos",
      tarefa: "Todas",
    },
    vigencias: [
      {
        periodo: fmtVigencia(vigencia),
        status: statusVigencia(vigencia),
        resumoConsequencias:
          "Cada “Não fez” possui sua própria consequência: nenhuma, desconto ou penalidade.",
        filhos: gruposFilhos.map(({ filho, tarefas, registros }) => {
          const totalNaoFez = registros.filter(
            (registro) => registro.tipo === "NAO_FEZ",
          ).length;
          const totalPenalidadesPendentes = registros.filter(
            (registro) =>
              registro.tipo === "NAO_FEZ" &&
              registro.t_ocorrencia_consequencia?.tipo === "PENALIDADE" &&
              registro.t_ocorrencia_consequencia.status === "PENDENTE",
          ).length;
          const temMesada =
            filho.tem_mesada_opcional === true &&
            filho.valor_mesada !== null;
          const totalDescontado = totalDescontosAplicados(registros);
          const saldo = saldoMesada(filho.valor_mesada, totalDescontado);

          return {
            nome: filho.nome,
            cor: filho.cor,
            avatar:
              filho.avatar === "menino" || filho.avatar === "menina"
                ? filho.avatar
                : null,
            resumo:
              `Não fez: ${totalNaoFez} · Penalidades pendentes: ${totalPenalidadesPendentes}`,
            mesada: temMesada
              ? {
                  valor: reais(filho.valor_mesada ?? 0),
                  descontos: reais(totalDescontado),
                  saldo: reais(saldo ?? 0),
                }
              : undefined,
            tarefas: tarefas.map((tarefa) => ({
              nome: tarefa.t_tarefa?.nome || "Tarefa",
              registros: ocorrencias
                .filter(
                  (ocorrencia) => ocorrencia.id_filho_tarefa === tarefa.id,
                )
                .sort(compararOcorrenciasPorData)
                .map((registro) => ({
                  data: fmtData(registro.created_at),
                  resultado:
                    registro.tipo === "FEZ"
                      ? ("Fez" as const)
                      : ("Não fez" as const),
                  detalhe: detalheOcorrencia(registro),
                })),
            })),
          };
        }),
      },
    ],
  };

  await gerarRelatorioPdf(dadosPdf);
}
