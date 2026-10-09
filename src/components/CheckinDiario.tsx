import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronsDown, ChevronsUp, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/CurrencyInput";
import { CollapseChevron } from "@/components/CollapseChevron";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtVigencia, useFilhos, useFilhoTarefas, useOcorrencias, useVigencias, msgErro, type FilhoTarefa } from "@/lib/db";
import { vigenciaEmAndamento } from "@/components/VigenciaStatus";
import { pendenciasAnteriores, pendenciasDoDia, useDataBrasilAtual } from "@/lib/notificacoes";
import { valorDebitado, reais } from "@/lib/mesada";
import { botaoFezClass, botaoNaoFezClass } from "@/lib/action-button-styles";
import { useActionLoading } from "@/components/ActionLoading";
import { registrarNaoFezComPenalidade } from "@/lib/penalidade";
import { PenalidadeDialog } from "@/components/PenalidadeDialog";

type BonusTipo = "NENHUMA" | "TEXTO" | "VALOR";
type FezDraft = { tarefa: FilhoTarefa; data: string; bonusTipo: BonusTipo; descricao: string; valor: string };
type PenalidadeDraft = { tarefa: FilhoTarefa; data: string; descricao: string };

type CheckinDiarioProps = { open: boolean; onOpenChange: (open: boolean) => void };

export function CheckinDiario({ open, onOpenChange }: CheckinDiarioProps) {
  const qc = useQueryClient();
  const { runAction } = useActionLoading();
  const { data: filhos = [] } = useFilhos();
  const { data: vigencias = [] } = useVigencias();
  const { data: atribuicoes = [], isLoading: carregandoAtribuicoes } = useFilhoTarefas();
  const { data: ocorrencias = [], isLoading: carregandoOcorrencias } = useOcorrencias();
  const [busy, setBusy] = useState(false);
  const [fez, setFez] = useState<FezDraft | null>(null);
  const [penalidadePendente, setPenalidadePendente] = useState<PenalidadeDraft | null>(null);
  const [filhosAbertos, setFilhosAbertos] = useState<Set<string>>(new Set());
  const hoje = useDataBrasilAtual();

  useEffect(() => {
    if (open) {
      setFilhosAbertos(new Set());
      setFez(null);
      setPenalidadePendente(null);
    }
  }, [open]);
  const pendenciasHoje = useMemo(
    () => pendenciasDoDia(vigencias, atribuicoes, ocorrencias, new Date(hoje + "T12:00:00-03:00")),
    [vigencias, atribuicoes, ocorrencias, hoje],
  );

  const pendenciasPassadas = useMemo(
    () => pendenciasAnteriores(vigencias, atribuicoes, ocorrencias, new Date(hoje + "T12:00:00-03:00")),
    [vigencias, atribuicoes, ocorrencias, hoje],
  );

  const pendencias = useMemo(
    () => [
      ...pendenciasHoje.map((tarefa) => ({ tarefa, data: hoje })),
      ...pendenciasPassadas,
    ].sort((a, b) => b.data.localeCompare(a.data)),
    [pendenciasHoje, pendenciasPassadas, hoje],
  );

  const grupos = useMemo(() => {
    return [...vigencias]
      .filter(vigenciaEmAndamento)
      .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime())
      .map((vigencia) => ({
        vigencia,
        filhos: filhos
          .map((filho) => ({
            filho,
            tarefas: pendencias.filter(
              (p) => p.tarefa.id_vigencia === vigencia.id && p.tarefa.id_filho === filho.id,
            ),
          }))
          .filter((grupo) => grupo.tarefas.length > 0),
      }))
      .filter((grupo) => grupo.filhos.length > 0);
  }, [vigencias, filhos, pendencias]);

  const aberto =
    open &&
    !carregandoAtribuicoes &&
    !carregandoOcorrencias &&
    pendencias.length > 0;

  async function registrarNaoFez(r: FilhoTarefa, data: string, penalidadeTexto?: string) {
    const v = r.t_vigencia;
    if (!v || !vigenciaEmAndamento(v)) return;

    const filho = filhos.find((x) => x.id === r.id_filho);
    const vigenciaCompleta = vigencias.find((item) => item.id === r.id_vigencia);

    setBusy(true);
    try {
      const resultado = await registrarNaoFezComPenalidade({
        tarefa: r,
        filho,
        vigenciaCompleta,
        filhos,
        ocorrencias,
        dataIso: new Date(data + "T12:00:00-03:00").toISOString(),
        penalidadeTexto,
      });

      if (resultado.status === "PRECISA_PENALIDADE") {
        setPenalidadePendente({ tarefa: r, data, descricao: "" });
        return;
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ocorrencias"] }),
        qc.invalidateQueries({ queryKey: ["vigencias"] }),
        qc.invalidateQueries({ queryKey: ["filho_tarefas"] }),
      ]);
      setPenalidadePendente(null);

      if (resultado.comDesconto && filho) {
        toast.success(
          `“Não fez” registrado · Desconto acumulado: ${reais(valorDebitado(filho, v, resultado.novoTotal))}`,
        );
      } else if (resultado.penalizado) {
        toast.warning(`Limite atingido! Penalidade: ${resultado.penalidade}`);
      } else {
        toast.success(`“Não fez” registrado (${resultado.novoTotal}/${v.qtd_ocorrencia})`);
      }
    } catch (e) {
      toast.error(msgErro(e as { message?: string }));
    } finally {
      setBusy(false);
    }
  }

  async function confirmarPenalidade() {
    if (!penalidadePendente) return;
    await registrarNaoFez(
      penalidadePendente.tarefa,
      penalidadePendente.data,
      penalidadePendente.descricao.trim(),
    );
  }
  async function registrarFez(d: FezDraft) {
    const r = d.tarefa;
    const v = r.t_vigencia;
    if (!v || !vigenciaEmAndamento(v)) return;

    if (d.bonusTipo === "TEXTO" && !d.descricao.trim()) {
      toast.error("Informe a bonificação escrita");
      return;
    }

    const valor = d.bonusTipo === "VALOR" ? Number(d.valor.replace(",", ".")) : null;
    if (
      d.bonusTipo === "VALOR" &&
      (valor === null || !Number.isFinite(valor) || valor < 0)
    ) {
      toast.error("Informe um valor de bonificação válido");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.from("t_ocorrencia").insert({
        tipo: "FEZ",
        bonificacao_tipo: d.bonusTipo === "NENHUMA" ? null : d.bonusTipo,
        bonificacao_descricao: d.bonusTipo === "TEXTO" ? d.descricao.trim() : null,
        bonificacao_valor: d.bonusTipo === "VALOR" ? valor : null,
        id_filho_tarefa: r.id,
        created_at: new Date(d.data + "T12:00:00-03:00").toISOString(),
      });
      if (error) throw error;

      await qc.invalidateQueries({ queryKey: ["ocorrencias"] });
      setFez(null);
      toast.success(
        d.bonusTipo === "NENHUMA" ? "“Fez” registrado" : "“Fez” registrado com bonificação",
      );
    } catch (e) {
      toast.error(msgErro(e as { message?: string }));
    } finally {
      setBusy(false);
    }
  }

  const chavesFilhos = grupos.flatMap(({ vigencia, filhos: gruposFilhos }) =>
    gruposFilhos.map(({ filho }) => `${vigencia.id}|${filho.id}`),
  );
  const filhoAberto = (chave: string) => filhosAbertos.has(chave);

  function alternarFilho(chave: string) {
    setFilhosAbertos((atual) => {
      const base = new Set(atual);
      if (base.has(chave)) base.delete(chave);
      else base.add(chave);
      return base;
    });
  }

  function expandirTodos() {
    setFilhosAbertos(new Set(chavesFilhos));
  }

  function recolherTodos() {
    setFilhosAbertos(new Set());
  }


  return <>
    <Dialog open={aberto} onOpenChange={(novoEstado) => !busy && onOpenChange(novoEstado)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pendências</DialogTitle>
          <DialogDescription>
            Marque Fez ou Não fez nos dias desta vigência que ainda não têm nenhuma marcação.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={expandirTodos}>
            <ChevronsDown className="h-4 w-4" /> Expandir todos
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={recolherTodos}>
            <ChevronsUp className="h-4 w-4" /> Recolher todos
          </Button>
        </div>

        <div className="space-y-5">
          {grupos.map(({ vigencia, filhos: gruposFilhos }) => {
            const totalVigencia = gruposFilhos.reduce(
              (soma, grupo) => soma + grupo.tarefas.length,
              0,
            );

            return (
              <section key={vigencia.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className="border-b bg-primary/5 px-4 py-3 sm:px-5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                        Vigência atual
                      </p>
                      <p className="mt-1 break-words font-semibold">{fmtVigencia(vigencia)}</p>
                    </div>
                    <span className="w-fit rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border">
                      {totalVigencia} {totalVigencia === 1 ? "pendência" : "pendências"}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 p-3 sm:p-4">
                  {gruposFilhos.map(({ filho, tarefas }) => {
                    const chaveFilho = `${vigencia.id}|${filho.id}`;
                    const abertoFilho = filhoAberto(chaveFilho);
                    return (
                    <article key={filho.id} className="overflow-hidden rounded-xl border bg-background">
                      <button type="button" className="flex w-full items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3 text-left" onClick={() => alternarFilho(chaveFilho)} aria-expanded={abertoFilho}>
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Filho
                            </p>
                            <p className="truncate text-base font-bold">{filho.nome}</p>
                          </div>
                        </div>
                        <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
                          {tarefas.length} {tarefas.length === 1 ? "pendência" : "pendências"}
                          <CollapseChevron open={abertoFilho} className="h-6 w-6" />
                        </span>
                      </button>

                      {abertoFilho && <div className="divide-y">
                        {tarefas.map(({ tarefa, data }) => {
                          const editandoFez = fez?.tarefa.id === tarefa.id && fez.data === data;

                          return (
                            <div key={`${tarefa.id}|${data}`} className="p-3 sm:p-4">
                              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Tarefa
                                  </p>
                                  <p className="mt-0.5 break-words font-semibold">
                                    {tarefa.t_tarefa?.nome}
                                  </p>
                                  <div className="mt-2">
                                    <span className="inline-flex items-center rounded-md border bg-primary/5 px-2.5 py-1 text-sm font-bold tabular-nums text-primary">
                                      {data.split("-").reverse().join("/")}
                                    </span>
                                  </div>
                                </div>

                                {!editandoFez && (
                                  <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={busy}
                                      className={`min-w-24 ${botaoFezClass}`}
                                      onClick={() =>
                                        setFez({
                                          tarefa,
                                          data,
                                          bonusTipo: "NENHUMA",
                                          descricao: "",
                                          valor: "",
                                        })
                                      }
                                    >
                                      <ThumbsUp className="h-4 w-4 text-green-600" />
                                      Fez
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={busy}
                                      className={`min-w-24 ${botaoNaoFezClass}`}
                                      onClick={() => void runAction(() => registrarNaoFez(tarefa, data))}
                                    >
                                      <ThumbsDown className="h-4 w-4 text-red-600" />
                                      Não fez
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {editandoFez && fez && (
                                <div className="mt-4 space-y-4 rounded-lg border bg-muted/20 p-3 sm:p-4">
                                  <div className="space-y-2">
                                    <Label>Bonificação opcional</Label>
                                    <Select
                                      value={fez.bonusTipo}
                                      onValueChange={(valor) => setFez({ ...fez, bonusTipo: valor as BonusTipo })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="NENHUMA">Nenhuma</SelectItem>
                                        <SelectItem value="TEXTO">Escrita</SelectItem>
                                        <SelectItem value="VALOR">Valor</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {fez.bonusTipo === "TEXTO" && (
                                    <div className="space-y-2">
                                      <Label>Bonificação escrita</Label>
                                      <input
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={fez.descricao}
                                        onChange={(e) => setFez({ ...fez, descricao: e.target.value })}
                                      />
                                    </div>
                                  )}

                                  {fez.bonusTipo === "VALOR" && (
                                    <div className="space-y-2">
                                      <Label>Valor da bonificação (R$)</Label>
                                      <CurrencyInput
                                        value={fez.valor}
                                        onValueChange={(valor) => setFez({ ...fez, valor })}
                                      />
                                    </div>
                                  )}

                                  <div className="flex justify-end gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={busy}
                                      onClick={() => setFez(null)}
                                    >
                                      Cancelar
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={busy}
                                      onClick={() => void runAction(() => registrarFez(fez))}
                                    >
                                      Salvar Fez
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>}
                    </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>


        <DialogFooter className="border-t pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            className="min-w-28"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <PenalidadeDialog
      open={Boolean(penalidadePendente)}
      value={penalidadePendente?.descricao ?? ""}
      busy={busy}
      inputId="penalidade-pendencias"
      onChange={(descricao) =>
        setPenalidadePendente((atual) => atual ? { ...atual, descricao } : atual)
      }
      onCancel={() => setPenalidadePendente(null)}
      onConfirm={() => void runAction(confirmarPenalidade)}
    />
    </>;
}
