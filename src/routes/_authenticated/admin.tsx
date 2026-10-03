import { createFileRoute } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { Save, UserCog } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { msgErro } from "@/lib/db";

function Admin() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [carregando, setCarregando] = useState(true);

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

  if (carregando) return <div className="py-10 text-center text-muted-foreground">Carregando seus dados...</div>;

  return (
    <div className="space-y-6">
      <div><div className="flex items-center gap-2"><UserCog className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">Minha conta</h1></div><p className="mt-1 text-muted-foreground">Consulte seus dados pessoais e atualize seu nome.</p></div>
      <div className="max-w-xl">
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Dados pessoais</h2>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">Altere seu nome. O email é apenas para consulta.</p>
          <form onSubmit={salvarDados} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="admin-nome">Nome <span className="text-destructive" aria-hidden="true">*</span></Label><Input id="admin-nome" value={nome} onChange={(e) => setNome(e.target.value)} required /></div>
            <div className="space-y-2"><p className="text-sm font-medium">Email</p><p className="break-all text-sm text-foreground">{email || "Não informado"}</p></div>
            <Button type="submit" disabled={loading}><Save /> Salvar nome</Button>
          </form>
        </section>
      </div>
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
