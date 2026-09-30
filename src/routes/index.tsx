import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Check, CheckCircle2, Eye, EyeOff, Home, ShieldCheck, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { maskCpf, msgErro } from "@/lib/db";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Combinado — Tarefas da família com regras claras" },
      { name: "description", content: "Cadastre filhos, tarefas e vigências e acompanhe as ocorrências de cada combinado." },
      { property: "og:title", content: "Combinado — Tarefas da família com regras claras" },
      { property: "og:description", content: "Cadastre filhos, tarefas e vigências e acompanhe as ocorrências de cada combinado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const REGRAS_SENHA = [
  { id: "tam", label: "Pelo menos 6 caracteres", ok: (s: string) => s.length >= 6 },
  { id: "mai", label: "Uma letra maiúscula", ok: (s: string) => /[A-Z]/.test(s) },
  { id: "num", label: "Um número", ok: (s: string) => /\d/.test(s) },
] as const;

const senhaValida = (s: string) => REGRAS_SENHA.every((r) => r.ok(s));

const cadastroSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  cpf: z.string().refine((v) => v.replace(/\D/g, "").length === 11, "CPF deve ter 11 dígitos"),
  senha: z.string().max(72).refine(senhaValida, "A senha não atende aos requisitos abaixo"),
});

function SenhaInput(props: React.ComponentProps<typeof Input>) {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={ver ? "text" : "password"} className="pr-10" />
      <button
        type="button"
        onClick={() => setVer(!ver)}
        aria-label={ver ? "Ocultar senha" : "Mostrar senha"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
      >
        {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Index() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [cad, setCad] = useState({ nome: "", email: "", cpf: "", senha: "" });
  const [login, setLogin] = useState({ email: "", senha: "" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/ocorrencias" });
    });
  }, [navigate]);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: login.email.trim(), password: login.senha });
    setLoading(false);
    if (error) { toast.error("Email ou senha incorretos, ou email ainda não confirmado."); return; }
    navigate({ to: "/ocorrencias" });
  }

  async function cadastrar(e: FormEvent) {
    e.preventDefault();
    const parsed = cadastroSchema.safeParse(cad);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos"); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.senha,
      options: {
        emailRedirectTo: window.location.origin,
        data: { nome: parsed.data.nome, cpf: parsed.data.cpf.replace(/\D/g, "") },
      },
    });
    setLoading(false);
    if (error) { toast.error(msgErro(error)); return; }
    if (data.session) navigate({ to: "/ocorrencias" });
    else toast.success("Cadastro realizado! Confirme seu email para entrar.");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative flex flex-col justify-between overflow-hidden bg-primary p-8 text-primary-foreground md:p-14">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Home className="h-5 w-5" />
          </span>
          <span className="font-display text-2xl font-bold">Combinado</span>
        </div>
        <div className="my-12">
          <h1 className="max-w-lg text-4xl font-bold leading-tight md:text-6xl">
            Combinado é combinado. <span className="text-accent">Em casa também.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg opacity-80">
            Defina tarefas para cada filho, um período de vigência e a penalidade. Marque quando algo não foi feito e acompanhe tudo num só lugar.
          </p>
        </div>
        <ul className="grid gap-3 text-sm opacity-90 sm:grid-cols-3">
          <li className="flex items-center gap-2"><Users className="h-4 w-4 text-accent" /> Vários filhos</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-accent" /> Ocorrências claras</li>
          <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Dados privados</li>
        </ul>
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20" />
      </section>

      <section className="flex items-center justify-center p-6 md:p-14">
        <div className="w-full max-w-md">
          <Tabs defaultValue="entrar">
            <TabsList className="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="entrar">Entrar</TabsTrigger>
              <TabsTrigger value="cadastrar">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="entrar">
              <h2 className="text-3xl font-bold">Bem-vindo de volta</h2>
              <p className="mb-6 mt-1 text-muted-foreground">Acesse sua conta de responsável.</p>
              <form onSubmit={entrar} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="le">Email</Label>
                  <Input id="le" type="email" required value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ls">Senha</Label>
                  <SenhaInput id="ls" required value={login.senha} onChange={(e) => setLogin({ ...login, senha: e.target.value })} />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={loading}>Entrar</Button>
              </form>
            </TabsContent>

            <TabsContent value="cadastrar">
              <h2 className="text-3xl font-bold">Cadastrar usuário pai</h2>
              <p className="mb-6 mt-1 text-muted-foreground">Crie a conta do responsável pela família.</p>
              <form onSubmit={cadastrar} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cn">Nome</Label>
                  <Input id="cn" value={cad.nome} onChange={(e) => setCad({ ...cad, nome: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ce">Email</Label>
                  <Input id="ce" type="email" value={cad.email} onChange={(e) => setCad({ ...cad, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cc">CPF</Label>
                  <Input id="cc" inputMode="numeric" placeholder="000.000.000-00" value={cad.cpf} onChange={(e) => setCad({ ...cad, cpf: maskCpf(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cs">Senha</Label>
                  <SenhaInput id="cs" value={cad.senha} onChange={(e) => setCad({ ...cad, senha: e.target.value })} />
                  <ul className="space-y-1 pt-1 text-sm" aria-live="polite">
                    {REGRAS_SENHA.map((r) => {
                      const ok = r.ok(cad.senha);
                      return (
                        <li key={r.id} className={`flex items-center gap-1.5 ${ok ? "text-success" : "text-muted-foreground"}`}>
                          {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                          {r.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={loading}>Cadastrar</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}
