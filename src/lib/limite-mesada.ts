import type { Filho, Vigencia } from "@/lib/db";
import { reais } from "@/lib/mesada";

export function erroLimiteMesada(
  filho: Pick<Filho, "nome" | "tem_mesada_opcional" | "valor_mesada">,
  vigencia: Pick<Vigencia, "valor_debito" | "qtd_ocorrencia">,
): string | null {
  if (filho.tem_mesada_opcional !== true || filho.valor_mesada === null || vigencia.valor_debito === null) return null;
  const totalCentavos = Math.round(vigencia.valor_debito * 100) * vigencia.qtd_ocorrencia;
  if (totalCentavos <= Math.round(filho.valor_mesada * 100)) return null;
  return `O desconto máximo da vigência (${reais(totalCentavos / 100)}) supera a mesada de ${filho.nome} (${reais(filho.valor_mesada)}). Ajuste os valores antes de vincular.`;
}