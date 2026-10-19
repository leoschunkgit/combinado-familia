import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  lerSessaoFilhoLocal,
  limparSessaoFilhoLocal,
  obterPainelFilhoApp,
  parearFilhoApp,
  revogarTokenFilho,
  salvarSessaoFilhoLocal,
  type PainelFilho,
} from "@/lib/child-app-session";

export function AcessoFilhoLogin({
  onEntrou,
  onVoltar,
}: {
  onEntrou: (painel: PainelFilho) => void;
  onVoltar: () => void;
}) {
  const [chave, setChave] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [sessaoExistente, setSessaoExistente] = useState(false);

  useEffect(() => {
    let ativo = true;
    void lerSessaoFilhoLocal().then((token) => {
      if (ativo) setSessaoExistente(Boolean(token));
    });
    return () => { ativo = false; };
  }, []);

  async function tentarSessaoExistente() {
    setCarregando(true);
    try {
      const token = await lerSessaoFilhoLocal();
      if (!token) {
        setSessaoExistente(false);
        toast.error("Não há um acesso do filho salvo neste aparelho.");
        return;
      }

      const painel = await obterPainelFilhoApp(token);
      if (!painel) {
        await limparSessaoFilhoLocal();
        setSessaoExistente(false);
        toast.error("Este acesso não está mais ativo. Peça uma nova chave ao seu responsável.");
        return;
      }

      onEntrou(painel);
    } catch {
      toast.error("Não foi possível validar o acesso agora. Verifique sua conexão e tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  async function entrar(e: FormEvent) {
    e.preventDefault();

    if (!/^\d{6}$/.test(chave)) {
      toast.error("Digite os 6 dígitos da chave.");
      return;
    }

    setCarregando(true);
    let tokenNovo: string | null = null;

    try {
      const pareamento = await parearFilhoApp(chave);
      tokenNovo = pareamento.token;

      const { data: sessaoAtual } = await supabase.auth.getSession();
      if (sessaoAtual.session) {
        const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
        if (signOutError) throw signOutError;
      }

      await salvarSessaoFilhoLocal(pareamento.token);
      onEntrou(pareamento.painel);
    } catch (error) {
      if (tokenNovo) {
        try {
          await revogarTokenFilho(tokenNovo);
        } catch {
          // Evita esconder o erro original se a revogação de contingência falhar.
        }
      }

      toast.error(error instanceof Error ? error.message : "Não foi possível entrar como filho.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <KeyRound className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Acesso do filho</h2>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Digite a chave de 6 dígitos fornecida pelo seu responsável.
        </p>
      </div>

      <form onSubmit={entrar} className="space-y-5">
        {sessaoExistente && (
          <div className="rounded-xl border bg-muted/25 p-3">
            <p className="text-sm font-medium">Este aparelho já possui um acesso do filho vinculado.</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Você pode tentar abrir o acesso existente sem gerar outra chave.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 h-10 w-full"
              onClick={() => void tentarSessaoExistente()}
              disabled={carregando}
            >
              {carregando ? <><Loader2 className="h-4 w-4 animate-spin" /> Validando...</> : "Tentar acesso existente"}
            </Button>
          </div>
        )}

        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            inputMode="numeric"
            value={chave}
            onChange={(value) => setChave(value.replace(/\D/g, "").slice(0, 6))}
            disabled={carregando}
            autoFocus
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, index) => (
                <InputOTPSlot
                  key={index}
                  index={index}
                  className="h-12 w-11 text-lg font-semibold sm:w-12"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        <div className="rounded-xl border bg-muted/25 p-3 text-xs leading-relaxed text-muted-foreground">
          <p className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            A chave é temporária, vale por 15 minutos e deixa de funcionar depois do primeiro uso.
          </p>
        </div>

        <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={carregando}>
          {carregando ? <><Loader2 className="h-4 w-4 animate-spin" /> Entrando...</> : "Entrar"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="h-11 w-full"
          onClick={onVoltar}
          disabled={carregando}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o acesso do responsável
        </Button>
      </form>
    </div>
  );
}
