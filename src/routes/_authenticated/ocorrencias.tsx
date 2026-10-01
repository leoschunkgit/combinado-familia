import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CalendarRange, Clock3, ClipboardCheck, RotateCcw, Search, ThumbsDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { Pick } from "@/components/Pick";
import { fmtVigencia, msgErro, useFilhos, useFilhoTarefas, useOcorrencias, useVigencias, type FilhoTarefa } from "@/lib/db";

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

// datetime-local expects local wall-clock time rather than an ISO UTC string.
function localDateTime(value: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

const occurrenceDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

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

  const dataDe = (r: FilhoTarefa) => {
    const agora = localDateTime(new Date());
    const inicio = r.t_vigencia ? localDateTime(new Date(r.t_vigencia.data_inicio)) : agora;
    const fim = r.t_vigencia ? localDateTime(new Date(r.t_vigencia.data_fim)) : agora;
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
      toast.error("Informe a data e hora da ocorrência");
      return;
    }
    const momento = new Date(selecionada);
    if (Number.isNaN(momento.getTime()) || momento.getTime() < new Date(vigencia.data_inicio).getTime() || momento.getTime() > new Date(vigencia.data_fim).getTime()) {
      toast.error("A data e hora devem estar dentro do período da vigência");
      return;
    }
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
                        {penalizado && <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" /> Penalidade</Badge>}
                      </div>
                    </div>
                    <div className="divide-y border-t">
                      {tarefas.map((r) => {
                        const registros = ocorrencias.filter((o) => o.id_filho_tarefa === r.id).sort((a, b) => a.id - b.id);
                        const bloqueada = penalizado || r.feito === "N";
                        return (
                          <div key={r.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-6">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold">{r.t_tarefa?.nome}</p>
                              </div>
                              {registros.length > 0 && (
                                <ul className="mt-2 flex flex-wrap gap-2" aria-label={`Datas de não fez: ${r.t_tarefa?.nome}`}>
                                  {registros.map((o, i) => (
                                    <li key={o.id} className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs tabular-nums text-muted-foreground">
                                      <Clock3 className="h-3.5 w-3.5 shrink-0" />
                                      <span>{i + 1}º não fez · {occurrenceDate.format(new Date(o.created_at))}</span>
                                      {o.tipo === "PENALIDADE" && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Penalidade atingida" />}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div className="flex flex-wrap items-end gap-2 lg:justify-end">
                              {!bloqueada && (
                                <>
                                  <div className="w-full min-w-0 sm:w-52">
                                    <Label htmlFor={`data-${r.id}`} className="text-xs text-muted-foreground">Data e hora</Label>
                                    <Input id={`data-${r.id}`} type="datetime-local" className="mt-1" value={dataDe(r)} min={localDateTime(new Date(vigencia.data_inicio))} max={localDateTime(new Date(vigencia.data_fim))} onChange={(e) => setDatas({ ...datas, [r.id]: e.target.value })} />
                                  </div>
                                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => naoFez(r, total)}><ThumbsDown className="h-4 w-4" /> Não fez</Button>
                                </>
                              )}
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
    </>
  );
}