import { useEffect, useState, type FormEvent } from "react";
import { Check, Gift, Loader2, Pencil, Star, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Filho } from "@/lib/db";
import { FilhoAvatar } from "@/components/FilhoAvatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  if (movimento.tipo === "ESTORNO_FEZ") return "Estrela estornada";
  if (movimento.tipo === "RESGATE") return "Recompensa resgatada";
  if (movimento.tipo === "CANCELAMENTO_RESGATE") return "Resgate cancelado";
  return movimento.tipo;
}

export function FilhoEstrelasDialog({
  filho,
  open,
  onOpenChange,
}: {
  filho: Filho | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [resumo, setResumo] = useState<Resumo>(resumoVazio);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<Recompensa | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [estrelas, setEstrelas] = useState("");
  const [confirmacao, setConfirmacao] = useState<
    | { tipo: "DESATIVAR"; recompensa: Recompensa }
    | { tipo: "CANCELAR"; resgate: Resgate }
    | null
  >(null);

  async function carregar() {
    if (!filho) return;

    setCarregando(true);
    try {
      const [resumoResp, movimentosResp] = await Promise.all([
        supabase.rpc("resumo_estrelas_filho", { p_id_filho: filho.id }),
        supabase
          .from("t_estrela_movimento")
          .select("*")
          .eq("id_filho", filho.id)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      if (resumoResp.error) throw resumoResp.error;
      if (movimentosResp.error) throw movimentosResp.error;

      setResumo((resumoResp.data as unknown as Resumo | null) ?? resumoVazio);
      setMovimentos(movimentosResp.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar as estrelas.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (!open || !filho) return;
    void carregar();
  }, [open, filho?.id]);

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
    if (!filho) return;

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

  return (
    <>
      <Dialog open={open} onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) limparForm();
      }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              Estrelas e recompensas
            </DialogTitle>
          </DialogHeader>

          {filho && (
            <div className="flex items-center gap-2.5 rounded-xl border bg-muted/20 p-3">
              <FilhoAvatar
                nome={filho.nome}
                cor={filho.cor}
                avatar={filho.avatar === "menino" || filho.avatar === "menina" ? filho.avatar : null}
                className="h-9 w-9"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{filho.nome}</p>
                <p className="text-xs text-muted-foreground">1 tarefa marcada como “Fez” = 1 estrela</p>
              </div>
            </div>
          )}

          {carregando ? (
            <div className="flex min-h-36 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border p-3 text-center"><Star className="mx-auto h-4 w-4 text-amber-500" /><p className="mt-1 text-xl font-bold">{resumo.hoje}</p><p className="text-[11px] text-muted-foreground">Hoje</p></div>
                <div className="rounded-xl border p-3 text-center"><Star className="mx-auto h-4 w-4 text-amber-500" /><p className="mt-1 text-xl font-bold">{resumo.vigencia_atual}</p><p className="text-[11px] text-muted-foreground">Nesta vigência</p></div>
                <div className="rounded-xl border p-3 text-center"><Gift className="mx-auto h-4 w-4 text-muted-foreground" /><p className="mt-1 text-xl font-bold">{resumo.saldo}</p><p className="text-[11px] text-muted-foreground">Saldo</p></div>
                <div className="rounded-xl border p-3 text-center"><Trophy className="mx-auto h-4 w-4 text-muted-foreground" /><p className="mt-1 text-xl font-bold">{resumo.total_conquistado}</p><p className="text-[11px] text-muted-foreground">Conquistadas</p></div>
              </div>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Recompensas</h3>
                    <p className="text-xs text-muted-foreground">Defina o que o filho pode conquistar e quantas estrelas precisa.</p>
                  </div>
                  <Button type="button" size="sm" onClick={novaRecompensa}>Adicionar</Button>
                </div>

                {formAberto && (
                  <form onSubmit={(e) => void salvarRecompensa(e)} className="space-y-3 rounded-xl border p-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="recompensa-nome">Recompensa *</Label>
                      <Input id="recompensa-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={100} placeholder="Ex.: Escolher o filme" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="recompensa-descricao">Descrição <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                      <Input id="recompensa-descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={300} placeholder="Ex.: Filme de sexta à noite" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="recompensa-estrelas">Estrelas necessárias *</Label>
                      <Input id="recompensa-estrelas" type="number" min="1" max="100000" step="1" inputMode="numeric" value={estrelas} onChange={(e) => setEstrelas(e.target.value)} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={limparForm}>Cancelar</Button>
                      <Button type="submit" size="sm" disabled={salvando}>{editando ? "Salvar" : "Cadastrar"}</Button>
                    </div>
                  </form>
                )}

                <div className="space-y-2">
                  {resumo.recompensas.map((recompensa) => {
                    const faltam = Math.max(0, recompensa.estrelas_necessarias - resumo.saldo);
                    return (
                      <div key={recompensa.id} className="rounded-xl border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold">{recompensa.nome}</p>
                            {recompensa.descricao && <p className="mt-1 break-words text-xs text-muted-foreground">{recompensa.descricao}</p>}
                            <p className={`mt-1 text-xs font-medium ${recompensa.disponivel ? "text-green-700" : "text-muted-foreground"}`}>
                              {recompensa.disponivel ? "Disponível para resgate" : `Faltam ${faltam} estrela(s)`}
                            </p>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold"><Star className="h-4 w-4 text-amber-500" />{recompensa.estrelas_necessarias}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => editarRecompensa(recompensa)} disabled={salvando}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => setConfirmacao({ tipo: "DESATIVAR", recompensa })} disabled={salvando}><X className="h-3.5 w-3.5" /> Desativar</Button>
                          <Button type="button" size="sm" onClick={() => void resgatar(recompensa)} disabled={salvando || !recompensa.disponivel}><Gift className="h-3.5 w-3.5" /> Resgatar</Button>
                        </div>
                      </div>
                    );
                  })}
                  {resumo.recompensas.length === 0 && <p className="rounded-xl border p-3 text-sm text-muted-foreground">Nenhuma recompensa cadastrada.</p>}
                </div>
              </section>

              <section className="space-y-2">
                <div>
                  <h3 className="text-sm font-semibold">Resgates</h3>
                  <p className="text-xs text-muted-foreground">O resgate fica salvo. Cancelar devolve as estrelas sem apagar o histórico.</p>
                </div>
                {resumo.resgates.map((resgate) => (
                  <div key={resgate.id} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold">{resgate.recompensa_nome}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{dataHora(resgate.created_at)}</p>
                        <p className="mt-1 text-xs font-medium">{resgate.status === "PENDENTE" ? "Pendente" : resgate.status === "ENTREGUE" ? "Entregue" : "Cancelado"}</p>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold"><Star className="h-4 w-4 text-amber-500" />{resgate.estrelas_utilizadas}</span>
                    </div>
                    {resgate.status !== "CANCELADO" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {resgate.status === "PENDENTE" && <Button type="button" size="sm" onClick={() => void marcarEntregue(resgate)} disabled={salvando}><Check className="h-3.5 w-3.5" /> Marcar entregue</Button>}
                        <Button type="button" variant="outline" size="sm" onClick={() => setConfirmacao({ tipo: "CANCELAR", resgate })} disabled={salvando}><X className="h-3.5 w-3.5" /> Cancelar resgate</Button>
                      </div>
                    )}
                  </div>
                ))}
                {resumo.resgates.length === 0 && <p className="rounded-xl border p-3 text-sm text-muted-foreground">Nenhum resgate realizado.</p>}
              </section>

              <section className="space-y-2">
                <div>
                  <h3 className="text-sm font-semibold">Extrato de estrelas</h3>
                  <p className="text-xs text-muted-foreground">Créditos, estornos, resgates e devoluções ficam registrados.</p>
                </div>
                <div className="max-h-64 space-y-1.5 overflow-y-auto">
                  {movimentos.map((movimento) => (
                    <div key={movimento.id} className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{movimentoLabel(movimento)}</p>
                        <p className="mt-0.5 break-words text-[11px] text-muted-foreground">
                          {movimento.descricao || "—"} · {dataHora(movimento.created_at)}
                        </p>
                      </div>
                      <span className={`shrink-0 text-sm font-bold ${movimento.quantidade > 0 ? "text-green-700" : "text-foreground"}`}>
                        {movimento.quantidade > 0 ? "+" : ""}{movimento.quantidade} ⭐
                      </span>
                    </div>
                  ))}
                  {movimentos.length === 0 && <p className="rounded-lg border p-3 text-sm text-muted-foreground">Ainda não há movimentos de estrelas.</p>}
                </div>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmacao !== null} onOpenChange={(value) => !value && setConfirmacao(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmacao?.tipo === "DESATIVAR" ? "Desativar recompensa?" : "Cancelar resgate?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmacao?.tipo === "DESATIVAR"
              ? "A recompensa deixa de aparecer para novos resgates. O histórico já existente permanece."
              : "As estrelas usadas neste resgate serão devolvidas ao saldo e o histórico permanecerá registrado."}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmacao(null)}>Voltar</Button>
            <Button type="button" onClick={() => void confirmarAcao()} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
