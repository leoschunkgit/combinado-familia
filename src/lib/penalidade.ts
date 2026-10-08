import type { Filho, Ocorrencia, Vigencia } from "@/lib/db";
import { usaDesconto } from "@/lib/mesada";

export function contarNaoFezPorFilhoVigencia(
  ocorrencias: Ocorrencia[],
  idFilho: number,
  idVigencia: number,
) {
  return ocorrencias.filter(
    (o) =>
      o.tipo !== "FEZ" &&
      o.t_filho_tarefa?.id_filho === idFilho &&
      o.t_filho_tarefa?.id_vigencia === idVigencia,
  ).length;
}

export function penalidadeJaFoiAplicada(
  vigencia: Pick<Vigencia, "id" | "penalidade" | "qtd_ocorrencia" | "valor_debito">,
  filhos: Filho[],
  ocorrencias: Ocorrencia[],
) {
  if (!vigencia.penalidade?.trim()) return false;

  return filhos.some((filho) => {
    if (usaDesconto(filho, vigencia)) return false;
    return contarNaoFezPorFilhoVigencia(ocorrencias, filho.id, vigencia.id) >= vigencia.qtd_ocorrencia;
  });
}

export function validarAlteracaoLimiteNaoFez(params: {
  vigencia: Pick<Vigencia, "id" | "penalidade" | "qtd_ocorrencia" | "valor_debito">;
  novoLimite: number;
  filhos: Filho[];
  ocorrencias: Ocorrencia[];
}) {
  const { vigencia, novoLimite, filhos, ocorrencias } = params;

  if (novoLimite === vigencia.qtd_ocorrencia) return { ok: true as const };

  if (penalidadeJaFoiAplicada(vigencia, filhos, ocorrencias)) {
    return {
      ok: false as const,
      mensagem: "O limite de “Não fez” não pode ser alterado depois que a penalidade já foi aplicada nesta vigência.",
    };
  }

  const filhosSemMesada = filhos.filter((filho) => !usaDesconto(filho, vigencia));
  const maiorTotalSemMesada = filhosSemMesada.reduce(
    (maior, filho) =>
      Math.max(maior, contarNaoFezPorFilhoVigencia(ocorrencias, filho.id, vigencia.id)),
    0,
  );

  if (novoLimite <= maiorTotalSemMesada) {
    return {
      ok: false as const,
      mensagem: `O novo limite deve ser maior que a quantidade atual de “Não fez” dos filhos sem mesada. Maior quantidade atual: ${maiorTotalSemMesada}.`,
    };
  }

  return { ok: true as const };
}

/** Identifica o registro de “Não fez” que alcança o limite atual de cada filho e vigência. */
export function ocorrenciasPenalizadas(ocorrencias: Ocorrencia[], vigencias: Vigencia[]): Set<number> {
  const limites = new Map(vigencias.map((v) => [v.id, v.qtd_ocorrencia]));
  const totais = new Map<string, number>();
  const ids = new Set<number>();
  for (const ocorrencia of [...ocorrencias].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id - b.id)) {
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
