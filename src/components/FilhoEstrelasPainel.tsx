import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, EllipsisVertical, Loader2, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Filho } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { RecompensasAproveitadasSection } from "@/components/RecompensasAproveitadasSection";
import { resumoEstrelasVazio, type RecompensaEstrelaResumo, type ResumoEstrelas } from "@/lib/estrelas-model";

function Estrela({ className = "" }: { className?: string }) {
  return (
    <Star
      aria-hidden="true"
      className={`h-3.5 w-3.5 fill-amber-400 text-amber-500 ${className}`}
    />
  );
}

export function FilhoEstrelasPainel({ filho }: { filho: Filho }) {
  const [resumo, setResumo] = useState<ResumoEstrelas>(resumoEstrelasVazio);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<RecompensaEstrelaResumo | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [estrelas, setEstrelas] = useState("");
  const [recompensasAbertas, setRecompensasAbertas] = useState(false);
  const [confirmacao, setConfirmacao] = useState<
    | { tipo: "APROVEITOU"; recompensa: RecompensaEstrelaResumo }
    | { tipo: "DESATIVAR"; recompensa: RecompensaEstrelaResumo }
    | { tipo: "EXCLUIR"; recompensa: RecompensaEstrelaResumo }
    | null
  >(null);

  async function carregar() {
    setCarregando(true);
    try {
      const { data, error } = await supabase.rpc("resumo_estrelas_filho", {
        p_id_filho: filho.id,
      });

      if (error) throw error;

      const proximoResumo = (data as unknown as ResumoEstrelas | null) ?? resumoEstrelasVazio;
      setResumo(proximoResumo);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar as estrelas.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    setResumo(resumoEstrelasVazio);
    setEditando(null);
    setNome("");
    setDescricao("");
    setEstrelas("");
    setFormAberto(false);
    setRecompensasAbertas(false);
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

  function editarRecompensa(recompensa: RecompensaEstrelaResumo) {
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

  async function confirmarAcao() {
    if (!confirmacao) return;

    setSalvando(true);
    try {
      if (confirmacao.tipo === "APROVEITOU") {
        const { data, error } = await supabase.rpc("confirmar_recompensa_aproveitada", {
          p_id_recompensa: confirmacao.recompensa.id,
        });
        if (error) throw error;

        const retorno = data as unknown as { ok?: boolean; codigo?: string } | null;
        if (!retorno?.ok) {
          if (retorno?.codigo === "RECOMPENSA_INDISPONIVEL") {
            throw new Error("Esta recompensa já foi concluída ou não está mais disponível.");
          }
          throw new Error("Não foi possível confirmar a recompensa.");
        }

        toast.success("Recompensa marcada como aproveitada");
      } else if (confirmacao.tipo === "DESATIVAR") {
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
      }

      setConfirmacao(null);
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
    } finally {
      setSalvando(false);
    }
  }

  const recompensasOrdenadas = [...resumo.recompensas].sort((a, b) => a.id - b.id);
  const recompensaEditandoTemPendente = editando?.pendente === true;

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
              <span className="text-[11px] font-medium">Total de estrelas</span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{resumo.total_conquistado}</p>
          </div>
        </section>

        <CollapsibleSection
          className="bg-clean-surface"
          title="Recompensas"
          description="Cadastre o prêmio e defina quantas estrelas são necessárias."
          count={resumo.recompensas.length}
          open={recompensasAbertas}
          onOpenChange={setRecompensasAbertas}
          contentClassName="bg-clean-surface p-2.5 sm:p-3"
          action={
            <Button type="button" size="sm" className="h-8 shrink-0 px-2.5 text-xs" onClick={novaRecompensa}>
              <Plus className="h-3.5 w-3.5" /> Nova
            </Button>
          }
        >
          <div className="space-y-2.5">
            {recompensasOrdenadas.map((recompensa) => {
              const metaExibida = recompensa.meta_exibicao;
              const progressoExibido = recompensa.progresso_exibicao;
              const progresso = Math.min(
                100,
                Math.max(0, (progressoExibido / metaExibida) * 100),
              );
              return (
                <article key={recompensa.id} className="rounded-xl border bg-clean-surface p-3 shadow-sm sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold">{recompensa.nome_exibicao}</p>
                      {recompensa.descricao_exibicao && <p className="mt-0.5 break-words text-xs text-muted-foreground">{recompensa.descricao_exibicao}</p>}
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border bg-muted/20 px-2 py-1 text-xs font-semibold"><Estrela />{metaExibida}</span>
                  </div>

                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progresso}%` }} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">{progressoExibido} de {metaExibida}<Estrela className="h-3 w-3" /></span>
                    <div className="flex items-center gap-2">
                      <span className={recompensa.conquistada ? "font-semibold text-amber-700 dark:text-amber-300" : "text-muted-foreground"}>
                        {recompensa.conquistada
                          ? "Conquistada"
                          : <span className="inline-flex items-center gap-1">Faltam {recompensa.faltam_exibicao}<Estrela className="h-3 w-3" /></span>}
                      </span>
                      {recompensa.pode_confirmar_aproveitada && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px] font-semibold"
                          onClick={() => setConfirmacao({ tipo: "APROVEITOU", recompensa })}
                          disabled={salvando}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Já aproveitou
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2 border-t pt-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={salvando} aria-label={`Mais ações para ${recompensa.nome_exibicao}`}>
                          <EllipsisVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onSelect={() => editarRecompensa(recompensa)}><Pencil className="h-4 w-4" />Editar</DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!recompensa.pode_desativar}
                          title={!recompensa.pode_desativar ? "Aguarde o filho confirmar que aproveitou a recompensa." : undefined}
                          onSelect={() => setConfirmacao({ tipo: "DESATIVAR", recompensa })}
                        >
                          <X className="h-4 w-4" />Desativar
                        </DropdownMenuItem>
                        {recompensa.pode_excluir && (
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

        <RecompensasAproveitadasSection resgates={resumo.resgates} />

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
                Nome e descrição são atualizados agora. Se a quantidade de estrelas mudar, a conquista atual mantém a meta que já foi alcançada; a nova quantidade vale para o próximo ciclo.
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
              {confirmacao?.tipo === "APROVEITOU"
                ? "Já aproveitou?"
                : confirmacao?.tipo === "DESATIVAR"
                  ? "Desativar recompensa?"
                  : "Excluir recompensa?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmacao?.tipo === "APROVEITOU"
              ? `Confirme que ${filho.nome} já aproveitou “${confirmacao.recompensa.nome_exibicao}”. A nova contagem começa a partir das próximas estrelas.`
              : confirmacao?.tipo === "DESATIVAR"
                ? "A recompensa deixa de aparecer nos próximos ciclos. O histórico já existente permanece."
                : "Esta recompensa será excluída. As estrelas já conquistadas e o histórico existente serão preservados."}
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
              {confirmacao?.tipo === "APROVEITOU"
                ? "Sim, já aproveitou"
                : confirmacao?.tipo === "EXCLUIR"
                  ? "Excluir"
                  : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
