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
        Number(mapa.year),
        Number(mapa.month) - 1,
        Number(mapa.day),
        Number(mapa.hour),
        Number(mapa.minute),
        Number(mapa.second),
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
