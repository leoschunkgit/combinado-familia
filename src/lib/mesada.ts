import type { Ocorrencia } from "@/lib/db";

export const reais = (valor: number) =>
  valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export function totalDescontosAplicados(ocorrencias: Ocorrencia[]) {
  return ocorrencias.reduce((total, ocorrencia) => {
    const consequencia = ocorrencia.t_ocorrencia_consequencia;
    return consequencia?.tipo === "DESCONTO" &&
      consequencia.status === "APLICADO"
      ? total + Number(consequencia.desconto_valor ?? 0)
      : total;
  }, 0);
}

export function saldoMesada(valorMesada: number | null, totalDescontos: number) {
  if (valorMesada === null) return null;
  return Math.max(0, valorMesada - Math.max(0, totalDescontos));
}
