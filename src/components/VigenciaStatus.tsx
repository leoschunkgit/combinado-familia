import { Badge } from "@/components/ui/badge";
import type { Vigencia } from "@/lib/db";

type VigenciaPeriodo = Pick<Vigencia, "data_inicio" | "data_fim">;
export type SituacaoVigencia = "andamento" | "futura" | "finalizada";

export function situacaoVigencia(vigencia: VigenciaPeriodo, agora = Date.now()): SituacaoVigencia {
  const inicio = new Date(vigencia.data_inicio).getTime();
  const fim = new Date(vigencia.data_fim).getTime();
  if (inicio <= agora && fim >= agora) return "andamento";
  if (inicio > agora) return "futura";
  return "finalizada";
}

export function vigenciaEmAndamento(vigencia: VigenciaPeriodo) {
  return situacaoVigencia(vigencia) === "andamento";
}

export function compararVigencias(a: VigenciaPeriodo, b: VigenciaPeriodo) {
  const agora = Date.now();
  const statusA = situacaoVigencia(a, agora);
  const statusB = situacaoVigencia(b, agora);
  const peso = (status: SituacaoVigencia) => status === "andamento" ? 0 : status === "futura" ? 1 : 2;
  const diferencaStatus = peso(statusA) - peso(statusB);
  if (diferencaStatus !== 0) return diferencaStatus;

  const inicioA = new Date(a.data_inicio).getTime();
  const inicioB = new Date(b.data_inicio).getTime();
  return statusA === "finalizada" ? inicioB - inicioA : inicioA - inicioB;
}

export function VigenciaStatus({ vigencia }: { vigencia: VigenciaPeriodo }) {
  const status = situacaoVigencia(vigencia);

  if (status === "andamento") {
    return (
      <Badge className="h-5 max-w-full shrink-0 whitespace-nowrap px-1.5 py-0 text-[10px] font-semibold bg-green-100 text-green-700 border-green-200">
        Em andamento
      </Badge>
    );
  }

  if (status === "finalizada") {
    return (
      <Badge className="h-5 max-w-full shrink-0 whitespace-nowrap border-red-200 bg-red-100 px-1.5 py-0 text-[10px] font-semibold text-red-700">
        Finalizada
      </Badge>
    );
  }

  return (
    <Badge className="h-5 max-w-full shrink-0 whitespace-nowrap border-gray-200 bg-gray-100 px-1.5 py-0 text-[10px] font-semibold text-gray-600">
      Irá começar
    </Badge>
  );
}
