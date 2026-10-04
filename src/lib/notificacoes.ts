import type { FilhoTarefa, Ocorrencia, Vigencia } from "@/lib/db";
import { vigenciaEmAndamento } from "@/components/VigenciaStatus";

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
