import type { FilhoTarefa, Ocorrencia, Vigencia } from "@/lib/db";
import { vigenciaEmAndamento } from "@/components/VigenciaStatus";

export const NOTIFICACAO_INICIO_HORA = 18;
export const NOTIFICACAO_FIM_HORA = 21;

export function dataBrasil(valor: Date | string = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof valor === "string" ? new Date(valor) : valor);
}

export function horaBrasil(agora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(agora);
  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]));
  return Number(mapa.hour) + Number(mapa.minute) / 60;
}

export function dentroDoHorarioDeNotificacao(agora = new Date()) {
  const hora = horaBrasil(agora);
  return hora >= NOTIFICACAO_INICIO_HORA && hora <= NOTIFICACAO_FIM_HORA;
}

export function pendenciasDoDia(
  vigencias: Vigencia[],
  atribuicoes: FilhoTarefa[],
  ocorrencias: Ocorrencia[],
  agora = new Date(),
) {
  const hoje = dataBrasil(agora);
  const ativas = new Set(vigencias.filter(vigenciaEmAndamento).map((v) => v.id));
  const registradosHoje = new Set(
    ocorrencias
      .filter((o) => dataBrasil(o.created_at) === hoje)
      .map((o) => o.id_filho_tarefa),
  );

  return atribuicoes.filter(
    (a) => ativas.has(a.id_vigencia) && !registradosHoje.has(a.id),
  );
}
