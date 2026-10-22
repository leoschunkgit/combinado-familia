export type ConsequenciaOcorrenciaLike = {
  tipo: "DESCONTO" | "PENALIDADE" | string;
  desconto_valor: number | null;
  penalidade_descricao: string | null;
  status: string;
};

export function rotuloStatusPenalidade(status: string) {
  switch (status) {
    case "PENDENTE":
      return "Pendente";
    case "SUSPENSA_REVISAO":
      return "Suspensa — em revisão";
    case "CUMPRIDA":
      return "Cumprida";
    case "CANCELADA":
      return "Cancelada";
    default:
      return status;
  }
}

export function consequenciaEhDescontoAplicado(
  consequencia: ConsequenciaOcorrenciaLike | null | undefined,
) {
  return consequencia?.tipo === "DESCONTO" && consequencia.status === "APLICADO";
}

export function consequenciaEhPenalidadePendente(
  consequencia: ConsequenciaOcorrenciaLike | null | undefined,
) {
  return consequencia?.tipo === "PENALIDADE" && consequencia.status === "PENDENTE";
}

export function consequenciaEhPenalidadeCumprida(
  consequencia: ConsequenciaOcorrenciaLike | null | undefined,
) {
  return consequencia?.tipo === "PENALIDADE" && consequencia.status === "CUMPRIDA";
}

export function descreverConsequenciaOcorrencia(
  consequencia: ConsequenciaOcorrenciaLike | null | undefined,
  formatarMoeda: (valor: number) => string,
) {
  if (!consequencia) return "Sem consequência";

  if (consequencia.tipo === "DESCONTO") {
    const valor = formatarMoeda(Number(consequencia.desconto_valor ?? 0));
    return consequencia.status === "ESTORNADO"
      ? `Desconto: ${valor} — estornado`
      : `Desconto: ${valor}`;
  }

  return `Penalidade: ${consequencia.penalidade_descricao ?? "—"} · ${rotuloStatusPenalidade(consequencia.status)}`;
}
