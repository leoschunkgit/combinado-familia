import type { Filho, FilhoTarefa, Ocorrencia, Vigencia } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
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

export function existeFilhoSemMesadaNoLimite(
  vigencia: Pick<Vigencia, "id" | "qtd_ocorrencia" | "valor_debito">,
  filhos: Filho[],
  ocorrencias: Ocorrencia[],
) {
  return filhos.some((filho) => {
    if (usaDesconto(filho, vigencia)) return false;
    return contarNaoFezPorFilhoVigencia(ocorrencias, filho.id, vigencia.id) >= vigencia.qtd_ocorrencia;
  });
}

export function penalidadeJaFoiAplicada(
  vigencia: Pick<Vigencia, "id" | "penalidade" | "qtd_ocorrencia" | "valor_debito">,
  filhos: Filho[],
  ocorrencias: Ocorrencia[],
) {
  if (!vigencia.penalidade?.trim()) return false;
  return existeFilhoSemMesadaNoLimite(vigencia, filhos, ocorrencias);
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


export type ResultadoRegistrarNaoFez =
  | {
      status: "PRECISA_PENALIDADE";
      totalAtual: number;
      novoTotal: number;
    }
  | {
      status: "SALVO";
      comDesconto: boolean;
      totalAtual: number;
      novoTotal: number;
      penalizado: boolean;
      penalidade: string;
    };

export async function registrarNaoFezComPenalidade(params: {
  tarefa: FilhoTarefa;
  filho?: Filho | undefined;
  vigenciaCompleta?: Vigencia | undefined;
  filhos: Filho[];
  ocorrencias: Ocorrencia[];
  dataIso: string;
  existente?: Ocorrencia | undefined;
  penalidadeTexto?: string | undefined;
}): Promise<ResultadoRegistrarNaoFez> {
  const {
    tarefa,
    filho,
    vigenciaCompleta,
    filhos,
    ocorrencias,
    dataIso,
    existente,
    penalidadeTexto,
  } = params;

  const vigencia = tarefa.t_vigencia;
  if (!vigencia) throw new Error("Vigência da atribuição não encontrada");

  const comDesconto = filho ? usaDesconto(filho, vigencia) : false;
  const totalAtual = contarNaoFezPorFilhoVigencia(
    ocorrencias,
    tarefa.id_filho,
    tarefa.id_vigencia,
  );

  if (!comDesconto && totalAtual >= vigencia.qtd_ocorrencia) {
    throw new Error("O limite de Não fez desta vigência já foi atingido");
  }

  const novoTotal = totalAtual + 1;
  const penalizado = !comDesconto && novoTotal >= vigencia.qtd_ocorrencia;
  const regraVigencia =
    vigenciaCompleta ?? {
      id: tarefa.id_vigencia,
      penalidade: vigencia.penalidade,
      qtd_ocorrencia: vigencia.qtd_ocorrencia,
      valor_debito: vigencia.valor_debito,
    };
  const penalidadeAtual = regraVigencia.penalidade?.trim() ?? "";
  const penalidadeInformada = penalidadeTexto?.trim() ?? "";
  const jaAplicada = penalidadeJaFoiAplicada(regraVigencia, filhos, ocorrencias);

  if (penalizado && !jaAplicada && !penalidadeInformada) {
    return { status: "PRECISA_PENALIDADE", totalAtual, novoTotal };
  }

  if (penalidadeInformada && (penalidadeInformada.length < 2 || penalidadeInformada.length > 200)) {
    throw new Error("A penalidade deve ter entre 2 e 200 caracteres");
  }

  const { data, error } = await supabase.rpc("registrar_nao_fez_com_penalidade", {
    p_id_filho_tarefa: tarefa.id,
    p_created_at: dataIso,
    p_id_ocorrencia: existente?.id ?? null,
    p_penalidade: penalidadeInformada || null,
  });

  if (error) throw error;

  const salvo = data?.[0];
  if (!salvo) throw new Error("Não foi possível confirmar o registro de Não fez");

  const totalConfirmado = salvo.novo_total;
  const penalizadoConfirmado = salvo.penalizado;
  const penalidadeConfirmada = salvo.penalidade?.trim() ?? penalidadeAtual;

  return {
    status: "SALVO",
    comDesconto,
    totalAtual,
    novoTotal: totalConfirmado,
    penalizado: penalizadoConfirmado,
    penalidade: penalidadeConfirmada,
  };
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
