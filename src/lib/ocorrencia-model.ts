export type ConsequenciaOcorrenciaLike = {
  tipo: "DESCONTO" | "PENALIDADE" | string;
  desconto_valor: number | null;
  penalidade_descricao: string | null;
  status: string;
};

export function rotuloStatusConsequencia(status: string) {
  switch (status) {
    case "APLICADO":
      return "Aplicado";
    case "PENDENTE":
      return "Pendente";
    case "CUMPRIDA":
      return "Cumprida";
    case "CANCELADA":
      return "Cancelada";
    case "ESTORNADO":
      return "Estornado";
    default:
      return status;
  }
}

export function rotuloStatusPenalidade(status: string) {
  return rotuloStatusConsequencia(status);
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

export function descreverConsequenciaOcorrenciaSemStatus(
  consequencia: ConsequenciaOcorrenciaLike | null | undefined,
  formatarMoeda: (valor: number) => string,
) {
  if (!consequencia) return "Sem consequência";

  if (consequencia.tipo === "DESCONTO") {
    const valor = formatarMoeda(Number(consequencia.desconto_valor ?? 0));
    return `Desconto: ${valor}`;
  }

  return `Penalidade: ${consequencia.penalidade_descricao ?? "—"}`;
}

export function descreverConsequenciaOcorrencia(
  consequencia: ConsequenciaOcorrenciaLike | null | undefined,
  formatarMoeda: (valor: number) => string,
) {
  const descricao = descreverConsequenciaOcorrenciaSemStatus(
    consequencia,
    formatarMoeda,
  );
  if (!consequencia) return descricao;
  return `${descricao} · ${rotuloStatusConsequencia(consequencia.status)}`;
}
