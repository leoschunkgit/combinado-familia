import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Baby,
  BellRing,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Globe2,
  ListTodo,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  ThumbsDown,
  ThumbsUp,
  Users,
  UserCheck,
  Workflow,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uiTypography } from "@/lib/ui-typography";
import { uiSpacing } from "@/lib/ui-spacing";
import { getAppEnvironment } from "@/lib/app-runtime";
import { AdminSistema } from "@/components/admin/AdminSistema";
import { AdminAuditoria } from "@/components/admin/AdminAuditoria";
import { AdminAdministradores } from "@/components/admin/AdminAdministradores";
import { AdminFeedbacks } from "@/components/admin/AdminFeedbacks";
import { AdminLimpeza } from "@/components/admin/AdminLimpeza";

type Aba = "visao" | "usuarios" | "feedbacks" | "limpeza" | "atencao" | "funil" | "atividade" | "versoes" | "push" | "saude" | "sistema" | "auditoria" | "administradores";

type CategoriaAtencao =
  | "onboarding_pendente"
  | "sem_vigencia"
  | "sem_atribuicao"
  | "sem_acesso_15d"
  | "versao_desatualizada"
  | "sem_push_ativo";

type AdminResumo = {
  usuarios: number;
  usuarios_7d: number;
  usuarios_30d: number;
  onboarding_concluido: number;
  filhos: number;
  tarefas: number;
  vigencias_ativas: number;
  vigencias_finalizadas: number;
  atribuicoes: number;
  fez_hoje: number;
  nao_fez_hoje: number;
  push_dispositivos: number;
  push_ativos: number;
  push_android_ativos: number;
  push_ios_ativos: number;
  push_envios_hoje: number;
  admins_ativos: number;
};

type AdminUsuario = {
  id: number;
  nome: string;
  email: string;
  created_at: string;
  onboarding_concluido: boolean;
  qtd_filhos: number;
  qtd_tarefas: number;
  qtd_vigencias: number;
  qtd_atribuicoes: number;
  ultimo_movimento: string;
};

type Versao = {
  versionName: string;
  versionCode: number;
};

type VersaoUso = {
  plataforma: string;
  version_name: string | null;
  version_code: number | null;
  usuarios: number;
};

type AdminAtencaoUsuario = {
  id: number;
  nome: string;
  email: string;
  created_at: string;
  last_seen_at: string | null;
  plataforma: string | null;
  version_name: string | null;
  version_code: number | null;
};

type AdminDiagnostico = {
  atencao: Record<CategoriaAtencao, AdminAtencaoUsuario[]>;
  funil: {
    cadastrados: number;
    onboarding: number;
    com_filho: number;
    com_tarefa: number;
    com_vigencia: number;
    com_atribuicao: number;
    com_marcacao: number;
  };
};

type AdminOperacao = {
  atividade: {
    usuarios_monitorados: number;
    usuarios_sem_telemetria: number;
    ativos_hoje: number;
    ativos_7d: number;
    ativos_30d: number;
    ultimo_acesso: string | null;
  };
  plataformas: {
    web: number;
    android: number;
    ios: number;
  };
  versoes: VersaoUso[];
  saude: {
    banco_agora: string | null;
    cron_push_configurado: boolean;
    ultimo_push_envio: string | null;
    ultima_referencia_push: string | null;
  };
};

const RESUMO_VAZIO: AdminResumo = {
  usuarios: 0,
  usuarios_7d: 0,
  usuarios_30d: 0,
  onboarding_concluido: 0,
  filhos: 0,
  tarefas: 0,
  vigencias_ativas: 0,
  vigencias_finalizadas: 0,
  atribuicoes: 0,
  fez_hoje: 0,
  nao_fez_hoje: 0,
  push_dispositivos: 0,
  push_ativos: 0,
  push_android_ativos: 0,
  push_ios_ativos: 0,
  push_envios_hoje: 0,
  admins_ativos: 0,
};

const DIAGNOSTICO_VAZIO: AdminDiagnostico = {
  atencao: {
    onboarding_pendente: [],
    sem_vigencia: [],
    sem_atribuicao: [],
    sem_acesso_15d: [],
    versao_desatualizada: [],
    sem_push_ativo: [],
  },
  funil: {
    cadastrados: 0,
    onboarding: 0,
    com_filho: 0,
    com_tarefa: 0,
    com_vigencia: 0,
    com_atribuicao: 0,
    com_marcacao: 0,
  },
};

const OPERACAO_VAZIA: AdminOperacao = {
  atividade: {
    usuarios_monitorados: 0,
    usuarios_sem_telemetria: 0,
    ativos_hoje: 0,
    ativos_7d: 0,
    ativos_30d: 0,
    ultimo_acesso: null,
  },
  plataformas: { web: 0, android: 0, ios: 0 },
  versoes: [],
  saude: {
    banco_agora: null,
    cron_push_configurado: false,
    ultimo_push_envio: null,
    ultima_referencia_push: null,
  },
};

function numero(valor: unknown) {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizarResumo(data: unknown): AdminResumo {
  const r = data && typeof data === "object" ? data as Record<string, unknown> : {};
  return {
    usuarios: numero(r["usuarios"]),
    usuarios_7d: numero(r["usuarios_7d"]),
    usuarios_30d: numero(r["usuarios_30d"]),
    onboarding_concluido: numero(r["onboarding_concluido"]),
    filhos: numero(r["filhos"]),
    tarefas: numero(r["tarefas"]),
    vigencias_ativas: numero(r["vigencias_ativas"]),
    vigencias_finalizadas: numero(r["vigencias_finalizadas"]),
    atribuicoes: numero(r["atribuicoes"]),
    fez_hoje: numero(r["fez_hoje"]),
    nao_fez_hoje: numero(r["nao_fez_hoje"]),
    push_dispositivos: numero(r["push_dispositivos"]),
    push_ativos: numero(r["push_ativos"]),
    push_android_ativos: numero(r["push_android_ativos"]),
    push_ios_ativos: numero(r["push_ios_ativos"]),
    push_envios_hoje: numero(r["push_envios_hoje"]),
    admins_ativos: numero(r["admins_ativos"]),
  };
}

function normalizarDiagnostico(data: unknown): AdminDiagnostico {
  if (!data || typeof data !== "object") return DIAGNOSTICO_VAZIO;
  const raiz = data as Record<string, unknown>;
  const atencao = raiz["atencao"] && typeof raiz["atencao"] === "object"
    ? raiz["atencao"] as Record<string, unknown>
    : {};
  const funil = raiz["funil"] && typeof raiz["funil"] === "object"
    ? raiz["funil"] as Record<string, unknown>
    : {};

  const lista = (chave: CategoriaAtencao): AdminAtencaoUsuario[] => {
    const itens = Array.isArray(atencao[chave]) ? atencao[chave] as unknown[] : [];
    return itens
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({
        id: numero(item["id"]),
        nome: typeof item["nome"] === "string" ? item["nome"] : "Usuário",
        email: typeof item["email"] === "string" ? item["email"] : "",
        created_at: typeof item["created_at"] === "string" ? item["created_at"] : "",
        last_seen_at: typeof item["last_seen_at"] === "string" ? item["last_seen_at"] : null,
        plataforma: typeof item["plataforma"] === "string" ? item["plataforma"] : null,
        version_name: typeof item["version_name"] === "string" ? item["version_name"] : null,
        version_code: item["version_code"] === null || item["version_code"] === undefined ? null : numero(item["version_code"]),
      }));
  };

  return {
    atencao: {
      onboarding_pendente: lista("onboarding_pendente"),
      sem_vigencia: lista("sem_vigencia"),
      sem_atribuicao: lista("sem_atribuicao"),
      sem_acesso_15d: lista("sem_acesso_15d"),
      versao_desatualizada: lista("versao_desatualizada"),
      sem_push_ativo: lista("sem_push_ativo"),
    },
    funil: {
      cadastrados: numero(funil["cadastrados"]),
      onboarding: numero(funil["onboarding"]),
      com_filho: numero(funil["com_filho"]),
      com_tarefa: numero(funil["com_tarefa"]),
      com_vigencia: numero(funil["com_vigencia"]),
      com_atribuicao: numero(funil["com_atribuicao"]),
      com_marcacao: numero(funil["com_marcacao"]),
    },
  };
}

function normalizarOperacao(data: unknown): AdminOperacao {
  if (!data || typeof data !== "object") return OPERACAO_VAZIA;
  const raiz = data as Record<string, unknown>;
  const atividade = raiz["atividade"] && typeof raiz["atividade"] === "object"
    ? raiz["atividade"] as Record<string, unknown>
    : {};
  const plataformas = raiz["plataformas"] && typeof raiz["plataformas"] === "object"
    ? raiz["plataformas"] as Record<string, unknown>
    : {};
  const saude = raiz["saude"] && typeof raiz["saude"] === "object"
    ? raiz["saude"] as Record<string, unknown>
    : {};
  const versoesBrutas = Array.isArray(raiz["versoes"]) ? raiz["versoes"] : [];

  return {
    atividade: {
      usuarios_monitorados: numero(atividade["usuarios_monitorados"]),
      usuarios_sem_telemetria: numero(atividade["usuarios_sem_telemetria"]),
      ativos_hoje: numero(atividade["ativos_hoje"]),
      ativos_7d: numero(atividade["ativos_7d"]),
      ativos_30d: numero(atividade["ativos_30d"]),
      ultimo_acesso: typeof atividade["ultimo_acesso"] === "string" ? atividade["ultimo_acesso"] : null,
    },
    plataformas: {
      web: numero(plataformas["web"]),
      android: numero(plataformas["android"]),
      ios: numero(plataformas["ios"]),
    },
    versoes: versoesBrutas
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({
        plataforma: typeof item["plataforma"] === "string" ? item["plataforma"] : "—",
        version_name: typeof item["version_name"] === "string" ? item["version_name"] : null,
        version_code: item["version_code"] === null ? null : numero(item["version_code"]),
        usuarios: numero(item["usuarios"]),
      })),
    saude: {
      banco_agora: typeof saude["banco_agora"] === "string" ? saude["banco_agora"] : null,
      cron_push_configurado: saude["cron_push_configurado"] === true,
      ultimo_push_envio: typeof saude["ultimo_push_envio"] === "string" ? saude["ultimo_push_envio"] : null,
      ultima_referencia_push: typeof saude["ultima_referencia_push"] === "string" ? saude["ultima_referencia_push"] : null,
    },
  };
}

function formatarNumero(valor: number) {
  return new Intl.NumberFormat("pt-BR").format(valor);
}

function formatarDataHora(valor: string | null) {
  if (!valor) return "Ainda não registrado";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(data);
}

function nomePlataforma(plataforma: string) {
  if (plataforma === "android") return "Android";
  if (plataforma === "ios") return "iOS";
  if (plataforma === "web") return "Web";
  return plataforma;
}

function Indicador({
  titulo,
  valor,
  detalhe,
  icon,
}: {
  titulo: string;
  valor: number | string;
  detalhe?: string;
  icon: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
          <p className="mt-1 text-lg font-bold leading-tight tabular-nums">
            {typeof valor === "number" ? formatarNumero(valor) : valor}
          </p>
          {detalhe && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detalhe}</p>}
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
      </div>
    </div>
  );
}

function AdministracaoPage() {
  const ambiente = getAppEnvironment();
  const [aba, setAba] = useState<Aba>("sistema");
  const [resumo, setResumo] = useState<AdminResumo>(RESUMO_VAZIO);
  const [operacao, setOperacao] = useState<AdminOperacao>(OPERACAO_VAZIA);
  const [diagnostico, setDiagnostico] = useState<AdminDiagnostico>(DIAGNOSTICO_VAZIO);
  const [categoriaAtencao, setCategoriaAtencao] = useState<CategoriaAtencao>("onboarding_pendente");
  const [usuarios, setUsuarios] = useState<AdminUsuario[]>([]);
  const [versao, setVersao] = useState<Versao | null>(null);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ehMaster, setEhMaster] = useState(false);
  const abasRef = useRef<HTMLDivElement | null>(null);
  const [podeIrEsquerda, setPodeIrEsquerda] = useState(false);
  const [podeIrDireita, setPodeIrDireita] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const versaoResult = await fetch("/app-version.json", { cache: "no-store" })
      .then(async (response) => response.ok ? await response.json() as Versao : null)
      .catch(() => null);

    const [resumoResult, usuariosResult, operacaoResult, diagnosticoResult, adminsResult] = await Promise.all([
      supabase.rpc("admin_resumo"),
      supabase.rpc("admin_usuarios"),
      supabase.rpc("admin_operacao"),
      supabase.rpc("admin_diagnostico", {
        p_version_name: versaoResult?.versionName ?? null,
        p_version_code: versaoResult?.versionCode ?? null,
      }),
      supabase.rpc("admin_listar_admins"),
    ]);

    if (resumoResult.error || usuariosResult.error || operacaoResult.error || diagnosticoResult.error || adminsResult.error) {
      setErro("Não foi possível carregar os dados administrativos.");
      setCarregando(false);
      return;
    }

    setResumo(normalizarResumo(resumoResult.data));
    setUsuarios((usuariosResult.data ?? []) as AdminUsuario[]);
    setOperacao(normalizarOperacao(operacaoResult.data));
    setDiagnostico(normalizarDiagnostico(diagnosticoResult.data));
    setEhMaster(
      ((adminsResult.data ?? []) as Array<{ eh_atual?: boolean; nivel?: string }>).some(
        (admin) => admin.eh_atual === true && admin.nivel === "MASTER",
      ),
    );
    setVersao(versaoResult);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    void supabase.rpc("admin_registrar_acesso");
  }, []);

  const atualizarSetasAbas = useCallback(() => {
    const elemento = abasRef.current;
    if (!elemento) return;
    setPodeIrEsquerda(elemento.scrollLeft > 4);
    setPodeIrDireita(elemento.scrollLeft + elemento.clientWidth < elemento.scrollWidth - 4);
  }, []);

  const rolarAbas = useCallback((direcao: "esquerda" | "direita") => {
    const elemento = abasRef.current;
    if (!elemento) return;
    elemento.scrollBy({
      left: direcao === "direita" ? Math.max(180, elemento.clientWidth * 0.65) : -Math.max(180, elemento.clientWidth * 0.65),
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    atualizarSetasAbas();
    const elemento = abasRef.current;
    if (!elemento) return;

    const aoRolar = () => atualizarSetasAbas();
    const aoRedimensionar = () => atualizarSetasAbas();

    elemento.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRedimensionar);

    return () => {
      elemento.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRedimensionar);
    };
  }, [atualizarSetasAbas]);

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return usuarios;
    return usuarios.filter((usuario) =>
      usuario.nome.toLocaleLowerCase("pt-BR").includes(termo)
      || usuario.email.toLocaleLowerCase("pt-BR").includes(termo)
    );
  }, [busca, usuarios]);

  const taxaOnboarding = resumo.usuarios > 0
    ? Math.round((resumo.onboarding_concluido / resumo.usuarios) * 100)
    : 0;

  const abas: Array<{ id: Aba; label: string }> = [
    { id: "sistema", label: "Sistema" },
    { id: "administradores", label: "Administradores" },
    { id: "feedbacks", label: "Feedbacks" },
    { id: "visao", label: "Visão geral" },
    { id: "usuarios", label: "Usuários" },
    ...(ehMaster ? [{ id: "limpeza" as const, label: "Limpeza" }] : []),
    { id: "atencao", label: "Atenção" },
    { id: "funil", label: "Funil" },
    { id: "atividade", label: "Atividade" },
    { id: "versoes", label: "Versões" },
    { id: "push", label: "Push" },
    { id: "saude", label: "Saúde" },
    { id: "auditoria", label: "Auditoria" },
  ];

  return (
    <div className={uiSpacing.pageStack}>
      <PageHeader
        title="Administração"
        description="Acompanhe os principais indicadores do Combinado Família sem abrir o conteúdo das famílias."
        icon={<ShieldCheck className="h-6 w-6" />}
        action={
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-8 shrink-0 items-center rounded-full border px-2.5 text-[11px] font-bold tracking-wide ${ambiente === "DEV"
                ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                : "border-primary/30 bg-primary/10 text-primary"
              }`}
              title={`Ambiente ${ambiente}`}
              aria-label={`Ambiente ${ambiente}`}
            >
              {ambiente}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-md"
              onClick={() => void carregar()}
              disabled={carregando}
              aria-label="Atualizar dados administrativos"
            >
              <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center bg-transparent p-0 text-muted-foreground transition-colors hover:bg-transparent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-30 disabled:hover:text-muted-foreground"
          onClick={() => rolarAbas("esquerda")}
          disabled={!podeIrEsquerda}
          aria-label="Rolar menu administrativo para a esquerda"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div
          ref={abasRef}
          className="flex min-w-0 flex-1 gap-2 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {abas.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={aba === item.id ? "default" : "outline"}
              className="shrink-0"
              onClick={() => setAba(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center bg-transparent p-0 text-muted-foreground transition-colors hover:bg-transparent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-30 disabled:hover:text-muted-foreground"
          onClick={() => rolarAbas("direita")}
          disabled={!podeIrDireita}
          aria-label="Rolar menu administrativo para a direita"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {erro && (
        <div className="rounded-xl border border-destructive/30 bg-card p-4">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="min-w-0">
              <p className="font-semibold text-destructive">Erro ao carregar</p>
              <p className="mt-1 text-sm text-muted-foreground">{erro}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void carregar()}>
                Tentar novamente
              </Button>
            </div>
          </div>
        </div>
      )}

      {!erro && carregando && (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Carregando dados administrativos...
        </div>
      )}

      {!erro && !carregando && aba === "visao" && (
        <div className={uiSpacing.sectionStack}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Indicador
              titulo="Usuários"
              valor={resumo.usuarios}
              detalhe={`+${formatarNumero(resumo.usuarios_7d)} em 7 dias · +${formatarNumero(resumo.usuarios_30d)} em 30 dias`}
              icon={<Users className="h-4 w-4" />}
            />
            <Indicador titulo="Filhos" valor={resumo.filhos} icon={<Baby className="h-4 w-4" />} />
            <Indicador titulo="Vigências ativas" valor={resumo.vigencias_ativas} icon={<CalendarRange className="h-4 w-4" />} />
            <Indicador titulo="Fez hoje" valor={resumo.fez_hoje} icon={<ThumbsUp className="h-4 w-4" />} />
            <Indicador titulo="Não fez hoje" valor={resumo.nao_fez_hoje} icon={<ThumbsDown className="h-4 w-4" />} />
          </div>

          <section className={uiSpacing.sectionCard}>
            <h2 className={uiTypography.secondaryTitle}>Uso e configuração</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">Onboarding concluído</p>
                <p className="mt-1 text-lg font-bold">{taxaOnboarding}%</p>
                <p className="text-xs text-muted-foreground">{formatarNumero(resumo.onboarding_concluido)} de {formatarNumero(resumo.usuarios)} usuários</p>
              </div>
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">Tarefas</p>
                <p className="mt-1 text-lg font-bold">{formatarNumero(resumo.tarefas)}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">Atribuições</p>
                <p className="mt-1 text-lg font-bold">{formatarNumero(resumo.atribuicoes)}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">Vigências finalizadas</p>
                <p className="mt-1 text-lg font-bold">{formatarNumero(resumo.vigencias_finalizadas)}</p>
              </div>
            </div>
          </section>
        </div>
      )}

      {!erro && !carregando && aba === "usuarios" && (
        <div className={uiSpacing.sectionStack}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className={uiTypography.secondaryTitle}>Usuários cadastrados</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Informações administrativas básicas. O conteúdo das famílias não é exibido.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Pesquisar usuário..."
                className="pl-9"
                aria-label="Pesquisar usuário"
              />
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {usuariosFiltrados.map((usuario) => (
              <article key={usuario.id} className="rounded-2xl border bg-card p-4">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{usuario.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">{usuario.email}</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">Cadastro</p>
                    <p className="mt-0.5 text-xs font-medium">{formatarDataHora(usuario.created_at)}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">Onboarding</p>
                    <p className="mt-0.5 text-xs font-medium">{usuario.onboarding_concluido ? "Concluído" : "Pendente"}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">Filhos / tarefas</p>
                    <p className="mt-0.5 font-medium">{usuario.qtd_filhos} / {usuario.qtd_tarefas}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">Vigências / atribuições</p>
                    <p className="mt-0.5 font-medium">{usuario.qtd_vigencias} / {usuario.qtd_atribuicoes}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Último movimento: {formatarDataHora(usuario.ultimo_movimento)}</p>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Usuário</th>
                  <th className="px-3 py-3 font-semibold">Cadastro</th>
                  <th className="px-3 py-3 font-semibold">Onboarding</th>
                  <th className="px-3 py-3 text-center font-semibold">Filhos</th>
                  <th className="px-3 py-3 text-center font-semibold">Tarefas</th>
                  <th className="px-3 py-3 text-center font-semibold">Vigências</th>
                  <th className="px-3 py-3 text-center font-semibold">Atribuições</th>
                  <th className="px-4 py-3 font-semibold">Último movimento</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {usuariosFiltrados.map((usuario) => (
                  <tr key={usuario.id}>
                    <td className="px-4 py-3">
                      <p className="max-w-52 truncate font-semibold">{usuario.nome}</p>
                      <p className="max-w-52 truncate text-xs text-muted-foreground">{usuario.email}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{formatarDataHora(usuario.created_at)}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${usuario.onboarding_concluido ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {usuario.onboarding_concluido ? "Concluído" : "Pendente"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center tabular-nums">{usuario.qtd_filhos}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{usuario.qtd_tarefas}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{usuario.qtd_vigencias}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{usuario.qtd_atribuicoes}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatarDataHora(usuario.ultimo_movimento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {usuariosFiltrados.length === 0 && (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhum usuário encontrado.
            </div>
          )}
        </div>
      )}

      {!erro && !carregando && aba === "atencao" && (() => {
        const categorias: Array<{ id: CategoriaAtencao; label: string; descricao: string }> = [
          { id: "onboarding_pendente", label: "Onboarding pendente", descricao: "Ainda não concluíram o onboarding" },
          { id: "sem_vigencia", label: "Sem vigência", descricao: "Ainda não criaram nenhuma vigência" },
          { id: "sem_atribuicao", label: "Sem atribuições", descricao: "Ainda não possuem atribuições" },
          { id: "sem_acesso_15d", label: "Sem acesso há 15 dias", descricao: "Monitorados sem acesso recente" },
          { id: "versao_desatualizada", label: "Versão desatualizada", descricao: "Usando versão abaixo da atual" },
          { id: "sem_push_ativo", label: "Sem push ativo", descricao: "Nenhum dispositivo com push ativo" },
        ];
        const selecionada = categorias.find((item) => item.id === categoriaAtencao) ?? categorias[0]!;
        const listaSelecionada = diagnostico.atencao[categoriaAtencao];

        return (
          <div className={uiSpacing.sectionStack}>
            <div>
              <h2 className={uiTypography.secondaryTitle}>Usuários que precisam de atenção</h2>
              <p className="mt-1 text-sm text-muted-foreground">Clique em um indicador para ver os usuários daquele grupo.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {categorias.map((item) => {
                const ativo = categoriaAtencao === item.id;
                const total = diagnostico.atencao[item.id].length;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategoriaAtencao(item.id)}
                    className={`min-w-0 rounded-xl border p-4 text-left shadow-sm transition-colors ${ativo ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/20"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-xs font-bold ${ativo ? "text-primary" : "text-muted-foreground"}`}>{item.label}</p>
                        <p className="mt-1 text-lg font-bold tabular-nums">{formatarNumero(total)}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.descricao}</p>
                      </div>
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ativo ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <section className={uiSpacing.sectionCard}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className={uiTypography.secondaryTitle}>{selecionada.label}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{selecionada.descricao}</p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                  {formatarNumero(listaSelecionada.length)}
                </span>
              </div>

              {listaSelecionada.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhum usuário neste grupo.
                </div>
              ) : (
                <div className="mt-4 divide-y rounded-xl border">
                  {listaSelecionada.map((usuario) => (
                    <div key={usuario.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{usuario.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">{usuario.email}</p>
                      </div>
                      <div className="shrink-0 text-xs text-muted-foreground sm:text-right">
                        <p>{usuario.plataforma ? nomePlataforma(usuario.plataforma) : "Plataforma ainda não registrada"}</p>
                        <p>{usuario.last_seen_at ? `Último acesso: ${formatarDataHora(usuario.last_seen_at)}` : "Acesso ainda não monitorado"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <p className="text-xs leading-relaxed text-muted-foreground">
              “Sem acesso há 15 dias” considera apenas usuários que já passaram a ter telemetria. “Sem push ativo” não significa necessariamente erro: o usuário pode estar usando somente a web ou ter recusado notificações.
            </p>
          </div>
        );
      })()}

      {!erro && !carregando && aba === "funil" && (() => {
        const total = diagnostico.funil.cadastrados;
        const etapas = [
          { label: "Cadastrou a conta", valor: diagnostico.funil.cadastrados },
          { label: "Concluiu o onboarding", valor: diagnostico.funil.onboarding },
          { label: "Cadastrou filho", valor: diagnostico.funil.com_filho },
          { label: "Cadastrou tarefa", valor: diagnostico.funil.com_tarefa },
          { label: "Criou vigência", valor: diagnostico.funil.com_vigencia },
          { label: "Fez atribuição", valor: diagnostico.funil.com_atribuicao },
          { label: "Registrou Fez / Não fez", valor: diagnostico.funil.com_marcacao },
        ];

        return (
          <div className={uiSpacing.sectionStack}>
            <div>
              <h2 className={uiTypography.secondaryTitle}>Funil de uso</h2>
              <p className="mt-1 text-sm text-muted-foreground">Mostra até onde os usuários avançaram na configuração e no uso do Combinado Família.</p>
            </div>

            <section className={uiSpacing.sectionCard}>
              <div className="space-y-3">
                {etapas.map((etapa, index) => {
                  const percentual = total > 0 ? Math.round((etapa.valor / total) * 100) : 0;
                  return (
                    <div key={etapa.label}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
                          <span className="truncate font-semibold">{etapa.label}</span>
                        </div>
                        <span className="shrink-0 font-bold tabular-nums">{formatarNumero(etapa.valor)} · {percentual}%</span>
                      </div>
                      <div className="ml-9 mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, percentual)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className={uiSpacing.sectionCard}>
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Workflow className="h-4 w-4" />
                </span>
                <div>
                  <h3 className={uiTypography.secondaryTitle}>Leitura do funil</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    A diferença entre uma etapa e a seguinte ajuda a identificar onde os usuários param. Os percentuais usam o total de contas cadastradas como base.
                  </p>
                </div>
              </div>
            </section>
          </div>
        );
      })()}

      {!erro && !carregando && aba === "atividade" && (
        <div className={uiSpacing.sectionStack}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Indicador titulo="Ativos hoje" valor={operacao.atividade.ativos_hoje} icon={<Activity className="h-4 w-4" />} />
            <Indicador titulo="Ativos em 7 dias" valor={operacao.atividade.ativos_7d} icon={<Users className="h-4 w-4" />} />
            <Indicador titulo="Ativos em 30 dias" valor={operacao.atividade.ativos_30d} icon={<Users className="h-4 w-4" />} />
            <Indicador titulo="Monitorados" valor={operacao.atividade.usuarios_monitorados} icon={<UserCheck className="h-4 w-4" />} />
            <Indicador titulo="Ainda sem telemetria" valor={operacao.atividade.usuarios_sem_telemetria} icon={<Clock3 className="h-4 w-4" />} />
            <Indicador titulo="Último acesso" valor={formatarDataHora(operacao.atividade.ultimo_acesso)} icon={<Clock3 className="h-4 w-4" />} />
          </div>

          <section className={uiSpacing.sectionCard}>
            <h2 className={uiTypography.secondaryTitle}>Plataformas em uso</h2>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Globe2 className="h-3.5 w-3.5" />Web</div>
                <p className="mt-1 text-lg font-bold">{formatarNumero(operacao.plataformas.web)}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Smartphone className="h-3.5 w-3.5" />Android</div>
                <p className="mt-1 text-lg font-bold">{formatarNumero(operacao.plataformas.android)}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Smartphone className="h-3.5 w-3.5" />iOS</div>
                <p className="mt-1 text-lg font-bold">{formatarNumero(operacao.plataformas.ios)}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              O monitoramento de acesso, plataforma e versão começa a partir desta implementação. Usuários antigos entram na contagem quando acessarem novamente.
            </p>
          </section>
        </div>
      )}

      {!erro && !carregando && aba === "versoes" && (
        <div className={uiSpacing.sectionStack}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Indicador
              titulo="Versão atual"
              valor={versao?.versionName ?? "—"}
              detalhe={versao ? `versionCode ${versao.versionCode}` : "Versão não disponível"}
              icon={<ListTodo className="h-4 w-4" />}
            />
            <Indicador titulo="Web monitorados" valor={operacao.plataformas.web} icon={<Globe2 className="h-4 w-4" />} />
            <Indicador titulo="Android monitorados" valor={operacao.plataformas.android} icon={<Smartphone className="h-4 w-4" />} />
          </div>

          <section className={uiSpacing.sectionCard}>
            <h2 className={uiTypography.secondaryTitle}>Versões registradas</h2>
            <p className="mt-1 text-sm text-muted-foreground">Última versão/plataforma registrada para cada usuário monitorado.</p>
            <div className="mt-4 space-y-2">
              {operacao.versoes.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Ainda não há versões registradas.
                </div>
              ) : operacao.versoes.map((item, index) => {
                const atual = Boolean(versao?.versionName && item.version_name === versao.versionName);
                return (
                  <div key={`${item.plataforma}:${item.version_name ?? "sem-versao"}:${item.version_code ?? "sem-code"}:${index}`} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{nomePlataforma(item.plataforma)} · {item.version_name ?? "Sem versão"}</p>
                        {atual && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Atual</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.version_code !== null ? `versionCode ${item.version_code}` : "versionCode não informado"}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums">{formatarNumero(item.usuarios)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {!erro && !carregando && aba === "push" && (
        <div className={uiSpacing.sectionStack}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Indicador titulo="Dispositivos cadastrados" valor={resumo.push_dispositivos} icon={<Smartphone className="h-4 w-4" />} />
            <Indicador titulo="Dispositivos ativos" valor={resumo.push_ativos} icon={<BellRing className="h-4 w-4" />} />
            <Indicador titulo="Envios hoje" valor={resumo.push_envios_hoje} icon={<UserCheck className="h-4 w-4" />} />
            <Indicador titulo="Android ativos" valor={resumo.push_android_ativos} icon={<Smartphone className="h-4 w-4" />} />
            <Indicador titulo="iOS ativos" valor={resumo.push_ios_ativos} icon={<Smartphone className="h-4 w-4" />} />
          </div>

          <section className={uiSpacing.sectionCard}>
            <h2 className={uiTypography.secondaryTitle}>Notificações</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Tokens de push e conteúdo das notificações não são exibidos nesta área.
            </p>
          </section>
        </div>
      )}

      {!erro && !carregando && aba === "feedbacks" && <AdminFeedbacks />}

      {!erro && !carregando && ehMaster && aba === "limpeza" && <AdminLimpeza />}

      {!erro && !carregando && aba === "sistema" && <AdminSistema />}

      {!erro && !carregando && aba === "auditoria" && <AdminAuditoria />}

      {!erro && !carregando && aba === "administradores" && <AdminAdministradores />}

      {!erro && !carregando && aba === "saude" && (
        <div className={uiSpacing.sectionStack}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Indicador titulo="Banco" valor="Conectado" icon={<Database className="h-4 w-4" />} />
            <Indicador
              titulo="Cron de push"
              valor={operacao.saude.cron_push_configurado ? "Configurado" : "Não configurado"}
              icon={<BellRing className="h-4 w-4" />}
            />
            <Indicador titulo="Admins ativos" valor={resumo.admins_ativos} icon={<ShieldCheck className="h-4 w-4" />} />
            <Indicador titulo="Último envio push" valor={formatarDataHora(operacao.saude.ultimo_push_envio)} icon={<Clock3 className="h-4 w-4" />} />
            <Indicador titulo="Último acesso monitorado" valor={formatarDataHora(operacao.atividade.ultimo_acesso)} icon={<Activity className="h-4 w-4" />} />
          </div>

          <section className={uiSpacing.sectionCard}>
            <h2 className={uiTypography.secondaryTitle}>Segurança operacional</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              A Administração recebe somente indicadores preparados por funções protegidas no banco. Segredos do cron, tokens de push e conteúdo das famílias não são expostos.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/administracao")({
  beforeLoad: async () => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) throw redirect({ to: "/" });

    const { data: admin, error } = await supabase.rpc("is_admin");
    if (error || admin !== true) throw redirect({ to: "/inicio" });
  },
  head: () => ({
    meta: [
      { title: "Administração — Combinado Família" },
      { name: "description", content: "Área administrativa do Combinado Família." },
    ],
  }),
  component: AdministracaoPage,
});
