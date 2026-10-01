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

export function usaDesconto(filho: Pick<Filho, "tem_mesada_opcional" | "valor_mesada">, vigencia: Pick<Vigencia, "valor_debito">) {
  return filho.tem_mesada_opcional === true && filho.valor_mesada !== null && vigencia.valor_debito !== null;
}

export function descricaoPenalidade(vigencia: Pick<Vigencia, "penalidade" | "valor_debito">) {
  return `Penalidade escrita: ${vigencia.penalidade || "Não cadastrada"} · Desconto da mesada: ${vigencia.valor_debito !== null ? `${reais(vigencia.valor_debito)} por Não fez` : "Não cadastrado"}`;
}