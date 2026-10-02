import { Badge } from "@/components/ui/badge";
import type { Vigencia } from "@/lib/db";

export function VigenciaStatus({ vigencia }: { vigencia: Vigencia }) {
  const agora = Date.now();
  const emAndamento = new Date(vigencia.data_inicio).getTime() <= agora && new Date(vigencia.data_fim).getTime() >= agora;
  if (!emAndamento) return null;

  return (
    <Badge className="h-5 px-1.5 py-0 text-[10px] font-semibold bg-success text-success-foreground">
      Em andamento
    </Badge>
  );
}
