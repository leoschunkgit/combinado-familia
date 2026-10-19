import { BellRing, ChevronRight, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { TarefaIcone } from "@/components/TarefaIcone";
import { Button } from "@/components/ui/button";
import type {
  OcorrenciaFilho,
  SolicitacaoTarefaFilhoApp,
  TarefaFilho,
} from "@/lib/child-app-session";

export function FilhoTarefaItem({
  tarefa,
  registroHoje,
  solicitacaoHoje,
  onAbrirDetalhes,
  onAvisar,
}: {
  tarefa: TarefaFilho;
  registroHoje?: OcorrenciaFilho;
  solicitacaoHoje?: SolicitacaoTarefaFilhoApp;
  onAbrirDetalhes: () => void;
  onAvisar: () => void;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 sm:px-5">
      <button
        type="button"
        onClick={onAbrirDetalhes}
        className="group flex min-w-0 items-center gap-2.5 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        aria-label={`Ver detalhes de ${tarefa.nome}`}
      >
        <TarefaIcone nome={tarefa.nome} className="shrink-0" />
        <span className="min-w-0 flex-1 break-words text-sm font-semibold leading-snug">
          {tarefa.nome}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-active:translate-x-0.5" />
      </button>

      {registroHoje?.tipo === "FEZ" ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
          <ThumbsUp className="h-3.5 w-3.5" />
          Fez
        </span>
      ) : registroHoje?.tipo === "NAO_FEZ" ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
          <ThumbsDown className="h-3.5 w-3.5" />
          Não fez
        </span>
      ) : solicitacaoHoje ? (
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
