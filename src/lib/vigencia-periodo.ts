import { paraCampoDataHoraBrasil } from "@/lib/db";

export type PeriodoVigenciaModo = "DATAS" | "DIAS";

const dataHoraBrasil = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function calcularPeriodoPorDias(quantidade: string, inicioIso: string | null) {
  const dias = Number(quantidade);
  if (!inicioIso || !Number.isSafeInteger(dias) || dias < 1) return null;

  const inicio = new Date(inicioIso);
  const fim = new Date(inicio.getTime() + dias * 86_400_000);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return null;

  return {
    data_inicio: paraCampoDataHoraBrasil(inicio.toISOString()),
    data_fim: paraCampoDataHoraBrasil(fim.toISOString()),
    resumo: `${dataHoraBrasil.format(inicio)} até ${dataHoraBrasil.format(fim)}`,
  };
}

export function diasDaVigencia(inicioCampo: string, fimCampo: string) {
  const dataUtc = (valor: string) => {
    const partes = valor.slice(0, 10).split("-").map(Number);
    if (partes.length !== 3 || partes.some((n) => !Number.isFinite(n))) return null;
    return Date.UTC(partes[0], partes[1] - 1, partes[2]);
  };

  const inicio = dataUtc(inicioCampo);
  const fim = dataUtc(fimCampo);
  if (inicio === null || fim === null || fim < inicio) return null;

  return Math.floor((fim - inicio) / 86_400_000) + 1;
}
