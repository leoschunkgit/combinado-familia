import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";
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

type AdminItem = {
  id: number;
  id_usuario_pai: number;
  nome: string;
  email: string;
  ativo: boolean;
  nivel: "MASTER" | "ADMIN";
  created_at: string;
  ultimo_acesso: string | null;
  eh_atual: boolean;
};

function dataHora(valor: string | null) {
  if (!valor) return "Ainda não monitorado";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(data);
}

export function AdminAdministradores() {
  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [confirmacao, setConfirmacao] = useState<AdminItem | null>(null);
  const ehMaster = admins.some((admin) => admin.eh_atual && admin.nivel === "MASTER");

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase.rpc("admin_listar_admins");
    setCarregando(false);

    if (error) {
      toast.error("Não foi possível carregar os administradores.");
      return;
    }

    setAdmins((data ?? []) as AdminItem[]);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function adicionar() {
    if (!email.trim()) {
      toast.error("Informe o email do usuário.");
      return;
    }

    setSalvando(true);
    const { error } = await supabase.rpc("admin_adicionar", { p_email: email.trim() });
    setSalvando(false);

    if (error) {
      toast.error(msgErro(error));
      return;
    }

    setEmail("");
    toast.success("Administrador adicionado");
    await carregar();
  }

  async function alterarStatus(admin: AdminItem) {
    setSalvando(true);
    const { error } = await supabase.rpc("admin_definir_status", {
      p_admin_id: admin.id,
      p_ativo: !admin.ativo,
    });
    setSalvando(false);
    setConfirmacao(null);

    if (error) {
      toast.error(msgErro(error));
      return;
    }

    toast.success(admin.ativo ? "Administrador desativado" : "Administrador ativado");
    await carregar();
  }

  return (
    <div className={uiSpacing.sectionStack}>
      <div>
        <h2 className={uiTypography.secondaryTitle}>Administradores</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie quem pode acessar a Administração. O usuário precisa já ter uma conta no Combinado Família.
        </p>
      </div>

      {ehMaster && (
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserPlus className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className={uiTypography.secondaryTitle}>Adicionar administrador</h3>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@exemplo.com" />
                <Button size="sm" className="shrink-0" onClick={() => void adicionar()} disabled={salvando}>
                  <UserPlus className="h-4 w-4" /> Adicionar
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <h3 className={uiTypography.secondaryTitle}>Acessos administrativos</h3>

        {carregando && admins.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando administradores...</p>
        ) : (
          <div className="mt-4 space-y-2">
            {admins.map((admin) => (
              <div key={admin.id} className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{admin.nome}</p>
                      {admin.nivel === "MASTER" && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">MASTER</span>}
                      {admin.eh_atual && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Você</span>}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${admin.ativo ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {admin.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{admin.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Último acesso: {dataHora(admin.ultimo_acesso)}</p>
                  </div>
                </div>

                {ehMaster && (
                  <Button
                    size="sm"
                    variant="outline"
                    className={admin.ativo ? "text-destructive hover:text-destructive" : ""}
                    disabled={salvando || admin.eh_atual || admin.nivel === "MASTER"}
                    onClick={() => setConfirmacao(admin)}
                  >
                    {admin.nivel === "MASTER" ? "Protegido" : admin.ativo ? "Desativar" : "Ativar"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          O MASTER é intocável. Somente o MASTER pode adicionar, ativar ou desativar administradores.
        </p>
      </section>

      <AlertDialog open={Boolean(confirmacao)} onOpenChange={(open) => { if (!open) setConfirmacao(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmacao?.ativo ? "Desativar administrador?" : "Ativar administrador?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmacao?.ativo
                ? `${confirmacao?.nome ?? "Este usuário"} deixará de acessar a Administração.`
                : `${confirmacao?.nome ?? "Este usuário"} passará a ter acesso administrativo.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={salvando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={confirmacao?.ativo ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              disabled={salvando || !confirmacao}
              onClick={(event) => {
                event.preventDefault();
                if (confirmacao) void alterarStatus(confirmacao);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
