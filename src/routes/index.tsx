import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Eye, EyeOff, Fingerprint, Home, Loader2, ShieldCheck, UserRound, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { msgErro } from "@/lib/db";
import { getAuthRedirectUrl, getPublicRouteFromUrl } from "@/lib/app-runtime";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import {
  autenticarComBiometria,
  biometriaAtivaNesteAparelho,
  liberarBiometriaNestaExecucao,
} from "@/lib/biometric-auth";
import { AcessoFilhoLogin } from "@/components/AcessoFilhoLogin";
import { PainelFilhoApp } from "@/components/PainelFilhoApp";
import {
  encerrarSessaoFilho,
  lerSessaoFilhoLocal,
  limparSessaoFilhoLocal,
  obterPainelFilhoApp,
  type PainelFilho,
} from "@/lib/child-app-session";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Combinado Família" }, { name: "description", content: "Cadastre filhos, tarefas e vigências e acompanhe as ocorrências de cada combinado." }, { property: "og:title", content: "Combinado — Tarefas da família com regras claras" }, { property: "og:description", content: "Cadastre filhos, tarefas e vigências e acompanhe as ocorrências de cada combinado." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Index,
});

const REGRAS_SENHA = [
  { id: "tam", label: "Pelo menos 8 caracteres", ok: (s: string) => s.length >= 8 },
  { id: "min", label: "Uma letra minúscula", ok: (s: string) => /[a-z]/.test(s) },
  { id: "mai", label: "Uma letra maiúscula", ok: (s: string) => /[A-Z]/.test(s) },
  { id: "num", label: "Um número", ok: (s: string) => /\d/.test(s) },
  { id: "especial", label: "Um caractere especial (ex.: !, @ ou #)", ok: (s: string) => /[^\p{L}\p{N}\s]/u.test(s) },
] as const;
const senhaValida = (s: string) => REGRAS_SENHA.every((r) => r.ok(s));
const cadastroSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  senha: z.string().max(72).refine(senhaValida, "A senha não atende aos requisitos abaixo"),
  confirmarSenha: z.string(),
}).refine((data) => data.senha === data.confirmarSenha, {
  path: ["confirmarSenha"],
  message: "As senhas não coincidem",
});

function SenhaInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  const [ver, setVer] = useState(false);
  return <div className="relative"><Input {...props} type={ver ? "text" : "password"} className={`pr-10 ${className ?? ""}`} /><button type="button" onClick={() => setVer(!ver)} aria-label={ver ? "Ocultar senha" : "Mostrar senha"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground">{ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>;
}

function Index() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [cad, setCad] = useState({ nome: "", email: "", senha: "", confirmarSenha: "" });
  const [login, setLogin] = useState({ email: "", senha: "" });
  const [recuperar, setRecuperar] = useState(false);
  const [emailRecuperacao, setEmailRecuperacao] = useState("");
  const [codigoRecuperacao, setCodigoRecuperacao] = useState("");
  const [recuperacaoAguardandoCodigo, setRecuperacaoAguardandoCodigo] = useState(false);
  const [segundosReenvioRecuperacao, setSegundosReenvioRecuperacao] = useState(0);
  const [codigoCadastro, setCodigoCadastro] = useState("");
  const [emailCadastroPendente, setEmailCadastroPendente] = useState("");
  const [biometriaAtiva, setBiometriaAtiva] = useState(false);
  const [sessaoBiometricaDisponivel, setSessaoBiometricaDisponivel] = useState(false);
  const [biometriaCarregando, setBiometriaCarregando] = useState(false);
  const [modoFilho, setModoFilho] = useState(false);
  const [painelFilho, setPainelFilho] = useState<PainelFilho | null>(null);
  const [checandoSessaoFilho, setChecandoSessaoFilho] = useState(true);

  useEffect(() => {
    if (segundosReenvioRecuperacao <= 0) return;
    const timer = window.setInterval(() => {
      setSegundosReenvioRecuperacao((atual) => Math.max(0, atual - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [segundosReenvioRecuperacao]);

  useEffect(() => {
    let ativo = true;

    async function encaminharSessaoExistente() {
      const tokenFilho = await lerSessaoFilhoLocal();
      if (!ativo) return;

      if (tokenFilho) {
        try {
          const painelSalvo = await obterPainelFilhoApp(tokenFilho);
          if (!ativo) return;

          if (painelSalvo) {
            setPainelFilho(painelSalvo);
            setChecandoSessaoFilho(false);
            return;
          }

          await limparSessaoFilhoLocal();
        } catch {
          // Enquanto existir uma credencial local do filho, não misture com a
          // sessão do responsável só porque houve uma falha temporária de rede.
          setModoFilho(true);
          setChecandoSessaoFilho(false);
          return;
        }
      }

      setChecandoSessaoFilho(false);

      if (Capacitor.isNativePlatform()) {
        const launch = await App.getLaunchUrl();
        const launchRoute = launch?.url ? getPublicRouteFromUrl(launch.url) : null;
        // O AppDeepLinkListener fará a navegação. Não deixe o redirect de login
        // sobrescrever um link público recebido na abertura fria do app.
        if (launchRoute && launchRoute !== "/") return;
      }

      const { data } = await supabase.auth.getSession();
      if (!ativo || !data.session) return;

      if (Capacitor.isNativePlatform()) {
        try {
          const ativa = await biometriaAtivaNesteAparelho();
          if (!ativo) return;
          setBiometriaAtiva(ativa);
          setSessaoBiometricaDisponivel(true);

          if (ativa) {
            setBiometriaCarregando(true);
            try {
              const autorizado = await autenticarComBiometria();
              if (ativo && autorizado) navigate({ to: "/inicio" });
            } catch {
              // Cancelar a biometria mantém o usuário na tela de login,
              // onde ainda é possível entrar normalmente com email e senha.
            } finally {
              if (ativo) setBiometriaCarregando(false);
            }
            return;
          }
        } catch {
          // Se o recurso biométrico não puder ser consultado, preserve o
          // comportamento anterior e não bloqueie uma sessão válida.
        }
      }

      if (ativo) navigate({ to: "/inicio" });
    }

    void encaminharSessaoExistente();
    return () => { ativo = false; };
  }, [navigate]);

  async function entrar(e: FormEvent) {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: login.email.trim().toLowerCase(),
      password: login.senha,
    });
    setLoading(false);
    if (error) { toast.error(msgErro(error)); return; }
    await limparSessaoFilhoLocal();
    liberarBiometriaNestaExecucao();
    navigate({ to: "/inicio" });
  }

  async function entrarComBiometria() {
    setBiometriaCarregando(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setSessaoBiometricaDisponivel(false);
        toast.error("Sua sessão expirou. Entre novamente com email e senha.");
        return;
      }

      const autorizado = await autenticarComBiometria();
      if (autorizado) {
        await limparSessaoFilhoLocal();
        navigate({ to: "/inicio" });
      }
    } catch {
      toast.error("Não foi possível validar a biometria. Você pode entrar com sua senha.");
    } finally {
      setBiometriaCarregando(false);
    }
  }

  async function solicitarCodigoRecuperacao() {
    const email = emailRecuperacao.trim().toLowerCase();
    if (!email || !z.string().email().safeParse(email).success) {
      toast.error("Informe um email válido.");
      return false;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);

    if (error) {
      const codigoErro = (error as { code?: string }).code;
      if (codigoErro === "over_email_send_rate_limit") {
        toast.error("Aguarde alguns segundos antes de solicitar outro código.");
        return false;
      }
      toast.error(msgErro(error));
      return false;
    }

    setRecuperacaoAguardandoCodigo(true);
    setSegundosReenvioRecuperacao(60);
    toast.success("Enviamos um código de 8 dígitos para seu email.");
    return true;
  }

  async function recuperarSenha(e: FormEvent) {
    e.preventDefault();

    if (!recuperacaoAguardandoCodigo) {
      await solicitarCodigoRecuperacao();
      return;
    }

    const email = emailRecuperacao.trim().toLowerCase();
    if (!/^\d{8}$/.test(codigoRecuperacao)) {
      toast.error("Digite o código de 8 dígitos.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: codigoRecuperacao,
      type: "recovery",
    });
    setLoading(false);

    if (error) {
      const codigoErro = (error as { code?: string }).code;
      if (codigoErro === "otp_expired") {
        toast.error("Esse código expirou ou não é mais válido. Solicite um novo código.");
        return;
      }
      toast.error(msgErro(error));
      return;
    }

    sessionStorage.setItem("combinado_recovery_otp_validado", "1");
    setCodigoRecuperacao("");
    setRecuperacaoAguardandoCodigo(false);
    setSegundosReenvioRecuperacao(0);
    navigate({ to: "/redefinir-senha" });
  }

  async function cadastrar(e: FormEvent) {
    e.preventDefault();

    if (emailCadastroPendente) {
      if (!/^\d{8}$/.test(codigoCadastro)) {
        toast.error("Digite o código de 8 dígitos.");
        return;
      }

      setLoading(true);
      const { error } = await supabase.auth.verifyOtp({
        email: emailCadastroPendente,
        token: codigoCadastro,
        type: "signup",
      });
      setLoading(false);

      if (error) { toast.error(msgErro(error)); return; }

      setCodigoCadastro("");
      setEmailCadastroPendente("");
      toast.success("Email confirmado com sucesso!");
      await limparSessaoFilhoLocal();
      navigate({ to: "/inicio" });
      return;
    }

    const parsed = cadastroSchema.safeParse(cad);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos"); return; }

    const email = parsed.data.email.toLowerCase();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: parsed.data.senha,
      options: {
        data: { nome: parsed.data.nome },
      },
    });
    setLoading(false);

    if (error) { toast.error(msgErro(error)); return; }

    if (data.user?.identities?.length === 0) {
      toast.error("Este email já está cadastrado. Tente entrar ou recuperar sua senha.");
      return;
    }
    if (!data.user) {
      toast.error("Não foi possível concluir o cadastro. Tente novamente.");
      return;
    }

    if (data.session) {
      await limparSessaoFilhoLocal();
      navigate({ to: "/inicio" });
      return;
    }

    setEmailCadastroPendente(email);
    toast.success("Enviamos um código de 8 dígitos para seu email.");
  }

  const carregando = loading || biometriaCarregando || checandoSessaoFilho;

  if (painelFilho) {
    return (
      <PainelFilhoApp
        painelInicial={painelFilho}
        onSair={() => {
          setPainelFilho(null);
          setModoFilho(false);
        }}
        onSessaoInvalida={() => {
          setPainelFilho(null);
          setModoFilho(false);
        }}
      />
    );
  }

  return (
    <div className="relative grid lg:min-h-screen lg:grid-cols-2">
      {carregando && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm" role="status" aria-live="polite">
          <div className="flex items-center gap-3 rounded-xl border bg-background px-5 py-4 shadow-lg">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Aguarde...</span>
          </div>
        </div>
      )}
      <section className="relative flex flex-col justify-between overflow-hidden bg-primary p-4 text-primary-foreground sm:p-6 md:p-8 lg:p-14">
        <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground sm:h-9 sm:w-9 lg:h-10 lg:w-10 lg:rounded-xl"><Home className="h-4 w-4 lg:h-5 lg:w-5" /></span><span className="flex flex-col items-start leading-none"><span className="font-display text-xl font-bold lg:text-2xl">Combinado</span><span className="-mt-0.5 text-[11px] font-semibold tracking-wide opacity-80 lg:-mt-1 lg:text-[13px]">família</span></span></div>
        <div className="my-4 sm:my-5 lg:my-12"><h1 className="max-w-lg text-4xl font-bold leading-tight md:text-6xl">Combinado é combinado. <span className="text-accent">Em família também.</span></h1><p className="mt-2 max-w-md text-sm leading-snug opacity-80 sm:text-base lg:mt-6 lg:text-lg lg:leading-normal">Defina tarefas e um período para cada filho. Cadastre uma penalidade escrita e um desconto por ocorrência: quem tem mesada recebe o desconto; quem não tem recebe a penalidade escrita. Acompanhe tudo em um só lugar.</p></div>
        <ul className="hidden gap-3 text-sm opacity-90 sm:grid sm:grid-cols-3 lg:grid"><li className="flex items-center gap-2"><Users className="h-4 w-4 text-accent" /> Vários filhos</li><li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-accent" /> Ocorrências claras</li><li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Dados privados</li></ul>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20" />
      </section>
      <section className="flex items-start justify-center p-4 sm:p-6 lg:items-center lg:p-14">
        <div className="w-full max-w-md">
          {modoFilho ? (
            <AcessoFilhoLogin
              onEntrou={(painel) => setPainelFilho(painel)}
              onVoltar={() => {
                void encerrarSessaoFilho().finally(() => setModoFilho(false));
              }}
            />
          ) : (
          <Tabs defaultValue="entrar">
            <TabsList className="mb-5 grid h-12 w-full grid-cols-2 p-1 lg:mb-6"><TabsTrigger value="entrar" className="h-10 text-sm font-semibold">Entrar</TabsTrigger><TabsTrigger value="cadastrar" className="h-10 text-sm font-semibold">Cadastrar</TabsTrigger></TabsList>
            <TabsContent value="entrar">
              {recuperar ? (
                <form onSubmit={recuperarSenha} className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="re">Email</Label><Input id="re" type="email" required autoFocus={!recuperacaoAguardandoCodigo} autoComplete="email" inputMode="email" value={emailRecuperacao} onChange={(e) => setEmailRecuperacao(e.target.value)} placeholder="seu@email.com" disabled={recuperacaoAguardandoCodigo} /></div>
                  {recuperacaoAguardandoCodigo && (
                    <div className="space-y-2">
                      <Label htmlFor="rc">Código de 8 dígitos</Label>
                      <Input id="rc" required autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={codigoRecuperacao} onChange={(e) => setCodigoRecuperacao(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="00000000" />
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">{recuperacaoAguardandoCodigo ? "Digite o código enviado para seu email." : "Enviaremos um código de 8 dígitos para você redefinir sua senha dentro do app."}</p>
                  <Button type="submit" className="w-full" size="lg" disabled={loading}>{loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Aguarde...</> : recuperacaoAguardandoCodigo ? "Validar código" : "Enviar código"}</Button>
                  {recuperacaoAguardandoCodigo && segundosReenvioRecuperacao === 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={loading}
                      onClick={() => void solicitarCodigoRecuperacao()}
                    >
                      Reenviar código
                    </Button>
                  )}
                  <Button type="button" variant="ghost" className="w-full" onClick={() => { setRecuperar(false); setRecuperacaoAguardandoCodigo(false); setCodigoRecuperacao(""); setSegundosReenvioRecuperacao(0); }} disabled={loading}>Voltar para entrar</Button>
                </form>
              ) : (
                <form onSubmit={entrar} className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="le">Email <span className="text-destructive" aria-hidden="true">*</span></Label><Input id="le" className="h-12 text-base" type="email" required autoComplete="email" inputMode="email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="ls">Senha <span className="text-destructive" aria-hidden="true">*</span></Label><SenhaInput id="ls" className="h-12 text-base" required autoComplete="current-password" value={login.senha} onChange={(e) => setLogin({ ...login, senha: e.target.value })} /></div>
                  <div className="text-right"><button type="button" className="text-sm font-medium text-primary underline-offset-4 hover:underline" onClick={() => { setEmailRecuperacao(login.email); setRecuperar(true); }}>Esqueci minha senha</button></div>
                  <Button type="submit" className="h-12 w-full text-base font-semibold" size="lg" disabled={loading || biometriaCarregando}>{loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Entrando...</> : "Entrar"}</Button>
                  {biometriaAtiva && sessaoBiometricaDisponivel && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-full text-base font-semibold"
                      size="lg"
                      disabled={loading || biometriaCarregando}
                      onClick={() => void entrarComBiometria()}
                    >
                      <Fingerprint className="h-5 w-5" />
                      {biometriaCarregando ? "Validando biometria..." : "Entrar com biometria"}
                    </Button>
                  )}
                  <div className="flex items-center gap-3 py-1" aria-hidden="true">
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-xs font-medium text-muted-foreground">ou</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full text-base font-semibold"
                    onClick={() => setModoFilho(true)}
                    disabled={loading || biometriaCarregando}
                  >
                    <UserRound className="h-5 w-5" />
                    Entrar como filho
                  </Button>
                </form>
              )}
            </TabsContent>
            <TabsContent value="cadastrar">
              <h2 className="mb-4 text-2xl font-bold sm:text-3xl lg:mb-6">Cadastrar usuário responsável</h2>
              <form onSubmit={cadastrar} className="space-y-4">
                {emailCadastroPendente ? (
                  <>
                    <p className="text-sm text-muted-foreground">Enviamos um código de 8 dígitos para <strong>{emailCadastroPendente}</strong>.</p>
                    <div className="space-y-2"><Label htmlFor="ccodigo">Código de 8 dígitos <span className="text-destructive" aria-hidden="true">*</span></Label><Input id="ccodigo" autoFocus required inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={codigoCadastro} onChange={(e) => setCodigoCadastro(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="00000000" /></div>
                  </>
                ) : (
                  <>
                <div className="space-y-2"><Label htmlFor="cn">Nome <span className="text-destructive" aria-hidden="true">*</span></Label><Input id="cn" autoComplete="name" value={cad.nome} onChange={(e) => setCad({ ...cad, nome: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="ce">Email <span className="text-destructive" aria-hidden="true">*</span></Label><Input id="ce" type="email" autoComplete="email" inputMode="email" value={cad.email} onChange={(e) => setCad({ ...cad, email: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="cs">Senha <span className="text-destructive" aria-hidden="true">*</span></Label><SenhaInput id="cs" autoComplete="new-password" value={cad.senha} onChange={(e) => setCad({ ...cad, senha: e.target.value })} /><ul className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 text-[11px] sm:text-xs" aria-live="polite">{REGRAS_SENHA.map((r) => { const ok = r.ok(cad.senha); return <li key={r.id} className={ok ? "text-success" : "text-destructive"}>{r.label}</li>; })}</ul></div>
                <div className="space-y-2"><Label htmlFor="ccs">Confirmar senha <span className="text-destructive" aria-hidden="true">*</span></Label><SenhaInput id="ccs" autoComplete="new-password" value={cad.confirmarSenha} onChange={(e) => setCad({ ...cad, confirmarSenha: e.target.value })} /><p className={`text-sm ${cad.confirmarSenha && cad.confirmarSenha !== cad.senha ? "text-destructive" : "text-muted-foreground"}`}>{cad.confirmarSenha && cad.confirmarSenha !== cad.senha ? "As senhas não coincidem." : "Digite novamente a senha para confirmar."}</p></div>
                  </>
                )}
                <Button type="submit" className="w-full" size="lg" disabled={loading}>{loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Aguarde...</> : emailCadastroPendente ? "Confirmar código" : "Cadastrar"}</Button>
                {emailCadastroPendente && <Button type="button" variant="ghost" className="w-full" disabled={loading} onClick={() => { setEmailCadastroPendente(""); setCodigoCadastro(""); }}>Voltar para cadastro</Button>}
              </form>
            </TabsContent>
          </Tabs>
          )}
        </div>
      </section>
    </div>
  );
}
