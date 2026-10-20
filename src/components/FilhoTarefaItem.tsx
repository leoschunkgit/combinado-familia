import { BellRing, RotateCcw, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { TarefaIcone } from "@/components/TarefaIcone";
import { Button } from "@/components/ui/button";
import type {
  OcorrenciaFilho,
  RevisaoTarefaFilhoApp,
  SolicitacaoTarefaFilhoApp,
  TarefaFilho,
} from "@/lib/child-app-session";

export function FilhoTarefaItem({
  tarefa,
  registroHoje,
  solicitacaoHoje,
  revisaoHoje,
  onAvisar,
  onPedirRevisao,
}: {
  tarefa: TarefaFilho;
  registroHoje?: OcorrenciaFilho;
  solicitacaoHoje?: SolicitacaoTarefaFilhoApp;
  revisaoHoje?: RevisaoTarefaFilhoApp;
  onAvisar: () => void;
  onPedirRevisao: () => void;
}) {
  const solicitacaoPendente = solicitacaoHoje?.status === "PENDENTE";

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <TarefaIcone nome={tarefa.nome} className="shrink-0" />
        <span className="min-w-0 flex-1 break-words text-sm font-semibold leading-snug">
          {tarefa.nome}
        </span>
      </div>

      {registroHoje?.tipo === "FEZ" ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
          <ThumbsUp className="h-3.5 w-3.5" />
          Fez
        </span>
      ) : registroHoje?.tipo === "NAO_FEZ" && revisaoHoje?.status === "PENDENTE" ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          <BellRing className="h-3.5 w-3.5" />
          Revisão enviada
        </span>
      ) : registroHoje?.tipo === "NAO_FEZ" && revisaoHoje?.status === "MANTEVE_NAO_FEZ" ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
          <ThumbsDown className="h-3.5 w-3.5" />
          Não fez mantido
        </span>
      ) : registroHoje?.tipo === "NAO_FEZ" && !revisaoHoje ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 px-2.5 text-xs"
          onClick={onPedirRevisao}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Pedir revisão
        </Button>
      ) : registroHoje?.tipo === "NAO_FEZ" ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
          <ThumbsDown className="h-3.5 w-3.5" />
          Não fez
        </span>
      ) : !registroHoje && revisaoHoje?.status === "PENDENTE" ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          <BellRing className="h-3.5 w-3.5" />
          Revisão enviada
        </span>
      ) : solicitacaoPendente ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
          <BellRing className="h-3.5 w-3.5" />
          Aguardando
        </span>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 px-2.5 text-xs"
          onClick={onAvisar}
        >
          <Send className="h-3.5 w-3.5" />
          Terminei
        </Button>
      )}
    </div>
  );
}
