import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { msgErro } from "@/lib/db";
import { AppBrand } from "@/components/AppBrand";

const REGRAS_SENHA = [
  { id: "tam", label: "Pelo menos 8 caracteres", ok: (s: string) => s.length >= 8 },
  { id: "min", label: "Uma letra minúscula", ok: (s: string) => /[a-z]/.test(s) },
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
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [fluxoRecuperacaoValido, setFluxoRecuperacaoValido] = useState(false);

  useEffect(() => {
    let ativo = true;

    const verificarSessao = async () => {
      const recuperacaoValidada = sessionStorage.getItem("combinado_recovery_otp_validado") === "1";
      const { data, error } = await supabase.auth.getSession();
      if (!ativo) return;
      setFluxoRecuperacaoValido(recuperacaoValidada);
      setSessaoPronta(recuperacaoValidada && !error && !!data.session);
      setVerificandoSessao(false);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!ativo) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        const recuperacaoValidada = sessionStorage.getItem("combinado_recovery_otp_validado") === "1";
        setFluxoRecuperacaoValido(recuperacaoValidada);
        setSessaoPronta(recuperacaoValidada && !!session);
        setVerificandoSessao(false);
      }
      if (event === "SIGNED_OUT") {
        setSessaoPronta(false);
        setVerificandoSessao(false);
      }
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

    if (error) {
      setLoading(false);
      toast.error(msgErro(error));
      return;
    }

    const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
    sessionStorage.removeItem("combinado_recovery_otp_validado");
    setLoading(false);

    if (signOutError) {
      toast.error("A senha foi alterada, mas não foi possível encerrar a sessão. Feche e abra o app antes de entrar novamente.");
      return;
    }

    toast.success("Senha redefinida com sucesso! Entre novamente com sua nova senha.");
    navigate({ to: "/" });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted/30 p-6">
      {loading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm" role="status" aria-live="polite">
          <div className="flex items-center gap-3 rounded-xl border bg-background px-5 py-4 shadow-lg">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Salvando nova senha...</span>
          </div>
        </div>
      )}
      <div className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-sm md:p-8">
        <Link
          to="/"
          className="mb-6 inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label="Ir para o início"
        >
          <AppBrand />
        </Link>

        <h1 className="text-2xl font-bold">Redefinir senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {verificandoSessao
            ? "Validando sua recuperação..."
            : sessaoPronta
              ? "Escolha uma nova senha para sua conta."
              : fluxoRecuperacaoValido
                ? "Sua sessão de recuperação expirou. Solicite um novo código."
                : "Valide primeiro o código de recuperação enviado para seu email."}
        </p>

        {verificandoSessao ? (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-lg border bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Validando recuperação...
          </div>
        ) : sessaoPronta ? (
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
            <Button type="submit" className="w-full" size="lg" disabled={loading}>{loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : "Salvar nova senha"}</Button>
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
