import type { FilhoTarefa, Ocorrencia, Vigencia } from "@/lib/db";
import { vigenciaEmAndamento } from "@/components/VigenciaStatus";

export function dataBrasil(valor: Date | string = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof valor === "string" ? new Date(valor) : valor);
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
