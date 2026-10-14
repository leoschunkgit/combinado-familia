import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquareText, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uiTypography } from "@/lib/ui-typography";
import { uiSpacing } from "@/lib/ui-spacing";

type FeedbackItem = {
  id: number;
  id_usuario_pai: number;
  usuario_nome: string;
  usuario_email: string;
  tipo: "SUGESTAO" | "PROBLEMA" | "DUVIDA" | "ELOGIO";
  assunto: string;
  mensagem: string;
  plataforma: string;
  version_name: string | null;
  version_code: number | null;
  pagina_origem: string | null;
  created_at: string;
};

const TIPOS: Record<FeedbackItem["tipo"], string> = {
  SUGESTAO: "Sugestão",
  PROBLEMA: "Problema",
  DUVIDA: "Dúvida",
  ELOGIO: "Elogio",
};

function dataHora(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(data);
}

function plataformaNome(valor: string) {
  if (valor === "android") return "Android";
  if (valor === "ios") return "iOS";
  if (valor === "web") return "Web";
  return valor;
}

export function AdminFeedbacks() {
  const [itens, setItens] = useState<FeedbackItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("TODOS");
  const [ehMaster, setEhMaster] = useState(false);
  const [feedbackExcluir, setFeedbackExcluir] = useState<FeedbackItem | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);

    const [feedbacksResult, adminsResult] = await Promise.all([
      supabase.rpc("admin_feedbacks", { p_limite: 300 }),
      supabase.rpc("admin_listar_admins"),
    ]);

    setCarregando(false);

    if (feedbacksResult.error) {
      toast.error("Não foi possível carregar os feedbacks.");
      return;
    }

    setItens((feedbacksResult.data ?? []) as FeedbackItem[]);
    setEhMaster(
      !adminsResult.error
      && (adminsResult.data ?? []).some(
        (admin) => admin.eh_atual === true && admin.nivel === "MASTER"
      )
    );
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function excluirFeedback() {
    if (!feedbackExcluir || !ehMaster) return;

    setExcluindo(true);
    const { error } = await supabase.rpc("admin_feedback_excluir", {
      p_feedback_id: feedbackExcluir.id,
    });
    setExcluindo(false);

    if (error) {
      toast.error(error.message || "Não foi possível excluir o feedback.");
      return;
    }

    setItens((atuais) => atuais.filter((item) => item.id !== feedbackExcluir.id));
    setFeedbackExcluir(null);
    toast.success("Feedback excluído.");
  }

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");

    return itens.filter((item) => {
      if (tipo !== "TODOS" && item.tipo !== tipo) return false;
      if (!termo) return true;

      return [
        item.usuario_nome,
        item.usuario_email,
        item.assunto,
        item.mensagem,
      ].some((valor) => valor.toLocaleLowerCase("pt-BR").includes(termo));
    });
  }, [busca, itens, tipo]);

  return (
    <div className={uiSpacing.sectionStack}>
      <div>
        <h2 className={uiTypography.secondaryTitle}>Feedbacks dos usuários</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Consulte opiniões enviadas pelo aplicativo. Esta área é somente para leitura e não funciona como sistema de chamados ou conversa com o usuário.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar usuário, assunto ou mensagem..."
          />
        </div>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger aria-label="Filtrar feedback por tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os tipos</SelectItem>
            <SelectItem value="SUGESTAO">Sugestão</SelectItem>
            <SelectItem value="PROBLEMA">Problema</SelectItem>
            <SelectItem value="DUVIDA">Dúvida</SelectItem>
            <SelectItem value="ELOGIO">Elogio</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {carregando ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Carregando feedbacks...
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum feedback encontrado.
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map((item) => (
            <article key={item.id} className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                      <MessageSquareText className="h-3.5 w-3.5" />
                      {TIPOS[item.tipo] ?? item.tipo}
                    </span>
                    <span className="text-xs text-muted-foreground">{dataHora(item.created_at)}</span>
                  </div>
                  <h3 className="mt-2 font-semibold leading-tight">{item.assunto}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.usuario_nome} · {item.usuario_email}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-xs text-muted-foreground">#{item.id}</span>
                  {ehMaster && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setFeedbackExcluir(item)}
                      aria-label={`Excluir feedback #${item.id}`}
                      title="Excluir feedback"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{item.mensagem}</p>

              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
                <span>{plataformaNome(item.plataforma)}</span>
                {item.version_name && (
                  <span>
                    Versão {item.version_name}
                    {item.version_code !== null ? ` · código ${item.version_code}` : ""}
                  </span>
                )}
                {item.pagina_origem && <span>Origem: {item.pagina_origem}</span>}
              </div>
            </article>
          ))}
        </div>
      )}

      <AlertDialog
        open={Boolean(feedbackExcluir)}
        onOpenChange={(open) => {
          if (!open && !excluindo) setFeedbackExcluir(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir feedback?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação exclui definitivamente o feedback
              {feedbackExcluir ? ` #${feedbackExcluir.id} — ${feedbackExcluir.assunto}` : ""}.
              A exclusão ficará registrada na Auditoria administrativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={excluindo}
              onClick={(event) => {
                event.preventDefault();
                void excluirFeedback();
              }}
            >
              {excluindo ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
