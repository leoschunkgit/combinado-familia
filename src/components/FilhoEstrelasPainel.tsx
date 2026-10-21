import { useEffect, useState, type FormEvent } from "react";
import { Check, EllipsisVertical, Gift, Loader2, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Filho } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollapsibleSection } from "@/components/CollapsibleSection";

type Recompensa = {
  id: number;
  nome: string;
  descricao: string | null;
  estrelas_necessarias: number;
  progresso: number;
  faltam: number;
  disponivel: boolean;
  pendente: boolean;
  marco_estrelas: number;
};

type Resgate = {
  id: number;
  id_recompensa: number;
  recompensa_nome: string;
  estrelas_utilizadas: number;
  meta_estrelas_no_resgate: number;
  total_estrelas_no_resgate: number | null;
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
  const [recompensasComResgate, setRecompensasComResgate] = useState<Set<number>>(new Set());
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Recompensa | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [estrelas, setEstrelas] = useState("");
  const [recompensasAbertas, setRecompensasAbertas] = useState(false);
  const [entregasAbertas, setEntregasAbertas] = useState(false);
  const [confirmacao, setConfirmacao] = useState<
    | { tipo: "DESATIVAR"; recompensa: Recompensa }
    | { tipo: "EXCLUIR"; recompensa: Recompensa }
    | { tipo: "CANCELAR"; resgate: Resgate }
    | null
  >(null);

  async function carregar() {
    setCarregando(true);
    try {
      const [resumoResp, resgatesResp] = await Promise.all([
        supabase.rpc("resumo_estrelas_filho", { p_id_filho: filho.id }),
        supabase
          .from("t_recompensa_resgate")
          .select("id_recompensa")
          .eq("id_filho", filho.id),
      ]);

      if (resumoResp.error) throw resumoResp.error;
      if (resgatesResp.error) throw resgatesResp.error;

      const proximoResumo = (resumoResp.data as unknown as Resumo | null) ?? resumoVazio;
      setResumo(proximoResumo);
      setEntregasAbertas(proximoResumo.resgates.some((resgate) => resgate.status === "PENDENTE"));
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
    setRecompensasComResgate(new Set());
    setEditando(null);
    setNome("");
    setDescricao("");
    setEstrelas("");
    setFormAberto(false);
    setRecompensasAbertas(false);
    setEntregasAbertas(false);
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
        toast.success("Resgate cancelado");
      }

      setConfirmacao(null);
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
    } finally {
      setSalvando(false);
    }
  }

  const resgatesPendentes = resumo.resgates.filter((resgate) => resgate.status === "PENDENTE");
  const recompensaEditandoTemPendente = editando
    ? resgatesPendentes.some((resgate) => resgate.id_recompensa === editando.id)
    : false;

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
        <section className="grid grid-cols-2 gap-2">
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
        </section>

        <CollapsibleSection
          title="Recompensas"
          description="Cadastre o prêmio e defina quantas estrelas são necessárias."
          count={resumo.recompensas.length}
          open={recompensasAbertas}
          onOpenChange={setRecompensasAbertas}
          contentClassName="bg-muted/10 p-2.5 sm:p-3"
          action={
            <Button type="button" size="sm" className="h-8 shrink-0 px-2.5 text-xs" onClick={novaRecompensa}>
              <Plus className="h-3.5 w-3.5" /> Nova
            </Button>
          }
        >
          <div className="space-y-2.5">
            {resumo.recompensas.map((recompensa) => {
              const progresso = Math.min(
                100,
                Math.max(0, (recompensa.progresso / recompensa.estrelas_necessarias) * 100),
              );
              return (
                <article key={recompensa.id} className="rounded-xl border bg-background p-3 shadow-sm sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold">{recompensa.nome}</p>
                      {recompensa.descricao && <p className="mt-0.5 break-words text-xs text-muted-foreground">{recompensa.descricao}</p>}
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border bg-muted/20 px-2 py-1 text-xs font-semibold"><Estrela />{recompensa.estrelas_necessarias}</span>
                  </div>

                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progresso}%` }} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-3 text-xs">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">{recompensa.progresso} de {recompensa.estrelas_necessarias}<Estrela className="h-3 w-3" /></span>
                    <span className={recompensa.disponivel ? "font-semibold text-green-700" : "text-muted-foreground"}>
                      {recompensa.pendente
                        ? "Aguardando entrega"
                        : recompensa.disponivel
                          ? "Disponível para resgate"
                          : <span className="inline-flex items-center gap-1">Faltam {recompensa.faltam}<Estrela className="h-3 w-3" /></span>}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                    <Button type="button" size="sm" className="h-8 px-2.5 text-xs" onClick={() => void resgatar(recompensa)} disabled={salvando || !recompensa.disponivel}>
                      <Gift className="h-3.5 w-3.5" /> Resgatar
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={salvando} aria-label={`Mais ações para ${recompensa.nome}`}>
                          <EllipsisVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onSelect={() => editarRecompensa(recompensa)}><Pencil className="h-4 w-4" />Editar</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setConfirmacao({ tipo: "DESATIVAR", recompensa })}><X className="h-4 w-4" />Desativar</DropdownMenuItem>
                        {!recompensasComResgate.has(recompensa.id) && (
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirmacao({ tipo: "EXCLUIR", recompensa })}>
                            <Trash2 className="h-4 w-4" />Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </article>
              );
            })}
            {resumo.recompensas.length === 0 && <p className="rounded-xl border border-dashed bg-background px-4 py-5 text-center text-sm text-muted-foreground">Nenhuma recompensa cadastrada.</p>}
          </div>
        </CollapsibleSection>

        {resgatesPendentes.length > 0 && (
          <CollapsibleSection
            title="Aguardando entrega"
            description="Recompensas resgatadas que ainda precisam ser entregues."
            count={resgatesPendentes.length}
            open={entregasAbertas}
            onOpenChange={setEntregasAbertas}
          >
            <div className="divide-y">
              {resgatesPendentes.map((resgate) => (
                <div key={resgate.id} className="px-4 py-3.5 sm:px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words text-sm font-semibold">{resgate.recompensa_nome}</p>
                        <ResgateStatus status={resgate.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{dataHora(resgate.created_at)}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border bg-muted/20 px-2 py-1 text-xs font-semibold"><Estrela />{resgate.meta_estrelas_no_resgate}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" className="h-8 px-2.5 text-xs" onClick={() => void marcarEntregue(resgate)} disabled={salvando}>
                      <Check className="h-3.5 w-3.5" />Marcar entregue
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setConfirmacao({ tipo: "CANCELAR", resgate })} disabled={salvando}>
                      <X className="h-3.5 w-3.5" />Cancelar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

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

            {recompensaEditandoTemPendente && (
              <p className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Há um resgate aguardando entrega. A nova meta valerá para os próximos resgates; o pedido atual mantém a meta que tinha quando foi feito.
              </p>
            )}

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
                : "O resgate será cancelado. Nenhuma estrela é retirada ou devolvida; o progresso desta recompensa permanece como estava."}
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
