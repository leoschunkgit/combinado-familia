import type { Filho, Vigencia } from "@/lib/db";

export const reais = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function valorDebitado(filho: Pick<Filho, "valor_mesada">, vigencia: Pick<Vigencia, "valor_debito" | "qtd_ocorrencia">, total: number) {
  const centavos = Math.round((vigencia.valor_debito ?? 0) * 100) * Math.min(Math.max(total, 0), vigencia.qtd_ocorrencia);
  return Math.min(Math.round((filho.valor_mesada ?? 0) * 100), centavos) / 100;
}

export function resumoMesada(filho: Pick<Filho, "valor_mesada">, vigencia: Pick<Vigencia, "valor_debito" | "qtd_ocorrencia">, total: number) {
  const debito = valorDebitado(filho, vigencia, total);
  return `Desconto: ${reais(debito)} · Mesada após desconto: ${reais(Math.max(0, (filho.valor_mesada ?? 0) - debito))}`;
}

export function descricaoPenalidade(vigencia: Pick<Vigencia, "tipo_penalidade" | "penalidade" | "valor_debito">) {
  return vigencia.tipo_penalidade === "mesada" ? `${reais(vigencia.valor_debito ?? 0)} por Não fez` : vigencia.penalidade;
}