import type { Ocorrencia, Vigencia } from "@/lib/db";

/** Identifica o registro de “Não fez” que alcança o limite atual de cada filho e vigência. */
export function ocorrenciasPenalizadas(ocorrencias: Ocorrencia[], vigencias: Vigencia[]): Set<number> {
  const limites = new Map(vigencias.map((v) => [v.id, v.qtd_ocorrencia]));
  const totais = new Map<string, number>();
  const ids = new Set<number>();
  for (const ocorrencia of [...ocorrencias].sort((a, b) => a.id - b.id)) {
    if (ocorrencia.tipo === "FEZ") continue;
    const vinculo = ocorrencia.t_filho_tarefa;
    if (!vinculo) continue;
    const limite = limites.get(vinculo.id_vigencia);
    if (!limite) continue;
    const chave = `${vinculo.id_vigencia}:${vinculo.id_filho}`;
    const total = (totais.get(chave) ?? 0) + 1;
    totais.set(chave, total);
    if (total === limite) ids.add(ocorrencia.id);
  }
  return ids;
}
