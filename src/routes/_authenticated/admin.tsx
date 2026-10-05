import { createFileRoute } from "@tanstack/react-router";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { Save, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { msgErro } from "@/lib/db";
import { useActionLoading } from "@/components/ActionLoading";

function Admin() {
  const router = useRouter();
  const { runAction } = useActionLoading();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [textoConfirmacao, setTextoConfirmacao] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: pai, error } = await supabase.from("t_usuario_pai").select("nome, email").eq("auth_user_id", auth.user.id).maybeSingle();
      if (!ativo) return;
      if (error) toast.error(msgErro(error));
      setNome(pai?.nome ?? (auth.user.user_metadata?.["nome"] as string) ?? "");
      setEmail(auth.user.email ?? pai?.email ?? "");
      setCarregando(false);
    }
    void carregar();
    return () => { ativo = false; };
  }, []);

  async function salvarDados(e: FormEvent) {
    e.preventDefault();
    const parsed = z.string().trim().min(2, "Informe o nome").max(100).safeParse(nome);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos"); return; }

    setLoading(true);
    const auth = await supabase.auth.getUser();
    if (!auth.data.user) { setLoading(false); toast.error("Sua sessão expirou. Entre novamente."); return; }
    const { data: atualizado, error } = await supabase.from("t_usuario_pai").update({ nome: parsed.data }).eq("auth_user_id", auth.data.user.id).select("id").maybeSingle();
    if (error || !atualizado) { setLoading(false); toast.error(error ? msgErro(error) : "Não foi possível atualizar o nome. Tente novamente."); return; }
    const { error: authError } = await supabase.auth.updateUser({ data: { nome: parsed.data } });
    setLoading(false);
    setNome(parsed.data);
    await router.invalidate();
    if (authError) toast.error("Nome salvo, mas não foi possível atualizar os dados da conta. Tente novamente.");
    else toast.success("Nome atualizado com sucesso.");
  }

  async function excluirConta() {
    if (textoConfirmacao.trim().toUpperCase() !== "EXCLUIR") {
      toast.error('Digite "EXCLUIR" para confirmar.');
      return;
    }

    setExcluindo(true);
    const { error } = await supabase.functions.invoke("excluir-conta", { body: { confirmacao: true } });

    if (error) {
      setExcluindo(false);
      toast.error("Não foi possível excluir a conta. Tente novamente.");
      return;
    }

    await supabase.auth.signOut();
    setConfirmarExclusao(false);
    toast.success("Conta e dados excluídos.");
    navigate({ to: "/", replace: true });
  }

  if (carregando) return <div className="py-10 text-center text-muted-foreground">Carregando seus dados...</div>;

  return (
    <div className="space-y-6">
      <div><div className="flex items-center gap-2"><UserCog className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">Minha conta</h1></div><p className="mt-1 text-muted-foreground">Consulte seus dados pessoais e atualize seu nome.</p></div>
      <div className="max-w-xl space-y-6">
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Dados pessoais</h2>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">Altere seu nome. O email é apenas para consulta.</p>
          <form onSubmit={(e) => { void runAction(() => salvarDados(e)); }} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="admin-nome">Nome <span className="text-destructive" aria-hidden="true">*</span></Label><Input id="admin-nome" value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
            <div className="space-y-2"><p className="text-sm font-medium">Email</p><p className="break-all text-sm text-foreground">{email || "Não informado"}</p></div>
            <Button type="submit" disabled={loading}><Save /> Salvar nome</Button>
          </form>
        </section>

        <section className="rounded-xl border border-destructive/30 bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-destructive">Excluir conta</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Exclui permanentemente sua conta e os dados vinculados, incluindo filhos, tarefas, vigências, atribuições, ocorrências, histórico e links públicos.
          </p>
          <Button variant="destructive" className="mt-4" onClick={() => { setTextoConfirmacao(""); setConfirmarExclusao(true); }}>
            <Trash2 /> Excluir minha conta
          </Button>
        </section>
      </div>

      <Dialog open={confirmarExclusao} onOpenChange={(open) => { if (!excluindo) setConfirmarExclusao(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir conta permanentemente?</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. Seus dados e os dados da família vinculados à sua conta serão excluídos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="confirmar-exclusao">Digite EXCLUIR para confirmar</Label>
            <Input
              id="confirmar-exclusao"
              value={textoConfirmacao}
              onChange={(e) => setTextoConfirmacao(e.target.value)}
              autoComplete="off"
              disabled={excluindo}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirmarExclusao(false)} disabled={excluindo}>Cancelar</Button>
            <Button variant="destructive" onClick={() => void runAction(excluirConta)} disabled={excluindo || textoConfirmacao.trim().toUpperCase() !== "EXCLUIR"}>
              {excluindo ? "Excluindo..." : "Excluir permanentemente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [
    { title: "Minha conta — Combinado" },
    { name: "description", content: "Consulte seus dados pessoais e atualize seu nome no Combinado." },
    { property: "og:title", content: "Minha conta — Combinado" },
    { property: "og:description", content: "Consulte seus dados pessoais e atualize seu nome no Combinado." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Admin,
});
