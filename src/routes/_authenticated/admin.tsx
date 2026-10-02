import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { Eye, EyeOff, Save, UserCog } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskCpf, msgErro } from "@/lib/db";

const REGRAS_SENHA = [
  { id: "tam", label: "Pelo menos 6 caracteres", ok: (s: string) => s.length >= 6 },
  { id: "mai", label: "Uma letra maiúscula", ok: (s: string) => /[A-Z]/.test(s) },
  { id: "num", label: "Um número", ok: (s: string) => /\d/.test(s) },
  { id: "especial", label: "Um caractere especial (ex.: !, @ ou #)", ok: (s: string) => /[^\p{L}\p{N}\s]/u.test(s) },
] as const;

function SenhaInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  const [ver, setVer] = useState(false);
  return <div className="relative"><Input id={id} type={ver ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} className="pr-10" autoComplete="new-password" /><button type="button" onClick={() => setVer(!ver)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={ver ? "Ocultar senha" : "Mostrar senha"}>{ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>;
}

function Admin() {
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: pai, error } = await supabase.from("t_usuario_pai").select("nome, cpf, email").eq("auth_user_id", auth.user.id).maybeSingle();
      if (!ativo) return;
      if (error) toast.error(msgErro(error));
      setNome(pai?.nome ?? (auth.user.user_metadata?.["nome"] as string) ?? "");
      setCpf(maskCpf(pai?.cpf ?? (auth.user.user_metadata?.["cpf"] as string) ?? ""));
      setEmail(pai?.email ?? auth.user.email ?? "");
      setCarregando(false);
    }
    void carregar();
    return () => { ativo = false; };
  }, []);

  async function salvarDados(e: FormEvent) {
    e.preventDefault();
    const parsed = z.object({
      nome: z.string().trim().min(2, "Informe o nome").max(100),
      email: z.string().trim().email("Email inválido").max(255),
      cpf: z.string().refine((v) => v.replace(/\D/g, "").length === 11, "CPF deve ter 11 dígitos"),
    }).safeParse({ nome, email, cpf });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos"); return; }

    setLoading(true);
    const auth = await supabase.auth.getUser();
    if (!auth.data.user) { setLoading(false); toast.error("Sua sessão expirou. Entre novamente."); return; }

    const { error: authError } = await supabase.auth.updateUser({
      email: parsed.data.email,
      data: { nome: parsed.data.nome, cpf: parsed.data.cpf.replace(/\D/g, "") },
    });
    if (authError) {
      setLoading(false);
      toast.error(msgErro(authError));
      return;
    }

    const { error } = await supabase.from("t_usuario_pai").update({
      nome: parsed.data.nome,
      cpf: parsed.data.cpf.replace(/\D/g, ""),
      email: parsed.data.email,
    }).eq("auth_user_id", auth.data.user.id);

    setLoading(false);
    if (error) { toast.error(msgErro(error)); return; }
    toast.success(parsed.data.email !== auth.data.user.email ? "Dados salvos. Confirme o novo email pelo link recebido." : "Dados atualizados com sucesso.");
    setEmail(parsed.data.email);
  }

  async function alterarSenha(e: FormEvent) {
    e.preventDefault();
    if (!novaSenha || novaSenha.length < 6 || !REGRAS_SENHA.every((r) => r.ok(novaSenha))) { toast.error("A senha não atende aos requisitos abaixo."); return; }
    if (novaSenha !== confirmacao) { toast.error("As senhas não coincidem."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setLoading(false);
    if (error) { toast.error(msgErro(error)); return; }
    setNovaSenha(""); setConfirmacao("");
    toast.success("Senha alterada com sucesso.");
  }

  if (carregando) return <div className="py-10 text-center text-muted-foreground">Carregando seus dados...</div>;

  return (
    <div className="space-y-6">
      <div><div className="flex items-center gap-2"><UserCog className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold">Minha conta</h1></div><p className="mt-1 text-muted-foreground">Atualize seus dados pessoais e sua senha.</p></div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Dados pessoais</h2>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">Nome, CPF e email da conta.</p>
          <form onSubmit={salvarDados} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="admin-nome">Nome</Label><Input id="admin-nome" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="admin-cpf">CPF</Label><Input id="admin-cpf" inputMode="numeric" value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} /></div>
            <div className="space-y-2"><Label htmlFor="admin-email">Email</Label><Input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <Button type="submit" disabled={loading}><Save /> Salvar dados</Button>
          </form>
        </section>
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Alterar senha</h2>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">Defina uma nova senha para acessar sua conta.</p>
          <form onSubmit={alterarSenha} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="admin-senha">Nova senha</Label><SenhaInput id="admin-senha" value={novaSenha} onChange={setNovaSenha} /></div>
            <ul className="space-y-1 text-sm">{REGRAS_SENHA.map((r) => { const ok = r.ok(novaSenha); return <li key={r.id} className={`flex items-center gap-1.5 ${ok ? "text-success" : "text-muted-foreground"}`}>{ok ? "✓" : "•"} {r.label}</li>; })}</ul>
            <div className="space-y-2"><Label htmlFor="admin-confirmacao">Confirmar nova senha</Label><SenhaInput id="admin-confirmacao" value={confirmacao} onChange={setConfirmacao} /></div>
            <Button type="submit" disabled={loading}><Save /> Alterar senha</Button>
          </form>
        </section>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [
    { title: "Minha conta — Combinado" },
    { name: "description", content: "Atualize seus dados e sua senha no Combinado." },
    { property: "og:title", content: "Minha conta — Combinado" },
    { property: "og:description", content: "Atualize seus dados e sua senha no Combinado." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Admin,
});
