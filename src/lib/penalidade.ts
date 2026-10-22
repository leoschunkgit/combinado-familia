import type { Ocorrencia } from "@/lib/db";
import {
  consequenciaEhPenalidadePendente,
} from "@/lib/ocorrencia-model";

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
      consequenciaEhPenalidadePendente(
        ocorrencia.t_ocorrencia_consequencia,
      ),
  );
}
