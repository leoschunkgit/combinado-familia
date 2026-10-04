import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { fmtVigencia, useFilhos, useFilhoTarefas, useOcorrencias, useVigencias, msgErro, type FilhoTarefa } from "@/lib/db";
import { vigenciaEmAndamento } from "@/components/VigenciaStatus";
import { dataBrasil, pendenciasDoDia } from "@/lib/notificacoes";
import { usaDesconto, valorDebitado, reais } from "@/lib/mesada";

type BonusTipo = "NENHUMA" | "TEXTO" | "VALOR";
type FezDraft = { tarefa: FilhoTarefa; bonusTipo: BonusTipo; descricao: string; valor: string };

export function CheckinDiario() {
  const qc = useQueryClient();
  const { data: filhos = [] } = useFilhos();
  const { data: vigencias = [] } = useVigencias();
  const { data: atribuicoes = [], isLoading: carregandoAtribuicoes } = useFilhoTarefas();
  const { data: ocorrencias = [], isLoading: carregandoOcorrencias } = useOcorrencias();
  const [dispensado, setDispensado] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fez, setFez] = useState<FezDraft | null>(null);
  const hoje = dataBrasil();

  const pendencias = useMemo(
    () => pendenciasDoDia(vigencias, atribuicoes, ocorrencias),
    [vigencias, atribuicoes, ocorrencias],
  );

  const grupos = useMemo(() => {
    return vigencias
      .filter(vigenciaEmAndamento)
      .map((vigencia) => ({
        vigencia,
        filhos: filhos
          .map((filho) => ({
            filho,
            tarefas: pendencias.filter(
              (p) => p.id_vigencia === vigencia.id && p.id_filho === filho.id,
            ),
          }))
          .filter((grupo) => grupo.tarefas.length > 0),
      }))
      .filter((grupo) => grupo.filhos.length > 0);
  }, [vigencias, filhos, pendencias]);

  const aberto =
    !carregandoAtribuicoes &&
    !carregandoOcorrencias &&
    !dispensado &&
    pendencias.length > 0;

  function totalNaoFez(r: FilhoTarefa) {
    return atribuicoes
      .filter((a) => a.id_filho === r.id_filho && a.id_vigencia === r.id_vigencia)
      .reduce((s, a) => s + a.qtd_nao_fez, 0);
  }

  async function registrarNaoFez(r: FilhoTarefa) {
    const v = r.t_vigencia;
    if (!v || !vigenciaEmAndamento(v)) return;

    const filho = filhos.find((x) => x.id === r.id_filho);
    const comDesconto = filho ? usaDesconto(filho, v) : false;
    const total = totalNaoFez(r);

    if (!comDesconto && total >= v.qtd_ocorrencia) {
      toast.error("O limite de Não fez desta vigência já foi atingido");
      return;
    }

    const novo = total + 1;
    const penalizado = !comDesconto && novo >= v.qtd_ocorrencia;

    setBusy(true);
    try {
      const { error } = await supabase.from("t_ocorrencia").insert({
        tipo: penalizado ? "PENALIDADE" : "NAO_FEZ",
        bonificacao_tipo: null,
        bonificacao_descricao: null,
        bonificacao_valor: null,
        id_filho_tarefa: r.id,
        created_at: new Date(hoje + "T12:00:00-03:00").toISOString(),
      });
      if (error) throw error;

      const atualizacao = await supabase
        .from("t_filho_tarefa")
        .update({ qtd_nao_fez: r.qtd_nao_fez + 1, feito: penalizado ? "N" : null })
        .eq("id", r.id);
      if (atualizacao.error) throw atualizacao.error;

      if (penalizado) {
        const grupo = await supabase
          .from("t_filho_tarefa")
          .update({ feito: "N" })
          .eq("id_filho", r.id_filho)
          .eq("id_vigencia", r.id_vigencia);
        if (grupo.error) throw grupo.error;
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ocorrencias"] }),
        qc.invalidateQueries({ queryKey: ["filho_tarefas"] }),
      ]);

      if (comDesconto && filho) {
        toast.success(
          `Não fez registrado · Desconto acumulado: ${reais(valorDebitado(filho, v, novo))}`,
        );
      } else if (penalizado) {
        toast.warning(`Limite atingido! Penalidade: ${v.penalidade}`);
      } else {
        toast.success(`Não fez registrado (${novo}/${v.qtd_ocorrencia})`);
      }
    } catch (e) {
      toast.error(msgErro(e as { message?: string }));
    } finally {
      setBusy(false);
    }
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
        created_at: new Date(hoje + "T12:00:00-03:00").toISOString(),
      });
      if (error) throw error;

      await qc.invalidateQueries({ queryKey: ["ocorrencias"] });
      setFez(null);
      toast.success(
        d.bonusTipo === "NENHUMA" ? "Fez registrado" : "Fez registrado com bonificação",
      );
    } catch (e) {
      toast.error(msgErro(e as { message?: string }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && !busy && setDispensado(true)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registro de hoje</DialogTitle>
          <DialogDescription>
            Marque Fez ou Não fez para as tarefas pendentes de hoje. Você pode fazer tudo aqui sem fechar o modal.
          </DialogDescription>
        </DialogHeader>

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
                    <span className="w-fit shrink-0 rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border">
                      {totalVigencia} {totalVigencia === 1 ? "pendência" : "pendências"}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 p-3 sm:p-4">
                  {gruposFilhos.map(({ filho, tarefas }) => (
                    <article key={filho.id} className="overflow-hidden rounded-xl border bg-background">
                      <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                            {filho.nome[0]?.toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Filho
                            </p>
                            <p className="truncate text-base font-bold">{filho.nome}</p>
                          </div>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">
                          {tarefas.length} {tarefas.length === 1 ? "tarefa" : "tarefas"}
                        </span>
                      </div>

                      <div className="divide-y">
                        {tarefas.map((tarefa) => {
                          const editandoFez = fez?.tarefa.id === tarefa.id;

                          return (
                            <div key={tarefa.id} className="p-3 sm:p-4">
                              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Tarefa
                                  </p>
                                  <p className="mt-0.5 break-words font-semibold">
                                    {tarefa.t_tarefa?.nome}
                                  </p>
                                </div>

                                {!editandoFez && (
                                  <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={busy}
                                      className="min-w-24"
                                      onClick={() =>
                                        setFez({
                                          tarefa,
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
                                      variant="destructive"
                                      disabled={busy}
                                      className="min-w-24"
                                      onClick={() => void registrarNaoFez(tarefa)}
                                    >
                                      <ThumbsDown className="h-4 w-4" />
                                      Não fez
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {editandoFez && fez && (
                                <div className="mt-4 space-y-4 rounded-lg border bg-muted/20 p-3 sm:p-4">
                                  <div className="space-y-2">
                                    <Label>Bonificação opcional</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant={fez.bonusTipo === "NENHUMA" ? "default" : "outline"}
                                        onClick={() => setFez({ ...fez, bonusTipo: "NENHUMA" })}
                                      >
                                        Nenhuma
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant={fez.bonusTipo === "TEXTO" ? "default" : "outline"}
                                        onClick={() => setFez({ ...fez, bonusTipo: "TEXTO" })}
                                      >
                                        Escrita
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant={fez.bonusTipo === "VALOR" ? "default" : "outline"}
                                        onClick={() => setFez({ ...fez, bonusTipo: "VALOR" })}
                                      >
                                        Valor
                                      </Button>
                                    </div>
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
                                      <input
                                        inputMode="decimal"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={fez.valor}
                                        onChange={(e) => setFez({ ...fez, valor: e.target.value })}
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
                                      onClick={() => void registrarFez(fez)}
                                    >
                                      Salvar Fez
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="text-center text-xs text-muted-foreground">
          {pendencias.length} {pendencias.length === 1 ? "tarefa pendente" : "tarefas pendentes"} hoje
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => setDispensado(true)}>
            Agora não
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
