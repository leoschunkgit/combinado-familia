import {
  fmtData,
  fmtDataHora,
  fmtVigencia,
  type Filho,
  type FilhoTarefa,
  type Ocorrencia,
  type Vigencia,
} from "@/lib/db";
import { reais, usaDesconto, valorDebitado } from "@/lib/mesada";
import { ocorrenciasPenalizadas } from "@/lib/penalidade";
import {
  gerarRelatorioPdf,
  type RelatorioPdfDados,
} from "@/lib/relatorio-pdf";
import { situacaoVigencia } from "@/components/VigenciaStatus";

function naoFez(ocorrencia: Ocorrencia) {
  return ocorrencia.tipo !== "FEZ";
}

function bonus(ocorrencia: Ocorrencia) {
  if (ocorrencia.tipo !== "FEZ") return "";
  if (
    ocorrencia.bonificacao_tipo === "TEXTO" &&
    ocorrencia.bonificacao_descricao
  ) {
    return ocorrencia.bonificacao_descricao;
  }
  if (
    ocorrencia.bonificacao_tipo === "VALOR" &&
    ocorrencia.bonificacao_valor != null
  ) {
    return reais(ocorrencia.bonificacao_valor);
  }
  return "Nenhuma";
}

function compararOcorrenciasPorData(a: Ocorrencia, b: Ocorrencia) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
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

  const penalizadas = ocorrenciasPenalizadas(ocorrencias, [vigencia]);

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
        penalidade: vigencia.penalidade || "Não cadastrada",
        limite: `${vigencia.qtd_ocorrencia} ocorrência(s)`,
        descontoMesada:
          vigencia.valor_debito !== null
            ? `${reais(vigencia.valor_debito)} por Não fez`
            : "Não cadastrado",
        filhos: gruposFilhos.map(({ filho, tarefas, registros }) => {
          const totalNaoFez = registros.filter(naoFez).length;
          const comDesconto = usaDesconto(filho, vigencia);
          const totalDescontado = comDesconto
            ? valorDebitado(filho, vigencia, totalNaoFez)
            : 0;
          const saldoMesada = Math.max(
            0,
            (filho.valor_mesada ?? 0) - totalDescontado,
          );

          return {
            nome: filho.nome,
            cor: filho.cor,
            avatar:
              filho.avatar === "menino" || filho.avatar === "menina"
                ? filho.avatar
                : null,
            resumo: comDesconto
              ? undefined
              : `Penalidade: ${vigencia.penalidade || "Não cadastrada"}`,
            mesada: comDesconto
              ? {
                  valor: reais(filho.valor_mesada ?? 0),
                  descontos: reais(totalDescontado),
                  saldo: reais(saldoMesada),
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
                  detalhe:
                    registro.tipo === "FEZ" && bonus(registro)
                      ? `Bonificação: ${bonus(registro)}`
                      : undefined,
                  penalidadeAtingida:
                    registro.tipo !== "FEZ" &&
                    !comDesconto &&
                    penalizadas.has(registro.id),
                })),
            })),
          };
        }),
      },
    ],
  };

  await gerarRelatorioPdf(dadosPdf);
}
