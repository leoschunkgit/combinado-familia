import type { Ocorrencia } from "@/lib/db";
import { consequenciaEhDescontoAplicado } from "@/lib/ocorrencia-model";

export const reais = (valor: number) =>
  valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export function totalDescontosAplicados(ocorrencias: Ocorrencia[]) {
  return ocorrencias.reduce((total, ocorrencia) => {
    const consequencia = ocorrencia.t_ocorrencia_consequencia;
    return consequenciaEhDescontoAplicado(consequencia)
      ? total + Number(consequencia?.desconto_valor ?? 0)
      : total;
  }, 0);
}

export function saldoMesada(valorMesada: number | null, totalDescontos: number) {
  if (valorMesada === null) return null;
  return Math.max(0, valorMesada - Math.max(0, totalDescontos));
}
