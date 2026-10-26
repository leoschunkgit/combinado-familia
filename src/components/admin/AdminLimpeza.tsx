import { useState } from "react";
import { AlertTriangle, Search, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { msgErro } from "@/lib/app-error";
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
import { uiTypography } from "@/lib/ui-typography";
import { uiSpacing } from "@/lib/ui-spacing";

type UsuarioLimpeza = {
  id: number;
  nome: string;
  email: string;
  onboarding_concluido: boolean;
  eh_admin: boolean;
  filhos: number;
  tarefas: number;
  vigencias: number;
  atribuicoes: number;
  ocorrencias: number;
  feedbacks: number;
};

function numero(valor: unknown) {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizarUsuario(data: unknown): UsuarioLimpeza | null {
  if (!data || typeof data !== "object") return null;
  const item = data as Record<string, unknown>;

  return {
    id: numero(item["id"]),
    nome: typeof item["nome"] === "string" ? item["nome"] : "Usuário",
    email: typeof item["email"] === "string" ? item["email"] : "",
    onboarding_concluido: item["onboarding_concluido"] === true,
    eh_admin: item["eh_admin"] === true,
    filhos: numero(item["filhos"]),
    tarefas: numero(item["tarefas"]),
    vigencias: numero(item["vigencias"]),
    atribuicoes: numero(item["atribuicoes"]),
    ocorrencias: numero(item["ocorrencias"]),
    feedbacks: numero(item["feedbacks"]),
  };
}

export function AdminLimpeza() {
  const [email, setEmail] = useState("");
  const [usuario, setUsuario] = useState<UsuarioLimpeza | null>(null);
  const [localizando, setLocalizando] = useState(false);
  const [limpando, setLimpando] = useState(false);
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);

  async function localizar() {
    const valor = email.trim();

    if (!valor) {
      toast.error("Informe o e-mail do usuário.");
      return;
    }

    setLocalizando(true);
    setUsuario(null);

    const { data, error } = await supabase.rpc("admin_localizar_usuario_limpeza", {
      p_email: valor,
    });

    setLocalizando(false);

    if (error) {
      toast.error(msgErro(error));
      return;
    }

    const encontrado = normalizarUsuario(data);
    if (!encontrado) {
      toast.error("Não foi possível interpretar os dados do usuário.");
      return;
    }

    setUsuario(encontrado);
  }

  async function limpar() {
    if (!usuario) return;

    setLimpando(true);

    const { error } = await supabase.rpc("admin_limpar_dados_usuario", {
      p_email: usuario.email,
    });

    setLimpando(false);
    setConfirmacaoAberta(false);

    if (error) {
      toast.error(msgErro(error));
      return;
    }

    toast.success("Dados da conta limpos com sucesso");
    setUsuario(null);
    setEmail("");
  }

  const resumo = usuario
    ? [
        ["Filhos", usuario.filhos],
        ["Tarefas", usuario.tarefas],
        ["Vigências", usuario.vigencias],
        ["Atribuições", usuario.atribuicoes],
        ["Resultados", usuario.ocorrencias],
        ["Feedbacks", usuario.feedbacks],
      ]
    : [];

  return (
    <div className={uiSpacing.sectionStack}>
      <div>
        <h2 className={uiTypography.secondaryTitle}>Limpeza de conta</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Zere os dados funcionais e históricos de uma família sem apagar a conta do responsável nem seu acesso administrativo. Esta função é exclusiva do administrador MASTER ativo.
        </p>
      </div>

      <section className="rounded-xl border border-destructive/30 bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <Trash2 className="h-4 w-4" />
          </span>

          <div className="min-w-0 flex-1">
            <h3 className={uiTypography.secondaryTitle}>Limpar dados de uma conta</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Informe o e-mail exato do responsável. Primeiro localizamos a conta e mostramos um resumo; a exclusão só acontece depois de uma segunda confirmação.
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setUsuario(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void localizar();
                }}
                placeholder="email@exemplo.com"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => void localizar()}
                disabled={localizando || limpando}
              >
                <Search className="h-4 w-4" />
                {localizando ? "Localizando..." : "Localizar usuário"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {usuario && (
        <>
          <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className={uiTypography.secondaryTitle}>{usuario.nome}</h3>
                  {usuario.eh_admin && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                      Acesso administrativo
                    </span>
                  )}
                </div>
                <p className="mt-1 break-all text-sm text-muted-foreground">{usuario.email}</p>
              </div>

              <span className="shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                ID {usuario.id}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
              {resumo.map(([label, valor]) => (
                <div key={String(label)} className="rounded-lg border bg-muted/20 px-3 py-2.5">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{valor}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-xl border border-primary/20 bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <h3 className="text-sm font-semibold">Será preservado</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Login e autenticação, cadastro principal do responsável, eventual vínculo ADMIN/MASTER e a auditoria administrativa.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-destructive/30 bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <h3 className="text-sm font-semibold">Será apagado</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Filhos, tarefas, vigências, atribuições, resultados, consequências, solicitações, estrelas, recompensas, acessos do filho, links públicos, push, feedbacks, telemetria e demais históricos funcionais da família.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-destructive">Ação irreversível</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  O onboarding será reaberto para que a família possa começar novamente do zero.
                </p>
              </div>

              <Button
                type="button"
                variant="destructive"
                className="shrink-0"
                onClick={() => setConfirmacaoAberta(true)}
                disabled={limpando}
              >
                <Trash2 className="h-4 w-4" />
                Limpar dados da conta
              </Button>
            </div>
          </section>
        </>
      )}

      <AlertDialog open={confirmacaoAberta} onOpenChange={(open) => {
        if (!limpando) setConfirmacaoAberta(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar todos os dados desta conta?</AlertDialogTitle>
            <AlertDialogDescription>
              {usuario
                ? `Todos os dados funcionais e históricos de ${usuario.nome} (${usuario.email}) serão apagados. O login, o cadastro principal e eventual acesso ADMIN/MASTER serão preservados. Esta ação não pode ser desfeita.`
                : "Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={limpando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={limpando || !usuario}
              onClick={(event) => {
                event.preventDefault();
                void limpar();
              }}
            >
              {limpando ? "Limpando..." : "Sim, limpar todos os dados"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
