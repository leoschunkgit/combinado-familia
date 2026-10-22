export const RESULTADOS_OCORRENCIA = [
  "FEZ",
  "NAO_FEZ",
  "NAO_PRECISOU",
] as const;

export type ResultadoOcorrencia = (typeof RESULTADOS_OCORRENCIA)[number];

type ResultadoOcorrenciaConfig = {
  rotulo: string;
  geraEstrela: boolean;
  permiteConsequencia: boolean;
};

export const resultadoOcorrenciaConfig: Record<
  ResultadoOcorrencia,
  ResultadoOcorrenciaConfig
> = {
  FEZ: {
    rotulo: "Fez",
    geraEstrela: true,
    permiteConsequencia: false,
  },
  NAO_FEZ: {
    rotulo: "Não fez",
    geraEstrela: false,
    permiteConsequencia: true,
  },
  NAO_PRECISOU: {
    rotulo: "Não precisou",
    geraEstrela: false,
    permiteConsequencia: false,
  },
};

export function isResultadoOcorrencia(
  tipo: string,
): tipo is ResultadoOcorrencia {
  return (RESULTADOS_OCORRENCIA as readonly string[]).includes(tipo);
}

export function rotuloResultado(tipo: string) {
  return isResultadoOcorrencia(tipo)
    ? resultadoOcorrenciaConfig[tipo].rotulo
    : tipo;
}

export function resultadoGeraEstrela(tipo: ResultadoOcorrencia) {
  return resultadoOcorrenciaConfig[tipo].geraEstrela;
}

export function resultadoPermiteConsequencia(tipo: ResultadoOcorrencia) {
  return resultadoOcorrenciaConfig[tipo].permiteConsequencia;
}
