import { Badge } from "@/components/ui/badge";
import type { Vigencia } from "@/lib/db";

export function vigenciaEmAndamento(vigencia: Pick<Vigencia, "data_inicio" | "data_fim">) {
  const agora = Date.now();
  return new Date(vigencia.data_inicio).getTime() <= agora && new Date(vigencia.data_fim).getTime() >= agora;
}

export function VigenciaStatus({ vigencia }: { vigencia: Pick<Vigencia, "data_inicio" | "data_fim"> }) {
  const agora = Date.now();
  const inicio = new Date(vigencia.data_inicio).getTime();
  const fim = new Date(vigencia.data_fim).getTime();

  if (inicio <= agora && fim >= agora) {
    return (
      <Badge className="h-5 max-w-full shrink-0 whitespace-nowrap px-1.5 py-0 text-[10px] font-semibold bg-green-100 text-green-700 border-green-200">
        Em andamento
      </Badge>
    );
  }

  if (fim < agora) {
    return (
      <Badge className="h-5 max-w-full shrink-0 whitespace-nowrap border-red-200 bg-red-100 px-1.5 py-0 text-[10px] font-semibold text-red-700">
        Finalizada
      </Badge>
    );
  }

  return null;
}
