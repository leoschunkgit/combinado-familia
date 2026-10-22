import type { ConsequenciaOcorrenciaLike } from "@/lib/ocorrencia-model";
import {
  descreverConsequenciaOcorrenciaSemStatus,
  rotuloStatusConsequencia,
} from "@/lib/ocorrencia-model";

function classeStatus(status: string) {
  switch (status) {
    case "APLICADO":
    case "CUMPRIDA":
      return "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/35 dark:text-green-300";
    case "PENDENTE":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-300";
    case "CANCELADA":
    case "ESTORNADO":
      return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function ConsequenciaOcorrenciaResumo({
  consequencia,
  formatarMoeda,
  className = "",
}: {
  consequencia: ConsequenciaOcorrenciaLike | null | undefined;
  formatarMoeda: (valor: number) => string;
  className?: string;
}) {
  const descricao = descreverConsequenciaOcorrenciaSemStatus(
    consequencia,
    formatarMoeda,
  );

  if (!consequencia) {
    return <span className={className}>{descricao}</span>;
  }

  return (
    <span className={`flex min-w-0 flex-wrap items-center gap-1.5 ${className}`}>
      <span className="min-w-0 break-words">{descricao}</span>
      <span
        className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${classeStatus(consequencia.status)}`}
      >
        {rotuloStatusConsequencia(consequencia.status)}
      </span>
    </span>
  );
}
