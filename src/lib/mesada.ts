import type { Filho, FilhoVigenciaMesada, Ocorrencia } from "@/lib/db";
import { consequenciaEhDescontoAplicado } from "@/lib/ocorrencia-model";

export const reais = (valor: number) =>
  valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export function resolverMesadaVigencia(
  filho: Pick<Filho, "tem_mesada" | "valor_mesada">,
  snapshot?: Pick<FilhoVigenciaMesada, "tem_mesada" | "valor_mesada"> | null,
) {
  const fonte = snapshot ?? filho;
  const temMesada = fonte.tem_mesada === true && fonte.valor_mesada !== null;

  return {
    temMesada,
    valorMesada: temMesada ? Number(fonte.valor_mesada) : null,
  };
}

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
