import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, CheckCircle2, ChevronsDown, ChevronsUp, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/CurrencyInput";
import { CollapseChevron } from "@/components/CollapseChevron";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { uiTypography } from "@/lib/ui-typography";
import { fmtVigencia, msgErro, useFilhos, useFilhoTarefas, useOcorrencias, useVigencias, type FilhoTarefa } from "@/lib/db";
import { pendenciasAnteriores, pendenciasDoDia, useDataBrasilAtual } from "@/lib/notificacoes";
import { vigenciaEmAndamento } from "@/components/VigenciaStatus";
import { reais, usaDesconto, valorDebitado } from "@/lib/mesada";
import { botaoFezClass, botaoNaoFezClass } from "@/lib/action-button-styles";
import { useActionLoading } from "@/components/ActionLoading";
import { penalidadeJaFoiAplicada } from "@/lib/penalidade";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  component: Notificacoes,
});

type FezAnterior = { tarefa: FilhoTarefa; data: string; bonusTipo: "NENHUMA" | "TEXTO" | "VALOR"; descricao: string; valor: string };
type PenalidadePendente = { tarefa: FilhoTarefa; data: string; descricao: string };

function Notificacoes() {
  const { data: filhos = [] } = useFilhos();
  const { data: vigencias = [] } = useVigencias();
  const { data: atribuicoes = [] } = useFilhoTarefas();
  const { data: ocorrencias = [] } = useOcorrencias();
  const qc = useQueryClient();
  const { runAction } = useActionLoading();
  const [busy, setBusy] = useState(false);
  const [fezAnterior, setFezAnterior] = useState<FezAnterior | null>(null);
  const [penalidadePendente, setPenalidadePendente] = useState<PenalidadePendente | null>(null);
  const [filhosAbertos, setFilhosAbertos] = useState<Set<string>>(new Set());
  const hoje = useDataBrasilAtual();
  const pendencias = pendenciasDoDia(vigencias, atribuicoes, ocorrencias, new Date(hoje + "T12:00:00-03:00"));
  const anteriores = pendenciasAnteriores(vigencias, atribuicoes, ocorrencias, new Date(hoje + "T12:00:00-03:00"));
  const todasPendencias = [
    ...pendencias.map((tarefa) => ({ tarefa, data: hoje })),
    ...anteriores,
  ].sort((a, b) => b.data.localeCompare(a.data));

  const gruposAnteriores = [...vigencias]
    .filter(vigenciaEmAndamento)
    .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime())
    .map((vigencia) => ({
      vigencia,
      filhos: filhos.map((filho) => ({
        filho,
        itens: todasPendencias.filter((p) => p.tarefa.id_vigencia === vigencia.id && p.tarefa.id_filho === filho.id),
      })).filter((g) => g.itens.length > 0),
    }))
    .filter((g) => g.filhos.length > 0);

  function totalNaoFez(r: FilhoTarefa) {
    return ocorrencias.filter(
      (o) =>
        o.tipo !== "FEZ" &&
        o.t_filho_tarefa?.id_filho === r.id_filho &&
        o.t_filho_tarefa?.id_vigencia === r.id_vigencia,
    ).length;
  }

  async function registrarNaoFezAnterior(r: FilhoTarefa, data: string, penalidadeTexto?: string) {
    const v = r.t_vigencia; if (!v || !vigenciaEmAndamento(v)) return;
    const filho = filhos.find((x) => x.id === r.id_filho);
    const comDesconto = filho ? usaDesconto(filho, v) : false;
    const total = totalNaoFez(r);
    if (!comDesconto && total >= v.qtd_ocorrencia) { toast.error("O limite de Não fez desta vigência já foi atingido"); return; }

    const novo = total + 1;
    const penalizado = !comDesconto && novo >= v.qtd_ocorrencia;
    const penalidadeAtual = v.penalidade?.trim() ?? "";
    const penalidadeInformada = penalidadeTexto?.trim() ?? "";
    const vigenciaCompleta = vigencias.find((item) => item.id === r.id_vigencia);
    const penalidadeJaAplicada = vigenciaCompleta
      ? penalidadeJaFoiAplicada(vigenciaCompleta, filhos, ocorrencias)
      : Boolean(penalidadeAtual);

    if (penalizado && !penalidadeJaAplicada && !penalidadeInformada) {
      setPenalidadePendente({ tarefa: r, data, descricao: "" });
      return;
    }

    setBusy(true);
    let penalidadeSalvaAgora = false;
    try {
      if (penalizado && !penalidadeJaAplicada && penalidadeInformada) {
        const atualizacao = await supabase
          .from("t_vigencia")
          .update({ penalidade: penalidadeInformada })
          .eq("id", r.id_vigencia);
        if (atualizacao.error) throw atualizacao.error;
        penalidadeSalvaAgora = true;
      }

      const { error } = await supabase.from("t_ocorrencia").insert({
        tipo: "NAO_FEZ",
        bonificacao_tipo: null,
        bonificacao_descricao: null,
        bonificacao_valor: null,
        id_filho_tarefa: r.id,
        created_at: new Date(data + "T12:00:00-03:00").toISOString(),
      });
      if (error) {
        if (penalidadeSalvaAgora) {
          await supabase.from("t_vigencia").update({ penalidade: penalidadeAtual || null }).eq("id", v.id);
        }
        throw error;
      }

      await Promise.all([
        qc.invalidateQueries({queryKey:["ocorrencias"]}),
        qc.invalidateQueries({queryKey:["vigencias"]}),
        qc.invalidateQueries({queryKey:["filho_tarefas"]}),
      ]);
      setPenalidadePendente(null);

      if (comDesconto && filho) toast.success(`Não fez registrado · Desconto acumulado: ${reais(valorDebitado(filho, v, novo))}`);
      else if (penalizado) toast.warning(`Limite atingido! Penalidade: ${penalidadeInformada || penalidadeAtual}`);
      else toast.success("Não fez registrado");
    } catch(e) {
      toast.error(msgErro(e as {message?: string}));
    } finally {
      setBusy(false);
    }
  }

  async function confirmarPenalidade() {
    if (!penalidadePendente) return;
    const texto = penalidadePendente.descricao.trim();
    if (texto.length < 2) { toast.error("Escreva a penalidade para continuar"); return; }
    if (texto.length > 200) { toast.error("A penalidade deve ter no máximo 200 caracteres"); return; }
    await registrarNaoFezAnterior(penalidadePendente.tarefa, penalidadePendente.data, texto);
  }

  async function registrarFezAnterior(d: FezAnterior) {
    if (d.bonusTipo === "TEXTO" && !d.descricao.trim()) { toast.error("Informe a bonificação escrita"); return; }
    const valor = d.bonusTipo === "VALOR" ? Number(d.valor.replace(",",".")) : null;
    if (d.bonusTipo === "VALOR" && (valor === null || !Number.isFinite(valor) || valor < 0)) { toast.error("Informe um valor de bonificação válido"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("t_ocorrencia").insert({ tipo:"FEZ", bonificacao_tipo:d.bonusTipo==="NENHUMA"?null:d.bonusTipo, bonificacao_descricao:d.bonusTipo==="TEXTO"?d.descricao.trim():null, bonificacao_valor:d.bonusTipo==="VALOR"?valor:null, id_filho_tarefa:d.tarefa.id, created_at:new Date(d.data+"T12:00:00-03:00").toISOString() });
      if (error) throw error;
      await qc.invalidateQueries({queryKey:["ocorrencias"]});
      setFezAnterior(null);
      toast.success("Fez registrado");
    } catch(e) { toast.error(msgErro(e as {message?: string})); } finally { setBusy(false); }
  }



  const chavesFilhos = gruposAnteriores.flatMap(({ vigencia, filhos: gruposFilhos }) =>
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


  return (
    <div className="space-y-6">
      <PageHeader
        title="Pendências"
        description="Veja os dias que ainda precisam de marcação"
        icon={<Bell className="h-6 w-6" />}
      />

      {todasPendencias.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
          <h2 className={`mt-3 ${uiTypography.secondaryTitle}`}>Tudo em dia</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos os dias desta vigência já têm Fez ou Não fez registrado.
          </p>
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={expandirTodos}>
                <ChevronsDown className="h-4 w-4" /> Expandir todos
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={recolherTodos}>
                <ChevronsUp className="h-4 w-4" /> Recolher todos
              </Button>
            </div>
          </div>
          {gruposAnteriores.map(({ vigencia, filhos: gruposFilhos }) => {
            const totalVigencia = gruposFilhos.reduce((soma, grupo) => soma + grupo.itens.length, 0);

            return (
              <section key={vigencia.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className="border-b bg-primary/5 px-4 py-3 sm:px-5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Vigência atual</p>
                      <p className="mt-1 break-words font-semibold">{fmtVigencia(vigencia)}</p>
                    </div>
                    <span className="w-fit rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border">
                      {totalVigencia} {totalVigencia === 1 ? "pendência" : "pendências"}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 p-3 sm:p-4">
                  {gruposFilhos.map(({ filho, itens }) => {
                    const chaveFilho = `${vigencia.id}|${filho.id}`;
                    const abertoFilho = filhoAberto(chaveFilho);

                    return (
                      <article key={filho.id} className="overflow-hidden rounded-xl border bg-background">
                        <button type="button" className="flex w-full items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3 text-left" onClick={() => alternarFilho(chaveFilho)} aria-expanded={abertoFilho}>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Filho</p>
                            <p className="truncate text-base font-bold">{filho.nome}</p>
                          </div>
                          <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
                            {itens.length} {itens.length === 1 ? "pendência" : "pendências"}
                            <CollapseChevron open={abertoFilho} className="h-6 w-6" />
                          </span>
                        </button>

                        {abertoFilho && <div className="divide-y">
                          {itens.map(({ tarefa, data }) => {
                            const chave = tarefa.id + "|" + data;
                            const editando = fezAnterior && (fezAnterior.tarefa.id + "|" + fezAnterior.data) === chave;

                            return (
                              <div key={chave} className="p-3 sm:p-4">
                                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tarefa</p>
                                    <p className="mt-0.5 break-words font-semibold">{tarefa.t_tarefa?.nome}</p>
                                    <div className="mt-2">
                                      <span className="inline-flex items-center rounded-md border bg-primary/5 px-2.5 py-1 text-sm font-bold tabular-nums text-primary">
                                        {data.split("-").reverse().join("/")}
                                      </span>
                                    </div>
                                  </div>

                                  {!editando && (
                                    <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                                      <Button size="sm" variant="outline" disabled={busy} className={`min-w-24 ${botaoFezClass}`} onClick={() => setFezAnterior({ tarefa, data, bonusTipo: "NENHUMA", descricao: "", valor: "" })}>
                                        <ThumbsUp className="h-4 w-4 text-green-600" /> Fez
                                      </Button>
                                      <Button size="sm" variant="outline" disabled={busy} className={`min-w-24 ${botaoNaoFezClass}`} onClick={() => void runAction(() => registrarNaoFezAnterior(tarefa, data))}>
                                        <ThumbsDown className="h-4 w-4 text-red-600" /> Não fez
                                      </Button>
                                    </div>
                                  )}
                                </div>

                                {editando && fezAnterior && (
                                  <div className="mt-4 space-y-4 rounded-lg border bg-muted/20 p-3 sm:p-4">
                                    <div className="space-y-2">
                                      <Label>Bonificação opcional</Label>
                                      <Select value={fezAnterior.bonusTipo} onValueChange={(valor) => setFezAnterior({ ...fezAnterior, bonusTipo: valor as FezAnterior["bonusTipo"] })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="NENHUMA">Nenhuma</SelectItem>
                                          <SelectItem value="TEXTO">Escrita</SelectItem>
                                          <SelectItem value="VALOR">Valor</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {fezAnterior.bonusTipo === "TEXTO" && (
                                      <div className="space-y-2">
                                        <Label>Bonificação escrita</Label>
                                        <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={fezAnterior.descricao} onChange={(e) => setFezAnterior({ ...fezAnterior, descricao: e.target.value })} />
                                      </div>
                                    )}

                                    {fezAnterior.bonusTipo === "VALOR" && (
                                      <div className="space-y-2">
                                        <Label>Valor da bonificação (R$)</Label>
                                        <CurrencyInput value={fezAnterior.valor} onValueChange={(valor) => setFezAnterior({ ...fezAnterior, valor })} />
                                      </div>
                                    )}

                                    <div className="flex justify-end gap-2">
                                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setFezAnterior(null)}>Cancelar</Button>
                                      <Button size="sm" disabled={busy} onClick={() => void runAction(() => registrarFezAnterior(fezAnterior))}>Salvar Fez</Button>
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
        </section>
      )}
    </div>

    <Dialog open={Boolean(penalidadePendente)} onOpenChange={(novoEstado) => !novoEstado && !busy && setPenalidadePendente(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aplicar penalidade</DialogTitle>
          <DialogDescription>Qual será a penalidade aplicada agora?</DialogDescription>
        </DialogHeader>
        {penalidadePendente && (
          <div className="space-y-2">
            <Label htmlFor="penalidade-notificacoes">Penalidade *</Label>
            <input
              id="penalidade-notificacoes"
              autoFocus
              maxLength={200}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Ex.: Sem celular por 30 minutos"
              value={penalidadePendente.descricao}
              onChange={(e) => setPenalidadePendente({ ...penalidadePendente, descricao: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Obrigatória para registrar o “Não fez” que atingiu o limite.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => setPenalidadePendente(null)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={busy || !penalidadePendente || penalidadePendente.descricao.trim().length < 2}
            onClick={() => void runAction(confirmarPenalidade)}
          >
            <AlertTriangle className="h-4 w-4" /> Salvar penalidade e “Não fez”
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  );
}
