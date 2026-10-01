import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, CalendarRange, ClipboardCheck, Pencil, RotateCcw, Search, ThumbsDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { BrDateField } from "@/components/BrDateField";
import { Pick } from "@/components/Pick";
import { fmtVigencia, msgErro, useFilhos, useFilhoTarefas, useOcorrencias, useVigencias, type FilhoTarefa, type Ocorrencia } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/ocorrencias")({
  head: () => ({ meta: [
    { title: "Ocorrências — Combinado" },
    { name: "description", content: "Registre e consulte as ocorrências de cada filho e tarefa por vigência." },
    { property: "og:title", content: "Ocorrências — Combinado" },
    { property: "og:description", content: "Registre e consulte as ocorrências de cada filho e tarefa por vigência." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: OcorrenciasPage,
});

function localDate(value: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

const occurrenceDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

function OcorrenciasPage() {
  const qc = useQueryClient();
  const { data: vigencias = [] } = useVigencias();
  const { data: filhos = [] } = useFilhos();
  const { data: todas = [], isLoading } = useFilhoTarefas();
  const { data: ocorrencias = [] } = useOcorrencias();
  const [f, setF] = useState({ vig: "all", filho: "all" });
  const [filtro, setFiltro] = useState(f);
  const [datas, setDatas] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [registro, setRegistro] = useState<{ tarefa: FilhoTarefa; total: number } | null>(null);
  const [correcao, setCorrecao] = useState<{ tarefa: FilhoTarefa; ocorrencia: Ocorrencia; data: string } | null>(null);

  const dataDe = (r: FilhoTarefa) => {
    const agora = localDate(new Date());
    const inicio = r.t_vigencia ? localDate(new Date(r.t_vigencia.data_inicio)) : agora;
    const fim = r.t_vigencia ? localDate(new Date(r.t_vigencia.data_fim)) : agora;
    if (datas[r.id] !== undefined) return datas[r.id];
    return agora < inicio ? inicio : agora > fim ? fim : agora;
  };

  const grupos = vigencias
    .filter((v) => filtro.vig === "all" || v.id === Number(filtro.vig))
    .map((vigencia) => ({
      vigencia,
      filhos: filhos
        .filter((filho) => filtro.filho === "all" || filho.id === Number(filtro.filho))
        .map((filho) => ({
          filho,
          tarefas: todas.filter((r) => r.id_vigencia === vigencia.id && r.id_filho === filho.id),
        }))
        .filter(({ tarefas }) => tarefas.length > 0),
    }))
    .filter(({ filhos: itens }) => itens.length > 0);

  async function atualizar(r: FilhoTarefa, patch: { qtd_nao_fez?: number; feito?: string | null }) {
    const { error } = await supabase.from("t_filho_tarefa").update(patch).eq("id", r.id);
    if (error) { toast.error(msgErro(error)); return false; }
    await qc.invalidateQueries({ queryKey: ["filho_tarefas"] });
    return true;
  }

  async function marcarGrupo(r: FilhoTarefa, feito: string | null) {
    let query = supabase.from("t_filho_tarefa").update({ feito }).eq("id_filho", r.id_filho).eq("id_vigencia", r.id_vigencia);
    if (feito === null) query = query.eq("feito", "N");
    const { error } = await query;
    if (error) toast.error(msgErro(error));
    await qc.invalidateQueries({ queryKey: ["filho_tarefas"] });
  }

  async function naoFez(r: FilhoTarefa, total: number) {
    const vigencia = r.t_vigencia;
    if (!vigencia) return;
    const selecionada = datas[r.id] ?? dataDe(r);
    if (!selecionada) {
      toast.error("Informe a data da ocorrência");
      return;
    }
    const inicio = localDate(new Date(vigencia.data_inicio));
    const fim = localDate(new Date(vigencia.data_fim));
    if (selecionada < inicio || selecionada > fim) {
      toast.error("A data deve estar dentro do período da vigência");
      return;
    }
    const dataRepetida = ocorrencias.some(
      (ocorrencia) => ocorrencia.id_filho_tarefa === r.id && localDate(new Date(ocorrencia.created_at)) === selecionada,
    );
    if (dataRepetida) {
      toast.error("Já existe um registro de “Não fez” para esta tarefa nesta data");
      return;
    }
    const momento = new Date(`${selecionada}T12:00:00`);
    setBusy(true);
    try {
      const novo = total + 1;
      const penalizado = novo >= vigencia.qtd_ocorrencia;
      const { error } = await supabase.from("t_ocorrencia").insert({
        id_filho_tarefa: r.id,
        tipo: penalizado ? "PENALIDADE" : "NAO_FEZ",
        created_at: momento.toISOString(),
      });
      if (error) { toast.error(msgErro(error)); return; }
      await atualizar(r, { qtd_nao_fez: r.qtd_nao_fez + 1, feito: penalizado ? "N" : null });
      if (penalizado) await marcarGrupo(r, "N");
      await qc.invalidateQueries({ queryKey: ["ocorrencias"] });
      if (penalizado) toast.warning(`Limite atingido! Penalidade: ${vigencia.penalidade}`);
      else toast(`Ocorrência registrada (${novo}/${vigencia.qtd_ocorrencia})`);
      setRegistro(null);
    } finally { setBusy(false); }
  }

  async function desfazer(r: FilhoTarefa, total: number) {
    setBusy(true);
    try {
      if (r.qtd_nao_fez > 0) {
        // The newest record is the last one inserted, even if its occurrence date was backdated.
        const { data: ultima, error: buscaErro } = await supabase.from("t_ocorrencia")
          .select("id").eq("id_filho_tarefa", r.id).order("id", { ascending: false }).limit(1).maybeSingle();
        if (buscaErro || !ultima) { toast.error(buscaErro ? msgErro(buscaErro) : "Não foi possível encontrar a ocorrência para desfazer"); return; }
        const { error } = await supabase.from("t_ocorrencia").delete().eq("id", ultima.id);
        if (error) { toast.error(msgErro(error)); return; }
        if (total >= (r.t_vigencia?.qtd_ocorrencia ?? 1)) await marcarGrupo(r, null);
        await qc.invalidateQueries({ queryKey: ["ocorrencias"] });
      }
      await atualizar(r, { qtd_nao_fez: Math.max(0, r.qtd_nao_fez - 1), feito: null });
    } finally { setBusy(false); }
  }

  async function corrigirData() {
    if (!correcao || busy) return;
    const { tarefa, ocorrencia, data } = correcao;
    const vigencia = tarefa.t_vigencia;
    if (!vigencia || !/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(new Date(`${data}T12:00:00`).getTime())) {
      toast.error("Informe uma data válida para a ocorrência");
      return;
    }
    if (ocorrencias.some((o) => o.id !== ocorrencia.id && o.id_filho_tarefa === tarefa.id && localDate(new Date(o.created_at)) === data)) {
      toast.error("Já existe um registro de “Não fez” para esta tarefa nesta data");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("t_ocorrencia").update({ created_at: new Date(`${data}T12:00:00`).toISOString() }).eq("id", ocorrencia.id);
      if (error) { toast.error(msgErro(error)); return; }
      await qc.invalidateQueries({ queryKey: ["ocorrencias"] });
      setCorrecao(null);
      toast.success("Data corrigida");
    } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Ocorrências" description="Acompanhe os combinados de cada filho por vigência." icon={<ClipboardCheck className="h-6 w-6" />} />
      <Card className="mb-8">
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <Pick label="Vigência" value={f.vig} onChange={(v) => setF({ ...f, vig: v })} allLabel="Todas" options={vigencias.map((v) => ({ value: String(v.id), label: fmtVigencia(v) }))} />
          <Pick label="Filho" value={f.filho} onChange={(v) => setF({ ...f, filho: v })} allLabel="Todos" options={filhos.map((x) => ({ value: String(x.id), label: x.nome }))} />
          <Button onClick={() => setFiltro(f)}><Search className="h-4 w-4" /> Pesquisar</Button>
        </CardContent>
      </Card>

      {!isLoading && grupos.length === 0 && <EmptyState>Nenhuma tarefa encontrada. Crie atribuições na aba "Atribuições".</EmptyState>}

      <div className="space-y-10">
        {grupos.map(({ vigencia, filhos: gruposFilho }) => (
          <section key={vigencia.id} aria-label={`Vigência ${fmtVigencia(vigencia)}`}>
            <div className="mb-5 flex min-w-0 items-start gap-3 border-b pb-4">
              <CalendarRange className="mt-1 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Vigência</p>
                <h2 className="text-xl font-bold">{fmtVigencia(vigencia)}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Penalidade: {vigencia.penalidade}</p>
              </div>
            </div>

            <div className="space-y-7">
              {gruposFilho.map(({ filho, tarefas }) => {
                const total = tarefas.reduce((s, r) => s + r.qtd_nao_fez, 0);
                const penalizado = total >= vigencia.qtd_ocorrencia;
                return (
                  <div key={filho.id} className="border-b pb-6 last:border-b-0">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 pb-3 sm:flex sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary font-bold text-secondary-foreground">{filho.nome[0]?.toUpperCase()}</span>
                        <h3 className="min-w-0 truncate text-lg font-bold">{filho.nome}</h3>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                        <span className="text-sm font-semibold tabular-nums">Não fez: {total} de {vigencia.qtd_ocorrencia}</span>
                        {penalizado && (
                          <Badge variant="destructive">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Penalidade: {vigencia.penalidade}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="divide-y border-t">
                      {tarefas.map((r) => {
                        const registros = ocorrencias.filter((o) => o.id_filho_tarefa === r.id).sort((a, b) => a.id - b.id);
                         const bloqueada = penalizado;
                        return (
                          <div key={r.id} className="grid gap-3 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-6">
                            <div className="min-w-0">
                               <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-semibold">{r.t_tarefa?.nome}</p>
                                 {!bloqueada && (
                                   <Button size="sm" variant="destructive" disabled={busy} onClick={() => setRegistro({ tarefa: r, total })}><ThumbsDown className="h-4 w-4" /> Não fez</Button>
                                 )}
                              </div>
                              {registros.length > 0 && (
                                <ul className="mt-2 flex flex-wrap gap-2" aria-label={`Datas de não fez: ${r.t_tarefa?.nome}`}>
                                  {registros.map((o, i) => (
                                    <li key={o.id} className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs tabular-nums text-muted-foreground">
                                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                      <span>{i + 1}º não fez · {occurrenceDate.format(new Date(o.created_at))}</span>
                                      {o.tipo === "PENALIDADE" && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Penalidade atingida" />}
                                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={busy} title="Corrigir data" aria-label={`Corrigir data de ${occurrenceDate.format(new Date(o.created_at))}`} onClick={() => setCorrecao({ tarefa: r, ocorrencia: o, data: localDate(new Date(o.created_at)) })}><Pencil className="h-3 w-3" /></Button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                             <div className="flex flex-wrap items-end gap-2 lg:justify-end">
                              {(r.qtd_nao_fez > 0) && (
                                <Button size="sm" variant="ghost" disabled={busy} onClick={() => desfazer(r, total)}><RotateCcw className="h-4 w-4" /> Desfazer</Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
       <Dialog open={Boolean(registro)} onOpenChange={(open) => !open && setRegistro(null)}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Registrar “Não fez”</DialogTitle>
             <DialogDescription>{registro?.tarefa.t_tarefa?.nome}</DialogDescription>
           </DialogHeader>
           {registro?.tarefa.t_vigencia && (
             <div className="space-y-2">
                <Label htmlFor="data-ocorrencia">Data</Label>
                <BrDateField
                  id="data-ocorrencia"
                  value={dataDe(registro.tarefa)}
                  min={localDate(new Date(registro.tarefa.t_vigencia.data_inicio))}
                  max={localDate(new Date(registro.tarefa.t_vigencia.data_fim))}
                  onChange={(date) => setDatas({ ...datas, [registro.tarefa.id]: date })}
                />
               <p className="text-xs text-muted-foreground">A data deve estar dentro da vigência.</p>
             </div>
           )}
           <DialogFooter>
             <Button type="button" variant="outline" onClick={() => setRegistro(null)}>Cancelar</Button>
             <Button type="button" variant="destructive" disabled={busy || !registro} onClick={() => registro && naoFez(registro.tarefa, registro.total)}><ThumbsDown className="h-4 w-4" /> Confirmar</Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
        <Dialog open={Boolean(correcao)} onOpenChange={(open) => !open && !busy && setCorrecao(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Corrigir data do “Não fez”</DialogTitle><DialogDescription>{correcao?.tarefa.t_tarefa?.nome}</DialogDescription></DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="corrigir-data">Data</Label>
               <BrDateField id="corrigir-data" value={correcao?.data ?? ""} onChange={(date) => setCorrecao((atual) => atual ? { ...atual, data: date } : null)} />
              <p className="text-xs text-muted-foreground">Para mudar o período da vigência, corrija aqui a data antes de salvá-lo.</p>
            </div>
            <DialogFooter><Button variant="outline" type="button" disabled={busy} onClick={() => setCorrecao(null)}>Cancelar</Button><Button type="button" disabled={busy} onClick={corrigirData}>Salvar data</Button></DialogFooter>
          </DialogContent>
        </Dialog>
    </>
  );
}