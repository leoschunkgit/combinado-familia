import type { Ocorrencia } from "@/lib/db";

export function contarNaoFezPorFilhoVigencia(
  ocorrencias: Ocorrencia[],
  idFilho: number,
  idVigencia: number,
) {
  return ocorrencias.filter(
    (ocorrencia) =>
      ocorrencia.tipo === "NAO_FEZ" &&
      ocorrencia.t_filho_tarefa?.id_filho === idFilho &&
      ocorrencia.t_filho_tarefa?.id_vigencia === idVigencia,
  ).length;
}

export function penalidadesPendentes(ocorrencias: Ocorrencia[]) {
  return ocorrencias.filter(
    (ocorrencia) =>
      ocorrencia.tipo === "NAO_FEZ" &&
      ocorrencia.t_ocorrencia_consequencia?.tipo === "PENALIDADE" &&
      ocorrencia.t_ocorrencia_consequencia.status === "PENDENTE",
  );
}

export function penalidadesSuspensasEmRevisao(ocorrencias: Ocorrencia[]) {
  return ocorrencias.filter(
    (ocorrencia) =>
      ocorrencia.tipo === "NAO_FEZ" &&
      ocorrencia.t_ocorrencia_consequencia?.tipo === "PENALIDADE" &&
      ocorrencia.t_ocorrencia_consequencia.status === "SUSPENSA_REVISAO",
  );
}
