import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/PageHeader";
import { fmtVigencia, msgErro, useFilhos, useFilhoTarefas, useOcorrencias, useVigencias, type FilhoTarefa } from "@/lib/db";
import { pendenciasAnteriores, pendenciasDoDia, useDataBrasilAtual } from "@/lib/notificacoes";
import { vigenciaEmAndamento } from "@/components/VigenciaStatus";
import { reais, usaDesconto, valorDebitado } from "@/lib/mesada";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  component: Notificacoes,
});

type FezAnterior = { tarefa: FilhoTarefa; data: string; bonusTipo: "NENHUMA" | "TEXTO" | "VALOR"; descricao: string; valor: string };

function Notificacoes() {
  const { data: filhos = [] } = useFilhos();
  const { data: vigencias = [] } = useVigencias();
  const { data: atribuicoes = [] } = useFilhoTarefas();
  const { data: ocorrencias = [] } = useOcorrencias();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [fezAnterior, setFezAnterior] = useState<FezAnterior | null>(null);
  const [filhosAbertos, setFilhosAbertos] = useState<Set<string> | null>(null);
  const hoje = useDataBrasilAtual();
  const pendencias = pendenciasDoDia(vigencias, atribuicoes, ocorrencias, new Date(hoje + "T12:00:00-03:00"));
  const anteriores = pendenciasAnteriores(vigencias, atribuicoes, ocorrencias, new Date(hoje + "T12:00:00-03:00"));
  const todasPendencias = [
    ...pendencias.map((tarefa) => ({ tarefa, data: hoje })),
    ...anteriores,
  ].sort((a, b) => b.data.localeCompare(a.data));

  const gruposAnteriores = vigencias
    .filter(vigenciaEmAndamento)
    .map((vigencia) => ({
      vigencia,
      filhos: filhos.map((filho) => ({
        filho,
        itens: todasPendencias.filter((p) => p.tarefa.id_vigencia === vigencia.id && p.tarefa.id_filho === filho.id),
      })).filter((g) => g.itens.length > 0),
    }))
    .filter((g) => g.filhos.length > 0);

  function totalNaoFez(r: FilhoTarefa) {
    return atribuicoes.filter((a) => a.id_filho === r.id_filho && a.id_vigencia === r.id_vigencia).reduce((s, a) => s + a.qtd_nao_fez, 0);
  }

  async function registrarNaoFezAnterior(r: FilhoTarefa, data: string) {
    const v = r.t_vigencia; if (!v || !vigenciaEmAndamento(v)) return;
    const filho = filhos.find((x) => x.id === r.id_filho);
    const comDesconto = filho ? usaDesconto(filho, v) : false;
    const total = totalNaoFez(r);
    if (!comDesconto && total >= v.qtd_ocorrencia) { toast.error("O limite de Não fez desta vigência já foi atingido"); return; }
    const novo = total + 1, penalizado = !comDesconto && novo >= v.qtd_ocorrencia;
    setBusy(true);
    try {
      const { error } = await supabase.from("t_ocorrencia").insert({ tipo: penalizado ? "PENALIDADE" : "NAO_FEZ", bonificacao_tipo: null, bonificacao_descricao: null, bonificacao_valor: null, id_filho_tarefa: r.id, created_at: new Date(data + "T12:00:00-03:00").toISOString() });
      if (error) throw error;
      const u = await supabase.from("t_filho_tarefa").update({ qtd_nao_fez: r.qtd_nao_fez + 1, feito: penalizado ? "N" : null }).eq("id", r.id);
      if (u.error) throw u.error;
      if (penalizado) {
        const g = await supabase.from("t_filho_tarefa").update({ feito: "N" }).eq("id_filho", r.id_filho).eq("id_vigencia", r.id_vigencia);
        if (g.error) throw g.error;
      }
      await Promise.all([qc.invalidateQueries({queryKey:["ocorrencias"]}), qc.invalidateQueries({queryKey:["filho_tarefas"]})]);
      if (comDesconto && filho) toast.success(`Não fez registrado · Desconto acumulado: ${reais(valorDebitado(filho, v, novo))}`);
      else if (penalizado) toast.warning(`Limite atingido! Penalidade: ${v.penalidade}`);
      else toast.success("Não fez registrado");
    } catch(e) { toast.error(msgErro(e as {message?: string})); } finally { setBusy(false); }
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
  const primeiraChaveFilho = chavesFilhos[0] ?? null;
  const filhoAberto = (chave: string) =>
    filhosAbertos === null ? chave === primeiraChaveFilho : filhosAbertos.has(chave);

  function alternarFilho(chave: string) {
    setFilhosAbertos((atual) => {
      const base = atual === null
        ? new Set(primeiraChaveFilho ? [primeiraChaveFilho] : [])
        : new Set(atual);
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
        title="Notificações"
        description="Veja os dias da vigência que ainda precisam de marcação."
        icon={<Bell className="h-6 w-6" />}
      />

      {todasPendencias.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
          <h2 className="mt-3 text-lg font-semibold">Tudo em dia</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos os dias desta vigência já têm Fez ou Não fez registrado.
          </p>
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Pendências</h2>
              <p className="text-sm text-muted-foreground">Dias desta vigência que ainda não têm nenhuma marcação.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={expandirTodos}>
                <ChevronsDown className="h-4 w-4" /> Expandir todos
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={recolherTodos}>
                <ChevronsUp className="h-4 w-4" /> Recolher todos
              </Button>
            </div>
          </div>
          {gruposAnteriores.map(({ vigencia, filhos: gruposFilhos }) => (
            <div key={vigencia.id} className="overflow-hidden rounded-2xl border bg-card">
              <div className="border-b bg-muted/30 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vigência</p>
                <p className="mt-1 font-semibold">{fmtVigencia(vigencia)}</p>
              </div>
              <div className="divide-y">
                {gruposFilhos.map(({ filho, itens }) => {
                  const chaveFilho = `${vigencia.id}|${filho.id}`;
                  const abertoFilho = filhoAberto(chaveFilho);
                  return (
                  <div key={filho.id} className="p-4">
                    <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => alternarFilho(chaveFilho)} aria-expanded={abertoFilho}>
                      <span className="font-bold">{filho.nome}</span>
                      <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
                        {itens.length} {itens.length === 1 ? "pendência" : "pendências"}
                        {abertoFilho ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </span>
                    </button>
                    {abertoFilho && <div className="mt-2 space-y-2">
                      {itens.map(({ tarefa, data }) => {
                        const chave = tarefa.id + "|" + data;
                        const editando = fezAnterior && (fezAnterior.tarefa.id + "|" + fezAnterior.data) === chave;
                        return <div key={chave} className="rounded-lg bg-muted/30 p-3">
                          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center">
                            <span className="font-medium">{tarefa.t_tarefa?.nome}</span>
                            <span className="text-sm text-muted-foreground">{data.split("-").reverse().join("/")}</span>
                            <span className="w-fit rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">Pendente</span>
                            {!editando && <div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={()=>setFezAnterior({tarefa,data,bonusTipo:"NENHUMA",descricao:"",valor:""})}><ThumbsUp className="h-4 w-4 text-green-600"/>Fez</Button><Button size="sm" variant="destructive" disabled={busy} onClick={()=>void registrarNaoFezAnterior(tarefa,data)}><ThumbsDown className="h-4 w-4"/>Não fez</Button></div>}
                          </div>
                          {editando && fezAnterior && <div className="mt-3 space-y-3 border-t pt-3">
                            <Label>Bonificação opcional</Label>
                            <div className="grid grid-cols-3 gap-2">
                              <Button size="sm" variant={fezAnterior.bonusTipo==="NENHUMA"?"default":"outline"} onClick={()=>setFezAnterior({...fezAnterior,bonusTipo:"NENHUMA"})}>Nenhuma</Button>
                              <Button size="sm" variant={fezAnterior.bonusTipo==="TEXTO"?"default":"outline"} onClick={()=>setFezAnterior({...fezAnterior,bonusTipo:"TEXTO"})}>Escrita</Button>
                              <Button size="sm" variant={fezAnterior.bonusTipo==="VALOR"?"default":"outline"} onClick={()=>setFezAnterior({...fezAnterior,bonusTipo:"VALOR"})}>Valor</Button>
                            </div>
                            {fezAnterior.bonusTipo==="TEXTO" && <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={fezAnterior.descricao} onChange={e=>setFezAnterior({...fezAnterior,descricao:e.target.value})}/>}
                            {fezAnterior.bonusTipo==="VALOR" && <input inputMode="decimal" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={fezAnterior.valor} onChange={e=>setFezAnterior({...fezAnterior,valor:e.target.value})}/>}
                            <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={()=>setFezAnterior(null)}>Cancelar</Button><Button size="sm" disabled={busy} onClick={()=>void registrarFezAnterior(fezAnterior)}>Salvar Fez</Button></div>
                          </div>}
                        </div>
                      })}
                    </div>}
                  </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
