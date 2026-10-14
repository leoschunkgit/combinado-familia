import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { uiTypography } from "@/lib/ui-typography";
import { uiSpacing } from "@/lib/ui-spacing";

type Auditoria = {
  id: number;
  admin_id: number;
  admin_nome: string;
  admin_email: string;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  detalhes: unknown;
  created_at: string;
};

function dataHora(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(data);
}

function nomeAcao(acao: string) {
  const nomes: Record<string, string> = {
    ACESSO_ADMIN: "Acesso à Administração",
    CONFIG_SISTEMA_ALTERADA: "Configuração alterada",
    FEATURE_FLAG_CRIADA: "Funcionalidade criada",
    FEATURE_FLAG_ALTERADA: "Funcionalidade alterada",
    ADMIN_ADICIONADO: "Administrador adicionado",
    ADMIN_REATIVADO: "Administrador reativado",
    ADMIN_ATIVADO: "Administrador ativado",
    ADMIN_DESATIVADO: "Administrador desativado",
  };
  return nomes[acao] ?? acao.replaceAll("_", " ");
}

export function AdminAuditoria() {
  const [itens, setItens] = useState<Auditoria[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase.rpc("admin_auditoria_listar", { p_limite: 100 });
    setCarregando(false);

    if (error) {
      toast.error("Não foi possível carregar a auditoria.");
      return;
    }
    setItens((data ?? []) as Auditoria[]);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className={uiSpacing.sectionStack}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={uiTypography.secondaryTitle}>Auditoria administrativa</h2>
          <p className="mt-1 text-sm text-muted-foreground">Últimas ações administrativas. Os registros são somente leitura.</p>
        </div>
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 rounded-md" onClick={() => void carregar()} disabled={carregando} aria-label="Atualizar auditoria">
          <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {carregando && itens.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Carregando auditoria...</div>
      ) : itens.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhuma ação administrativa registrada ainda.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="divide-y">
            {itens.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 sm:p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ScrollText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold">{nomeAcao(item.acao)}</p>
                    <p className="shrink-0 text-xs text-muted-foreground">{dataHora(item.created_at)}</p>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{item.admin_nome} · {item.admin_email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.entidade}{item.entidade_id ? ` · ${item.entidade_id}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">São exibidos os 100 registros administrativos mais recentes.</p>
    </div>
  );
}
