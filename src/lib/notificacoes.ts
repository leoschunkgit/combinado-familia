import { useEffect, useState } from "react";
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



export type PendenciaAnterior = {
  tarefa: FilhoTarefa;
  data: string;
};

function proximoDiaBrasil(data: string) {
  const d = new Date(data + "T12:00:00-03:00");
  d.setDate(d.getDate() + 1);
  return dataBrasil(d);
}

export function pendenciasAnteriores(
  vigencias: Vigencia[],
  atribuicoes: FilhoTarefa[],
  ocorrencias: Ocorrencia[],
  agora = new Date(),
): PendenciaAnterior[] {
  const hoje = dataBrasil(agora);
  const vigenciasAtivas = vigencias.filter(vigenciaEmAndamento);
  const idsAtivos = new Set(vigenciasAtivas.map((v) => v.id));
  const vigenciaPorId = new Map(vigenciasAtivas.map((v) => [v.id, v]));
  const registros = new Set(
    ocorrencias.map((o) => `${o.id_filho_tarefa}|${dataBrasil(o.created_at)}`),
  );

  const resultado: PendenciaAnterior[] = [];

  for (const tarefa of atribuicoes) {
    if (!idsAtivos.has(tarefa.id_vigencia)) continue;
    const vigencia = vigenciaPorId.get(tarefa.id_vigencia);
    if (!vigencia) continue;

    let data = dataBrasil(vigencia.data_inicio);
    while (data < hoje) {
      if (!registros.has(`${tarefa.id}|${data}`)) {
        resultado.push({ tarefa, data });
      }
      data = proximoDiaBrasil(data);
    }
  }

  return resultado.sort((a, b) => b.data.localeCompare(a.data));
}

export function useDataBrasilAtual() {
  const [dataAtual, setDataAtual] = useState(() => dataBrasil());

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const agendarVirada = () => {
      const agora = new Date();
      const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).formatToParts(agora);
      const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value]));
      const hojeLocal = new Date(
        Number(mapa["year"]),
        Number(mapa["month"]) - 1,
        Number(mapa["day"]),
        Number(mapa["hour"]),
        Number(mapa["minute"]),
        Number(mapa["second"]),
      );
      const proximaMeiaNoite = new Date(hojeLocal);
      proximaMeiaNoite.setDate(proximaMeiaNoite.getDate() + 1);
      proximaMeiaNoite.setHours(0, 0, 1, 0);
      const atraso = Math.max(1000, proximaMeiaNoite.getTime() - hojeLocal.getTime());

      timeoutId = setTimeout(() => {
        setDataAtual(dataBrasil());
        agendarVirada();
      }, atraso);
    };

    const atualizarAoVoltar = () => setDataAtual(dataBrasil());

    agendarVirada();
    window.addEventListener("focus", atualizarAoVoltar);
    document.addEventListener("visibilitychange", atualizarAoVoltar);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("focus", atualizarAoVoltar);
      document.removeEventListener("visibilitychange", atualizarAoVoltar);
    };
  }, []);

  return dataAtual;
}
