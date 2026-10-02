import { Badge } from "@/components/ui/badge";
import type { Vigencia } from "@/lib/db";

export function vigenciaEmAndamento(vigencia: Vigencia) {
  const agora = Date.now();
  return new Date(vigencia.data_inicio).getTime() <= agora && new Date(vigencia.data_fim).getTime() >= agora;
}

export function VigenciaStatus({ vigencia }: { vigencia: Vigencia }) {
  const agora = Date.now();
  const inicio = new Date(vigencia.data_inicio).getTime();
  const fim = new Date(vigencia.data_fim).getTime();

  if (inicio <= agora && fim >= agora) {
    return (
      <Badge className="h-5 px-1.5 py-0 text-[10px] font-semibold bg-success text-success-foreground">
        Em andamento
      </Badge>
    );
  }

  if (fim < agora) {
    return (
      <Badge variant="secondary" className="h-5 px-1.5 py-0 text-[10px] font-semibold">
        Finalizada
      </Badge>
    );
  }

  return null;
}
