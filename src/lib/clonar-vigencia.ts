import { supabase } from "@/integrations/supabase/client";
import { type Vigencia } from "@/lib/db";

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

  const inicioAposUltimaVigencia = Number.isFinite(maiorFim)
    ? maiorFim + 1_000
    : new Date(origem.data_fim).getTime() + 1_000;
  const inicio = new Date(Math.max(Date.now(), inicioAposUltimaVigencia));

  const duracaoVigenciaMs =
    new Date(origem.data_fim).getTime() - new Date(origem.data_inicio).getTime();
  const fim = new Date(inicio.getTime() + duracaoVigenciaMs);

  return {
    dataInicio: inicio.toISOString(),
    dataFim: fim.toISOString(),
  };
}

export async function clonarUltimaVigencia(
  vigencias: Vigencia[],
): Promise<CloneVigenciaResult> {
  const origem = obterUltimaVigencia(vigencias);
  if (!origem) throw new Error("Não há vigência para clonar");

  const { dataInicio, dataFim } = montarPeriodoClone(vigencias, origem);

  const { data, error } = await supabase.rpc("duplicar_vigencia_com_atribuicoes", {
    p_modelo_id: origem.id,
    p_data_inicio: dataInicio,
    p_data_fim: dataFim,
  });

  if (error) throw error;

  return {
    qtdAtribuicoes: data?.[0]?.qtd_atribuicoes ?? 0,
    vigenciaOrigem: origem,
  };
}
