import { useEffect, useState, type FormEvent } from "react";
import { Check, Gift, Loader2, Pencil, Plus, Star, Trash2, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Filho } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollapsibleSection } from "@/components/CollapsibleSection";

type Recompensa = {
  id: number;
  nome: string;
  descricao: string | null;
  estrelas_necessarias: number;
  disponivel: boolean;
};

type Resgate = {
  id: number;
  recompensa_nome: string;
  estrelas_utilizadas: number;
  status: "PENDENTE" | "ENTREGUE" | "CANCELADO";
  created_at: string;
  entregue_em: string | null;
  cancelado_em: string | null;
};

type Resumo = {
  hoje: number;
  vigencia_atual: number;
  saldo: number;
  total_conquistado: number;
  recompensas: Recompensa[];
  resgates: Resgate[];
};

type Movimento = Tables<"t_estrela_movimento">;

const resumoVazio: Resumo = {
  hoje: 0,
  vigencia_atual: 0,
  saldo: 0,
  total_conquistado: 0,
  recompensas: [],
  resgates: [],
};

const dataHora = (valor: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(valor));

function movimentoLabel(movimento: Movimento) {
  if (movimento.tipo === "FEZ") return "Tarefa cumprida";
  if (movimento.tipo === "ESTORNO_FEZ") return "Fez corrigido";
  if (movimento.tipo === "RESGATE") return "Recompensa resgatada";
  if (movimento.tipo === "CANCELAMENTO_RESGATE") return "Resgate cancelado";
  return movimento.tipo;
}

function Estrela({ className = "" }: { className?: string }) {
  return (
    <Star
      aria-hidden="true"
      className={`h-3.5 w-3.5 fill-amber-400 text-amber-500 ${className}`}
    />
  );
}

function ResgateStatus({ status }: { status: Resgate["status"] }) {
  if (status === "PENDENTE") {
    return (
      <Badge className="h-5 whitespace-nowrap border-amber-200 bg-amber-100 px-1.5 py-0 text-[10px] font-semibold text-amber-700">
        Pendente
      </Badge>
    );
  }

  if (status === "ENTREGUE") {
    return (
      <Badge className="h-5 whitespace-nowrap border-green-200 bg-green-100 px-1.5 py-0 text-[10px] font-semibold text-green-700">
        Entregue
      </Badge>
    );
  }

  return (
    <Badge className="h-5 whitespace-nowrap border-gray-200 bg-gray-100 px-1.5 py-0 text-[10px] font-semibold text-gray-600">
      Cancelado
    </Badge>
  );
}

export function FilhoEstrelasPainel({ filho }: { filho: Filho }) {
  const [resumo, setResumo] = useState<Resumo>(resumoVazio);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [recompensasComResgate, setRecompensasComResgate] = useState<Set<number>>(new Set());
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Recompensa | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [estrelas, setEstrelas] = useState("");
  const [resgatesAbertos, setResgatesAbertos] = useState(true);
  const [extratoAberto, setExtratoAberto] = useState(false);
  const [confirmacao, setConfirmacao] = useState<
    | { tipo: "DESATIVAR"; recompensa: Recompensa }
    | { tipo: "EXCLUIR"; recompensa: Recompensa }
    | { tipo: "CANCELAR"; resgate: Resgate }
    | null
  >(null);

  async function carregar() {
    setCarregando(true);
    try {
      const [resumoResp, movimentosResp, resgatesResp] = await Promise.all([
        supabase.rpc("resumo_estrelas_filho", { p_id_filho: filho.id }),
        supabase
          .from("t_estrela_movimento")
          .select("*")
          .eq("id_filho", filho.id)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("t_recompensa_resgate")
          .select("id_recompensa")
          .eq("id_filho", filho.id),
      ]);

      if (resumoResp.error) throw resumoResp.error;
      if (movimentosResp.error) throw movimentosResp.error;
      if (resgatesResp.error) throw resgatesResp.error;

      setResumo((resumoResp.data as unknown as Resumo | null) ?? resumoVazio);
      setMovimentos(movimentosResp.data ?? []);
      setRecompensasComResgate(
        new Set((resgatesResp.data ?? []).map((resgate) => resgate.id_recompensa)),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar as estrelas.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    setResumo(resumoVazio);
    setMovimentos([]);
    setRecompensasComResgate(new Set());
    setEditando(null);
    setNome("");
    setDescricao("");
    setEstrelas("");
    setFormAberto(false);
    setResgatesAbertos(true);
    setExtratoAberto(false);
    setConfirmacao(null);
    void carregar();
  }, [filho.id]);

  function limparForm() {
    setEditando(null);
    setNome("");
    setDescricao("");
    setEstrelas("");
    setFormAberto(false);
  }

  function novaRecompensa() {
    setEditando(null);
    setNome("");
    setDescricao("");
    setEstrelas("");
    setFormAberto(true);
  }

  function editarRecompensa(recompensa: Recompensa) {
    setEditando(recompensa);
    setNome(recompensa.nome);
    setDescricao(recompensa.descricao ?? "");
    setEstrelas(String(recompensa.estrelas_necessarias));
    setFormAberto(true);
  }

  async function salvarRecompensa(evento: FormEvent) {
    evento.preventDefault();

    const quantidade = Number(estrelas);
    if (nome.trim().length < 2) {
      toast.error("Informe o nome da recompensa.");
      return;
    }
    if (!Number.isInteger(quantidade) || quantidade < 1) {
      toast.error("Informe uma quantidade válida de estrelas.");
      return;
    }

    setSalvando(true);
    try {
      const { error } = await supabase.rpc("salvar_recompensa_estrelas", {
        p_id_filho: filho.id,
        p_nome: nome.trim(),
        p_descricao: descricao.trim(),
        p_estrelas_necessarias: quantidade,
        ...(editando ? { p_id_recompensa: editando.id } : {}),
      });

      if (error) throw error;

      toast.success(editando ? "Recompensa atualizada" : "Recompensa cadastrada");
      limparForm();
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a recompensa.");
    } finally {
      setSalvando(false);
    }
  }

  async function resgatar(recompensa: Recompensa) {
    setSalvando(true);
    try {
      const { error } = await supabase.rpc("resgatar_recompensa_estrelas", {
        p_id_recompensa: recompensa.id,
      });
      if (error) throw error;

      toast.success("Recompensa resgatada. Aguardando entrega.");
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível resgatar a recompensa.");
    } finally {
      setSalvando(false);
    }
  }

  async function marcarEntregue(resgate: Resgate) {
    setSalvando(true);
    try {
      const { error } = await supabase.rpc("alterar_status_resgate_estrelas", {
        p_id_resgate: resgate.id,
        p_status: "ENTREGUE",
      });
      if (error) throw error;

      toast.success("Recompensa marcada como entregue");
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o resgate.");
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarAcao() {
    if (!confirmacao) return;

    setSalvando(true);
    try {
      if (confirmacao.tipo === "DESATIVAR") {
        const { error } = await supabase.rpc("desativar_recompensa_estrelas", {
          p_id_recompensa: confirmacao.recompensa.id,
        });
        if (error) throw error;
        toast.success("Recompensa desativada");
      } else if (confirmacao.tipo === "EXCLUIR") {
        const { error } = await supabase.rpc("excluir_recompensa_estrelas", {
          p_id_recompensa: confirmacao.recompensa.id,
        });
        if (error) throw error;
        toast.success("Recompensa excluída");
      } else {
        const { error } = await supabase.rpc("alterar_status_resgate_estrelas", {
          p_id_resgate: confirmacao.resgate.id,
          p_status: "CANCELADO",
        });
        if (error) throw error;
        toast.success("Resgate cancelado e estrelas devolvidas");
      }

      setConfirmacao(null);
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-2xl border bg-card">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        <section>
          <div className="mb-2.5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumo</p>
              <h2 className="mt-0.5 text-base font-semibold">{filho.nome}</h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs font-semibold">
              <Estrela />
              {resumo.saldo} disponíveis
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border bg-card px-3 py-3.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted/50"><Estrela /></span>
                <span className="text-[11px] font-medium">Hoje</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums">{resumo.hoje}</p>
            </div>
            <div className="rounded-xl border bg-card px-3 py-3.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted/50"><Estrela /></span>
                <span className="text-[11px] font-medium">Nesta vigência</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums">{resumo.vigencia_atual}</p>
            </div>
            <div className="rounded-xl border bg-card px-3 py-3.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted/50"><Gift className="h-3.5 w-3.5" /></span>
                <span className="text-[11px] font-medium">Saldo disponível</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums">{resumo.saldo}</p>
            </div>
            <div className="rounded-xl border bg-card px-3 py-3.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted/50"><Trophy className="h-3.5 w-3.5" /></span>
                <span className="text-[11px] font-medium">Total conquistado</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums">{resumo.total_conquistado}</p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-start justify-between gap-3 border-b px-4 py-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">Recompensas</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Cadastre o prêmio e defina quantas estrelas são necessárias.</p>
            </div>
            <Button type="button" size="sm" className="shrink-0" onClick={novaRecompensa}><Plus className="h-3.5 w-3.5" /> Nova</Button>
          </div>

          <div className="divide-y">
            {resumo.recompensas.map((recompensa) => {
              const faltam = Math.max(0, recompensa.estrelas_necessarias - resumo.saldo);
              const progresso = Math.min(100, Math.max(0, (resumo.saldo / recompensa.estrelas_necessarias) * 100));
              return (
                <div key={recompensa.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold">{recompensa.nome}</p>
                      {recompensa.descricao && <p className="mt-0.5 break-words text-xs text-muted-foreground">{recompensa.descricao}</p>}
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border bg-muted/20 px-2 py-1 text-xs font-semibold"><Estrela />{recompensa.estrelas_necessarias}</span>
                  </div>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progresso}%` }} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-3 text-xs">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">{resumo.saldo} de {recompensa.estrelas_necessarias}<Estrela className="h-3 w-3" /></span>
                    <span className={recompensa.disponivel ? "font-semibold text-green-700" : "text-muted-foreground"}>
                      {recompensa.disponivel ? "Disponível para resgate" : <span className="inline-flex items-center gap-1">Faltam {faltam}<Estrela className="h-3 w-3" /></span>}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => editarRecompensa(recompensa)} disabled={salvando}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                    {!recompensasComResgate.has(recompensa.id) && (
                      <Button type="button" variant="outline" size="sm" onClick={() => setConfirmacao({ tipo: "EXCLUIR", recompensa })} disabled={salvando}><Trash2 className="h-3.5 w-3.5" /> Excluir</Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => setConfirmacao({ tipo: "DESATIVAR", recompensa })} disabled={salvando}><X className="h-3.5 w-3.5" /> Desativar</Button>
                    <Button type="button" size="sm" onClick={() => void resgatar(recompensa)} disabled={salvando || !recompensa.disponivel}><Gift className="h-3.5 w-3.5" /> Resgatar</Button>
                  </div>
                </div>
              );
            })}
            {resumo.recompensas.length === 0 && <p className="px-4 py-5 text-sm text-muted-foreground">Nenhuma recompensa cadastrada.</p>}
          </div>
        </section>

        <CollapsibleSection
          title="Resgates"
          description="Acompanhe entregas, cancelamentos e recompensas usadas."
          count={resumo.resgates.length}
          open={resgatesAbertos}
          onOpenChange={setResgatesAbertos}
        >
          <div className="divide-y">
            {resumo.resgates.map((resgate) => (
              <div key={resgate.id} className="px-4 py-4 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words text-sm font-semibold">{resgate.recompensa_nome}</p>
                      <ResgateStatus status={resgate.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{dataHora(resgate.created_at)}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border bg-muted/20 px-2 py-1 text-xs font-semibold">
                    <Estrela />
                    {resgate.estrelas_utilizadas}
                  </span>
                </div>

                {resgate.status !== "CANCELADO" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {resgate.status === "PENDENTE" && (
                      <Button type="button" size="sm" onClick={() => void marcarEntregue(resgate)} disabled={salvando}>
                        <Check className="h-3.5 w-3.5" />
                        Marcar entregue
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => setConfirmacao({ tipo: "CANCELAR", resgate })} disabled={salvando}>
                      <X className="h-3.5 w-3.5" />
                      Cancelar resgate
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {resumo.resgates.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground sm:px-5">Nenhum resgate realizado.</p>
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          title="Movimentações de estrelas"
          description="Entradas, estornos, resgates e devoluções."
          count={movimentos.length}
          open={extratoAberto}
          onOpenChange={setExtratoAberto}
        >
          <div className="divide-y">
            {movimentos.map((movimento) => (
              <div key={movimento.id} className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{movimentoLabel(movimento)}</p>
                  <p className="mt-0.5 break-words text-xs text-muted-foreground">
                    {movimento.descricao || "—"} · {dataHora(movimento.created_at)}
                  </p>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1 text-sm font-bold ${movimento.quantidade > 0 ? "text-green-700" : "text-foreground"}`}>
                  {movimento.quantidade > 0 ? "+" : ""}{movimento.quantidade}
                  <Estrela />
                </span>
              </div>
            ))}
            {movimentos.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground sm:px-5">Ainda não há movimentos de estrelas.</p>
            )}
          </div>
        </CollapsibleSection>
      </div>

      <Dialog
        open={formAberto}
        onOpenChange={(open) => {
          if (!open) limparForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar recompensa" : "Nova recompensa"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={(evento) => void salvarRecompensa(evento)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="recompensa-nome">Recompensa *</Label>
              <Input id="recompensa-nome" value={nome} onChange={(evento) => setNome(evento.target.value)} maxLength={100} placeholder="Ex.: Ir ao cinema" autoFocus />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="recompensa-descricao">Descrição <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Input id="recompensa-descricao" value={descricao} onChange={(evento) => setDescricao(evento.target.value)} maxLength={300} placeholder="Ex.: Sessão de cinema no fim de semana" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="recompensa-estrelas">Estrelas necessárias *</Label>
              <div className="relative max-w-40">
                <Input id="recompensa-estrelas" type="number" min="1" max="100000" step="1" inputMode="numeric" value={estrelas} onChange={(evento) => setEstrelas(evento.target.value)} className="pr-9" />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center"><Estrela /></span>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={limparForm}>Cancelar</Button>
              <Button type="submit" disabled={salvando}>
                {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                {editando ? "Salvar alterações" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmacao !== null} onOpenChange={(value) => !value && setConfirmacao(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmacao?.tipo === "DESATIVAR"
                ? "Desativar recompensa?"
                : confirmacao?.tipo === "EXCLUIR"
                  ? "Excluir recompensa?"
                  : "Cancelar resgate?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmacao?.tipo === "DESATIVAR"
              ? "A recompensa deixa de aparecer para novos resgates. O histórico já existente permanece."
              : confirmacao?.tipo === "EXCLUIR"
                ? "Esta recompensa nunca foi resgatada e será excluída definitivamente."
                : "As estrelas usadas neste resgate serão devolvidas ao saldo e o histórico permanecerá registrado."}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmacao(null)}>Voltar</Button>
            <Button
              type="button"
              variant={confirmacao?.tipo === "EXCLUIR" ? "destructive" : "default"}
              onClick={() => void confirmarAcao()}
              disabled={salvando}
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmacao?.tipo === "EXCLUIR" ? "Excluir" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
