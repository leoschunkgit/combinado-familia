import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, PowerOff, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FilhoAvatar } from "@/components/FilhoAvatar";
import { useActionLoading } from "@/components/ActionLoading";
import { msgErro, type Filho } from "@/lib/db";
import { copyText } from "@/lib/platform-actions";

type AcessoApp = {
  id: number;
  dispositivo_id: string;
  dispositivo_nome: string | null;
  ativo: boolean;
  ultimo_acesso_em: string | null;
  revogado_em: string | null;
  created_at: string;
};

type ChaveApp = {
  chave: string;
  expira_em: string;
};

const dataHora = (valor: string) => new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date(valor));

function normalizarAcessos(data: unknown): AcessoApp[] {
  if (!Array.isArray(data)) return [];

  return data.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const r = row as Record<string, unknown>;
    if (typeof r["id"] !== "number" || typeof r["dispositivo_id"] !== "string") return [];

    return [{
      id: r["id"],
      dispositivo_id: r["dispositivo_id"],
      dispositivo_nome: typeof r["dispositivo_nome"] === "string" ? r["dispositivo_nome"] : null,
      ativo: r["ativo"] === true,
      ultimo_acesso_em: typeof r["ultimo_acesso_em"] === "string" ? r["ultimo_acesso_em"] : null,
      revogado_em: typeof r["revogado_em"] === "string" ? r["revogado_em"] : null,
      created_at: typeof r["created_at"] === "string" ? r["created_at"] : "",
    }];
  });
}

function normalizarChave(data: unknown): ChaveApp | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;

  if (typeof r["chave"] !== "string" || !/^\d{6}$/.test(r["chave"]) || typeof r["expira_em"] !== "string") {
    return null;
  }

  return { chave: r["chave"], expira_em: r["expira_em"] };
}

export function FilhoAppAccessManager({ filho }: { filho: Filho }) {
  const { runAction } = useActionLoading();
  const [acessos, setAcessos] = useState<AcessoApp[]>([]);
  const [chave, setChave] = useState<ChaveApp | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [confirmarRevogar, setConfirmarRevogar] = useState<AcessoApp | null>(null);
  const [confirmarRevogarTodos, setConfirmarRevogarTodos] = useState(false);

  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await rpc("listar_acessos_app_filho", { p_id_filho: filho.id });
    setCarregando(false);

    if (error) {
      toast.error(msgErro(error));
      return;
    }

    setAcessos(normalizarAcessos(data));
  }, [filho.id]);

  useEffect(() => {
    setChave(null);
    setConfirmarRevogar(null);
    setConfirmarRevogarTodos(false);
    void carregar();
  }, [carregar]);

  async function gerarChave() {
    const { data, error } = await rpc("gerar_chave_acesso_app_filho", { p_id_filho: filho.id });

    if (error) {
      toast.error(msgErro(error));
      return;
    }

    const novaChave = normalizarChave(data);
    if (!novaChave) {
      toast.error("Não foi possível gerar a chave de acesso.");
      return;
    }

    setChave(novaChave);
    toast.success("Chave gerada. Ela vale por 15 minutos e pode ser usada uma única vez.");
  }

  async function copiarChave() {
    if (!chave) return;
    try {
      await copyText(chave.chave);
      toast.success("Chave copiada");
    } catch {
      toast.error("Não foi possível copiar a chave");
    }
  }

  async function revogarAcesso(acesso: AcessoApp) {
    const { error } = await rpc("revogar_acesso_app_filho", { p_id_acesso: acesso.id });
    if (error) {
      toast.error(msgErro(error));
      return;
    }

    setConfirmarRevogar(null);
    await carregar();
    toast.success("Acesso do aparelho revogado");
  }

  async function revogarTodos() {
    const { error } = await rpc("revogar_todos_acessos_app_filho", { p_id_filho: filho.id });
    if (error) {
      toast.error(msgErro(error));
      return;
    }

    setConfirmarRevogarTodos(false);
    setChave(null);
    await carregar();
    toast.success("Todos os acessos do aplicativo foram revogados");
  }

  const ativos = acessos.filter((acesso) => acesso.ativo);

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Situação do acesso</p>
            <p className="mt-0.5 text-sm font-semibold">
              {carregando
                ? "Verificando aparelhos..."
                : ativos.length === 0
                  ? "Nenhum aparelho conectado"
                  : `${ativos.length} ${ativos.length === 1 ? "aparelho conectado" : "aparelhos conectados"}`}
            </p>
          </div>
          {!carregando && (
            <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
              ativos.length > 0
                ? "border-green-200 bg-green-50 text-green-700"
                : "bg-background text-muted-foreground"
            }`}>
              {ativos.length > 0 ? "Com acesso" : "Sem acesso"}
            </span>
          )}
        </div>

        <section className="rounded-xl border bg-muted/20 p-3 sm:p-4">
          <div className="flex items-start gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background text-primary">
              <KeyRound className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Chave de acesso</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Gere uma chave de 6 dígitos para {filho.nome} parear um aparelho. A chave vale por 15 minutos e é de uso único.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Depois do pareamento, o acesso permanece ativo nesse aparelho até ser revogado ou o filho escolher sair.
              </p>
            </div>
          </div>

          {chave && (
            <div className="mt-3 rounded-lg border bg-background p-3">
              <p className="text-xs font-medium text-muted-foreground">Chave temporária</p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-2xl font-bold tracking-[0.18em]">{chave.chave}</span>
                <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => void copiarChave()}>
                  <Copy className="h-3.5 w-3.5" />
                  Copiar
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Válida até {dataHora(chave.expira_em)} · uso único.</p>
            </div>
          )}

          <Button type="button" size="sm" className="mt-3" onClick={() => void runAction(gerarChave)}>
            <KeyRound className="h-3.5 w-3.5" />
            {chave ? "Gerar nova chave" : "Gerar chave de acesso"}
          </Button>
        </section>

        <section className="rounded-xl border bg-muted/20 p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background text-primary">
                <Smartphone className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">Aparelhos conectados</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Veja os aparelhos que ainda podem acessar o app e revogue somente quando quiser encerrar aquele acesso.
                </p>
              </div>
            </div>
            {ativos.length > 1 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 shrink-0 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => setConfirmarRevogarTodos(true)}
              >
                Revogar todos
              </Button>
            )}
          </div>

          <div className="mt-3 space-y-2">
            {carregando ? (
              <p className="text-sm text-muted-foreground">Carregando aparelhos...</p>
            ) : ativos.length === 0 ? (
              <p className="rounded-lg border border-dashed bg-background p-4 text-center text-sm text-muted-foreground">
                Nenhum aparelho conectado.
              </p>
            ) : (
              ativos.map((acesso) => (
                <div key={acesso.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <Smartphone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{acesso.dispositivo_nome || "Aparelho"}</span>
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {acesso.ultimo_acesso_em
                        ? `Último acesso: ${dataHora(acesso.ultimo_acesso_em)}`
                        : "Ainda sem acesso registrado"}
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => setConfirmarRevogar(acesso)}
                  >
                    <PowerOff className="h-3.5 w-3.5" />
                    Revogar
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <Dialog open={confirmarRevogar !== null} onOpenChange={(aberto) => !aberto && setConfirmarRevogar(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Revogar acesso do aparelho</DialogTitle></DialogHeader>
          {confirmarRevogar && (
            <>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FilhoAvatar
                  nome={filho.nome}
                  cor={filho.cor}
                  avatar={filho.avatar === "menino" || filho.avatar === "menina" ? filho.avatar : null}
                  className="h-5 w-5"
                />
                <span>{filho.nome}</span>
              </div>
              <p>O aparelho <strong>{confirmarRevogar.dispositivo_nome || "Aparelho"}</strong> perderá o acesso ao app.</p>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarRevogar(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => {
                const acesso = confirmarRevogar;
                if (acesso) void runAction(() => revogarAcesso(acesso));
              }}
            >
              Revogar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmarRevogarTodos} onOpenChange={setConfirmarRevogarTodos}>
        <DialogContent>
          <DialogHeader><DialogTitle>Revogar todos os acessos do app</DialogTitle></DialogHeader>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FilhoAvatar
              nome={filho.nome}
              cor={filho.cor}
              avatar={filho.avatar === "menino" || filho.avatar === "menina" ? filho.avatar : null}
              className="h-5 w-5"
            />
            <span>{filho.nome}</span>
          </div>
          <p>Todos os aparelhos conectados serão desconectados e qualquer chave temporária ainda ativa será invalidada.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarRevogarTodos(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => void runAction(revogarTodos)}>Revogar todos</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function FilhoAppAccessDialog({
  filho,
  open,
  onOpenChange,
}: {
  filho: Filho | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Acesso ao app</DialogTitle>
        </DialogHeader>

        {filho && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <FilhoAvatar
                nome={filho.nome}
                cor={filho.cor}
                avatar={filho.avatar === "menino" || filho.avatar === "menina" ? filho.avatar : null}
                className="h-8 w-8"
              />
              <div>
                <p className="font-semibold">{filho.nome}</p>
                <p className="text-xs text-muted-foreground">Acesso do filho ao aplicativo.</p>
              </div>
            </div>
            <FilhoAppAccessManager filho={filho} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
