import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Flag, Info, Plus, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { uiTypography } from "@/lib/ui-typography";
import { uiSpacing } from "@/lib/ui-spacing";
import { normalizarAppConfig, type AppConfigPublico } from "@/lib/app-system-config";

type FeatureFlag = {
  chave: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string | null;
  updated_at: string | null;
};

type SistemaData = {
  config: AppConfigPublico;
  funcionalidades: FeatureFlag[];
};

type FormConfig = {
  mensagemGlobalAtiva: boolean;
  mensagemGlobal: string;
  manutencaoAtiva: boolean;
  manutencaoMensagem: string;
  androidMinVersionName: string;
  androidMinVersionCode: string;
  iosMinVersionName: string;
  iosMinVersionCode: string;
};

const FORM_VAZIO: FormConfig = {
  mensagemGlobalAtiva: false,
  mensagemGlobal: "",
  manutencaoAtiva: false,
  manutencaoMensagem: "",
  androidMinVersionName: "",
  androidMinVersionCode: "",
  iosMinVersionName: "",
  iosMinVersionCode: "",
};

function inteiroOuNull(valor: string) {
  if (!valor.trim()) return null;
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizarSistema(data: unknown): SistemaData {
  const raiz = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const config = normalizarAppConfig(raiz["config"]);
  const funcionalidadesBrutas = Array.isArray(raiz["funcionalidades"]) ? raiz["funcionalidades"] : [];

  return {
    config,
    funcionalidades: funcionalidadesBrutas
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({
        chave: typeof item["chave"] === "string" ? item["chave"] : "",
        nome: typeof item["nome"] === "string" ? item["nome"] : "",
        descricao: typeof item["descricao"] === "string" ? item["descricao"] : null,
        ativo: item["ativo"] === true,
        created_at: typeof item["created_at"] === "string" ? item["created_at"] : null,
        updated_at: typeof item["updated_at"] === "string" ? item["updated_at"] : null,
      })),
  };
}

export function AdminSistema() {
  const [dados, setDados] = useState<SistemaData | null>(null);
  const [form, setForm] = useState<FormConfig>(FORM_VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [novaChave, setNovaChave] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");

  const aplicarDados = useCallback((novo: SistemaData) => {
    setDados(novo);
    setForm({
      mensagemGlobalAtiva: novo.config.mensagem_global_ativa,
      mensagemGlobal: novo.config.mensagem_global ?? "",
      manutencaoAtiva: novo.config.manutencao_ativa,
      manutencaoMensagem: novo.config.manutencao_mensagem ?? "",
      androidMinVersionName: novo.config.android_min_version_name ?? "",
      androidMinVersionCode: novo.config.android_min_version_code?.toString() ?? "",
      iosMinVersionName: novo.config.ios_min_version_name ?? "",
      iosMinVersionCode: novo.config.ios_min_version_code?.toString() ?? "",
    });
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase.rpc("admin_sistema_obter");
    setCarregando(false);

    if (error) {
      toast.error("Não foi possível carregar as configurações do sistema.");
      return;
    }

    aplicarDados(normalizarSistema(data));
  }, [aplicarDados]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvarConfig() {
    const androidCode = inteiroOuNull(form.androidMinVersionCode);
    const iosCode = inteiroOuNull(form.iosMinVersionCode);

    if (form.androidMinVersionCode.trim() && androidCode === null) {
      toast.error("Informe um versionCode mínimo Android válido.");
      return;
    }
    if (form.iosMinVersionCode.trim() && iosCode === null) {
      toast.error("Informe um build mínimo iOS válido.");
      return;
    }

    setSalvando(true);
    const { error } = await supabase.rpc("admin_config_salvar", {
      p_mensagem_global_ativa: form.mensagemGlobalAtiva,
      p_mensagem_global: form.mensagemGlobal.trim() || null,
      p_manutencao_ativa: form.manutencaoAtiva,
      p_manutencao_mensagem: form.manutencaoMensagem.trim() || null,
      p_android_min_version_name: form.androidMinVersionName.trim() || null,
      p_android_min_version_code: androidCode,
      p_ios_min_version_name: form.iosMinVersionName.trim() || null,
      p_ios_min_version_code: iosCode,
    });
    setSalvando(false);

    if (error) {
      toast.error(error.message || "Não foi possível salvar as configurações.");
      return;
    }

    toast.success("Configurações do sistema atualizadas");
    window.dispatchEvent(new Event("app-config-updated"));
    await carregar();
  }

  async function salvarFeature(feature: FeatureFlag, ativo: boolean) {
    const { error } = await supabase.rpc("admin_feature_salvar", {
      p_chave: feature.chave,
      p_nome: feature.nome,
      p_descricao: feature.descricao,
      p_ativo: ativo,
    });

    if (error) {
      toast.error(error.message || "Não foi possível alterar a funcionalidade.");
      return;
    }

    toast.success(`${feature.nome} ${ativo ? "ativada" : "desativada"}`);
    window.dispatchEvent(new Event("app-config-updated"));
    await carregar();
  }

  async function adicionarFeature() {
    if (!novaChave.trim() || !novoNome.trim()) {
      toast.error("Informe a chave e o nome da funcionalidade.");
      return;
    }

    const { error } = await supabase.rpc("admin_feature_salvar", {
      p_chave: novaChave.trim().toLowerCase(),
      p_nome: novoNome.trim(),
      p_descricao: novaDescricao.trim() || null,
      p_ativo: false,
    });

    if (error) {
      toast.error(error.message || "Não foi possível criar a funcionalidade.");
      return;
    }

    setNovaChave("");
    setNovoNome("");
    setNovaDescricao("");
    toast.success("Funcionalidade criada");
    window.dispatchEvent(new Event("app-config-updated"));
    await carregar();
  }

  if (carregando && !dados) {
    return <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Carregando configurações...</div>;
  }

  return (
    <div className={uiSpacing.sectionStack}>
      <div>
        <h2 className={uiTypography.secondaryTitle}>Administração do sistema</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie comportamentos gerais do Combinado Família. Aqui você pode avisar todos os usuários, colocar o aplicativo temporariamente em manutenção, definir a versão mínima permitida e controlar funcionalidades preparadas para ativação ou desativação.
        </p>
      </div>

      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Settings2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className={uiTypography.secondaryTitle}>Comunicação e manutenção</h3>

            <div className="mt-4 space-y-5">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="mensagem-global">Mensagem global</Label>
                    <div className="mt-2 flex items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Exibe um aviso para todos os usuários logados. Use para comunicar novidades, atualizações, avisos importantes ou indisponibilidades programadas. Ao desativar, a mensagem deixa de aparecer, mas o texto pode permanecer salvo.
                      </p>
                    </div>
                  </div>
                  <Switch checked={form.mensagemGlobalAtiva} onCheckedChange={(checked) => setForm((atual) => ({ ...atual, mensagemGlobalAtiva: checked }))} aria-label="Ativar mensagem global" />
                </div>
                <Textarea id="mensagem-global" className="mt-2" maxLength={500} value={form.mensagemGlobal} onChange={(event) => setForm((atual) => ({ ...atual, mensagemGlobal: event.target.value }))} placeholder="Ex.: Nova versão disponível para Android." />
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="mensagem-manutencao">Modo manutenção</Label>
                    <div className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/20 bg-muted/20 px-3 py-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Quando ativado, usuários comuns ficam temporariamente impedidos de utilizar o sistema e veem a mensagem informada abaixo. Administradores continuam com acesso para acompanhar o sistema e desativar a manutenção quando necessário.
                      </p>
                    </div>
                  </div>
                  <Switch checked={form.manutencaoAtiva} onCheckedChange={(checked) => setForm((atual) => ({ ...atual, manutencaoAtiva: checked }))} aria-label="Ativar modo manutenção" />
                </div>
                <Textarea id="mensagem-manutencao" className="mt-2" maxLength={500} value={form.manutencaoMensagem} onChange={(event) => setForm((atual) => ({ ...atual, manutencaoMensagem: event.target.value }))} placeholder="Ex.: Estamos realizando uma manutenção rápida." />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <h3 className={uiTypography.secondaryTitle}>Versão mínima permitida</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Define a versão mínima do aplicativo que poderá continuar sendo utilizada. Usuários com Android ou iOS abaixo do código informado precisarão atualizar antes de continuar. Essa regra não bloqueia o acesso pela Web.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            O campo <strong>Versão</strong> é o nome exibido ao usuário, como 1.2.4. O <strong>versionCode</strong> no Android e o <strong>Build</strong> no iOS são os números internos usados para comparar se o aplicativo instalado está abaixo do mínimo permitido.
          </p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-muted/20 p-3">
            <p className="text-sm font-semibold">Android</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="android-version-name">Versão</Label>
                <Input id="android-version-name" value={form.androidMinVersionName} onChange={(event) => setForm((atual) => ({ ...atual, androidMinVersionName: event.target.value }))} placeholder="1.2.4" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="android-version-code">versionCode</Label>
                <Input id="android-version-code" inputMode="numeric" value={form.androidMinVersionCode} onChange={(event) => setForm((atual) => ({ ...atual, androidMinVersionCode: event.target.value.replace(/\D/g, "") }))} placeholder="27" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/20 p-3">
            <p className="text-sm font-semibold">iOS</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="ios-version-name">Versão</Label>
                <Input id="ios-version-name" value={form.iosMinVersionName} onChange={(event) => setForm((atual) => ({ ...atual, iosMinVersionName: event.target.value }))} placeholder="1.0.0" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ios-version-code">Build</Label>
                <Input id="ios-version-code" inputMode="numeric" value={form.iosMinVersionCode} onChange={(event) => setForm((atual) => ({ ...atual, iosMinVersionCode: event.target.value.replace(/\D/g, "") }))} placeholder="1" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={() => void salvarConfig()} disabled={salvando}>
            <Save className="h-4 w-4" /> {salvando ? "Salvando..." : "Salvar configurações"}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Flag className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className={uiTypography.secondaryTitle}>Controle de funcionalidades</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Permite preparar controles para recursos do sistema que poderão ser ativados ou desativados futuramente por esta tela. Cada funcionalidade precisa estar previamente vinculada à sua chave no código; criar uma chave aqui, sozinha, não cria nem altera uma função do aplicativo.
            </p>

            <div className="mt-4 space-y-2">
              {(dados?.funcionalidades ?? []).length === 0 ? (
                <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Nenhuma funcionalidade configurada.</div>
              ) : (
                dados!.funcionalidades.map((feature) => (
                  <div key={feature.chave} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{feature.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">{feature.chave}{feature.descricao ? ` · ${feature.descricao}` : ""}</p>
                    </div>
                    <Switch checked={feature.ativo} onCheckedChange={(checked) => void salvarFeature(feature, checked)} aria-label={`${feature.ativo ? "Desativar" : "Ativar"} ${feature.nome}`} />
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 border-t pt-4">
              <p className="text-sm font-semibold">Nova funcionalidade</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                A chave é o identificador técnico usado pelo código, por exemplo <span className="font-medium text-foreground">novo_relatorio</span>. O nome é apenas a identificação amigável exibida aqui na Administração.
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <Input value={novaChave} onChange={(event) => setNovaChave(event.target.value)} placeholder="chave.exemplo" />
                <Input value={novoNome} onChange={(event) => setNovoNome(event.target.value)} placeholder="Nome da funcionalidade" />
              </div>
              <Input className="mt-2" value={novaDescricao} onChange={(event) => setNovaDescricao(event.target.value)} placeholder="Descrição opcional" />
              <div className="mt-3 flex justify-end">
                <Button size="sm" variant="outline" onClick={() => void adicionarFeature()}>
                  <Plus className="h-4 w-4" /> Adicionar funcionalidade
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-muted/20 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Importante:</strong> alterações nesta área podem afetar todos os usuários do Combinado Família. As mudanças administrativas ficam registradas na Auditoria.
          </p>
        </div>
      </div>
    </div>
  );
}
