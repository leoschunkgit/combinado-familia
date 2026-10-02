import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Check, Eye, EyeOff, Home, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const REGRAS_SENHA = [
  { id: "tam", label: "Pelo menos 6 caracteres", ok: (s: string) => s.length >= 6 },
  { id: "mai", label: "Uma letra maiúscula", ok: (s: string) => /[A-Z]/.test(s) },
  { id: "num", label: "Um número", ok: (s: string) => /\d/.test(s) },
  { id: "especial", label: "Um caractere especial (ex.: !, @ ou #)", ok: (s: string) => /[^\p{L}\p{N}\s]/u.test(s) },
] as const;

function senhaValida(s: string) {
  return REGRAS_SENHA.every((r) => r.ok(s));
}

function SenhaInput({ value, onChange, id, placeholder }: { value: string; onChange: (value: string) => void; id: string; placeholder?: string }) {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={ver ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pr-10" autoComplete="new-password" />
      <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? "Ocultar senha" : "Mostrar senha"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
        {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function RedefinirSenha() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessaoPronta, setSessaoPronta] = useState(false);

  useEffect(() => {
    let ativo = true;

    const verificarSessao = async () => {
      const { data } = await supabase.auth.getSession();
      if (ativo) setSessaoPronta(!!data.session);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!ativo) return;
      if (event === "PASSWORD_RECOVERY" || session) setSessaoPronta(true);
    });

    void verificarSessao();
    return () => { ativo = false; listener.subscription.unsubscribe(); };
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!senhaValida(senha)) {
      toast.error("A senha não atende aos requisitos abaixo.");
      return;
    }
    if (senha !== confirmacao) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setLoading(false);

    if (error) {
      toast.error("Não foi possível redefinir a senha. Solicite um novo link de recuperação.");
      return;
    }

    toast.success("Senha redefinida com sucesso!");
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-sm md:p-8">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Home className="h-5 w-5" /></span>
          <span className="font-display text-xl font-bold">Combinado</span>
        </div>

        <h1 className="text-2xl font-bold">Redefinir senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {sessaoPronta ? "Escolha uma nova senha para sua conta." : "O link de recuperação é inválido, expirou ou já foi utilizado."}
        </p>

        {sessaoPronta ? (
          <form onSubmit={salvar} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nova-senha">Nova senha</Label>
              <SenhaInput id="nova-senha" value={senha} onChange={setSenha} placeholder="Digite a nova senha" />
            </div>
            <ul className="space-y-1 text-sm" aria-live="polite">
              {REGRAS_SENHA.map((r) => {
                const ok = r.ok(senha);
                return <li key={r.id} className={`flex items-center gap-1.5 ${ok ? "text-success" : "text-muted-foreground"}`}>{ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}{r.label}</li>;
              })}
            </ul>
            <div className="space-y-2">
              <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
              <SenhaInput id="confirmar-senha" value={confirmacao} onChange={setConfirmacao} placeholder="Digite novamente" />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>{loading ? "Salvando..." : "Salvar nova senha"}</Button>
          </form>
        ) : (
          <Button className="mt-6 w-full" size="lg" onClick={() => navigate({ to: "/" })}>Voltar para o login</Button>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({ meta: [
    { title: "Redefinir senha — Combinado" },
    { name: "description", content: "Redefina a senha da sua conta no Combinado." },
    { property: "og:title", content: "Redefinir senha — Combinado" },
    { property: "og:description", content: "Redefina a senha da sua conta no Combinado." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: RedefinirSenha,
});
