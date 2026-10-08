import { supabase } from "@/integrations/supabase/client";
import {
  paraCampoDataHoraBrasil,
  paraIsoDataHoraBrasil,
  type Vigencia,
} from "@/lib/db";

export type CloneVigenciaResult = {
  qtdAtribuicoes: number;
  vigenciaOrigem: Vigencia;
};

export function obterUltimaVigencia(vigencias: Vigencia[]): Vigencia | null {
  if (vigencias.length === 0) return null;

  return [...vigencias].sort(
    (a, b) => new Date(b.data_fim).getTime() - new Date(a.data_fim).getTime(),
  )[0] ?? null;
}

function montarPeriodoClone(vigencias: Vigencia[], origem: Vigencia) {
  const maiorFim = vigencias.reduce((maior, vigencia) => {
    const fim = new Date(vigencia.data_fim).getTime();
    return fim > maior ? fim : maior;
  }, Number.NEGATIVE_INFINITY);

  const inicio = Number.isFinite(maiorFim)
    ? new Date(maiorFim)
    : new Date(origem.data_fim);
  inicio.setDate(inicio.getDate() + 1);

  const fim = new Date(inicio);
  fim.setMonth(fim.getMonth() + 1);

  return {
    dataInicio: paraCampoDataHoraBrasil(inicio.toISOString()),
    dataFim: paraCampoDataHoraBrasil(fim.toISOString()),
  };
}

export async function clonarUltimaVigencia(
  vigencias: Vigencia[],
): Promise<CloneVigenciaResult> {
  const origem = obterUltimaVigencia(vigencias);
  if (!origem) throw new Error("Não há vigência para clonar");

  if (origem.valor_debito === null || Number(origem.valor_debito) <= 0) {
    throw new Error("A última vigência não possui um desconto válido para clonagem");
  }

  const { dataInicio, dataFim } = montarPeriodoClone(vigencias, origem);

  const { data, error } = await supabase.rpc("duplicar_vigencia_com_atribuicoes", {
    p_modelo_id: origem.id,
    p_data_inicio: paraIsoDataHoraBrasil(dataInicio),
    p_data_fim: paraIsoDataHoraBrasil(dataFim),
    p_penalidade: null,
    p_qtd_ocorrencia: Number(origem.qtd_ocorrencia),
    p_valor_debito: Number(origem.valor_debito),
  });

  if (error) throw error;

  return {
    qtdAtribuicoes: data?.[0]?.qtd_atribuicoes ?? 0,
    vigenciaOrigem: origem,
  };
}
