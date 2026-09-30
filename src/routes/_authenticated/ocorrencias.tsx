import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Check, ClipboardCheck, RotateCcw, Search, ThumbsDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { Pick } from "@/components/Pick";
import { fmtVigencia, useFilhos, useFilhoTarefas, useTarefas, useVigencias, type FilhoTarefa } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/ocorrencias")({
  head: () => ({ meta: [{ title: "Ocorrências — Combinado" }] }),
  component: OcorrenciasPage,
});

function OcorrenciasPage() {
  const qc = useQueryClient();
  const { data: vigencias = [] } = useVigencias();
  const { data: filhos = [] } = useFilhos();
  const { data: tarefas = [] } = useTarefas();
  const { data: todas = [], isLoading } = useFilhoTarefas();
  const [f, setF] = useState({ vig: "all", filho: "all", tarefa: "all" });
  const [filtro, setFiltro] = useState(f);

  const lista = todas.filter(
    (r) =>
      (filtro.vig === "all" || r.id_vigencia === +filtro.vig) &&
      (filtro.filho === "all" || r.id_filho === +filtro.filho) &&
      (filtro.tarefa === "all" || r.id_tarefa === +filtro.tarefa),
  );

  async function atualizar(r: FilhoTarefa, patch: { qtd_nao_fez?: number; feito?: string | null }) {
    const { error } = await supabase.from("t_filho_tarefa").update(patch).eq("id", r.id);
    if (error) { toast.error(msgErro(error)); return; }
    qc.invalidateQueries({ queryKey: ["filho_tarefas"] });
  }

  async function naoFez(r: FilhoTarefa) {
    const limite = r.t_vigencia?.qtd_ocorrencia ?? 1;
    const novo = Math.min(r.qtd_nao_fez + 1, limite);
    const penalizado = novo >= limite;
    const { error } = await supabase.from("t_ocorrencia").insert({
      id_filho_tarefa: r.id,
      tipo: penalizado ? "PENALIDADE" : "NAO_FEZ",
    });
    if (error) { toast.error(msgErro(error)); return; }
    atualizar(r, { qtd_nao_fez: novo, feito: penalizado ? "N" : null });
    qc.invalidateQueries({ queryKey: ["ocorrencias"] });
    if (penalizado) toast.warning(`Limite atingido! Penalidade: ${r.t_vigencia?.penalidade}`);
    else toast(`Ocorrência registrada (${novo}/${limite})`);
  }

  async function desfazer(r: FilhoTarefa, cumprida: boolean) {
    if (!cumprida && r.qtd_nao_fez > 0) {
      const { data: ultima } = await supabase
        .from("t_ocorrencia")
        .select("id")
        .eq("id_filho_tarefa", r.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ultima) {
        await supabase.from("t_ocorrencia").delete().eq("id", ultima.id);
        qc.invalidateQueries({ queryKey: ["ocorrencias"] });
      }
    }
    atualizar(
      r,
      cumprida ? { feito: null } : { qtd_nao_fez: Math.max(0, r.qtd_nao_fez - 1), feito: null },
    );
  }

  return (
    <>
      <PageHeader title="Ocorrências" description="Consulte as tarefas e registre quando algo não foi feito." icon={<ClipboardCheck className="h-6 w-6" />} />
      <Card className="mb-6">
        <CardContent className="grid gap-4 pt-6 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <Pick label="Vigência" value={f.vig} onChange={(v) => setF({ ...f, vig: v })} allLabel="Todas" options={vigencias.map((v) => ({ value: String(v.id), label: fmtVigencia(v) }))} />
          <Pick label="Filho" value={f.filho} onChange={(v) => setF({ ...f, filho: v })} allLabel="Todos" options={filhos.map((x) => ({ value: String(x.id), label: x.nome }))} />
          <Pick label="Tarefa" value={f.tarefa} onChange={(v) => setF({ ...f, tarefa: v })} allLabel="Todas" options={tarefas.map((t) => ({ value: String(t.id), label: t.nome }))} />
          <Button onClick={() => setFiltro(f)}><Search className="h-4 w-4" /> Pesquisar</Button>
        </CardContent>
      </Card>

      {!isLoading && lista.length === 0 && (
        <EmptyState>Nenhuma tarefa encontrada. Crie atribuições na aba "Atribuições".</EmptyState>
      )}

      <div className="grid gap-4">
        {lista.map((r) => {
          const limite = r.t_vigencia?.qtd_ocorrencia ?? 1;
          const penalizado = r.feito === "N" || r.qtd_nao_fez >= limite;
          const cumprida = r.feito === "S";
          return (
            <div
              key={r.id}
              className={`rounded-2xl border bg-card p-5 transition-colors ${penalizado ? "border-destructive/50 bg-destructive/5" : cumprida ? "border-success/50 bg-success/5" : ""}`}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-lg font-bold">{r.t_filho?.nome}</p>
                    <span className="text-muted-foreground">·</span>
                    <p className="font-medium">{r.t_tarefa?.nome}</p>
                    {penalizado && <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" /> Penalidade</Badge>}
                    {cumprida && <Badge className="bg-success text-success-foreground"><Check className="mr-1 h-3 w-3" /> Cumprida</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.t_vigencia && fmtVigencia(r.t_vigencia)}</p>
                  {penalizado && <p className="mt-1 text-sm font-medium text-destructive">{r.t_vigencia?.penalidade}</p>}
                </div>

                <div className="flex flex-col gap-3 md:items-end">
                  <div className="flex flex-wrap items-center gap-1.5" aria-label={`${r.qtd_nao_fez} de ${limite} ocorrências`}>
                    {Array.from({ length: limite }).map((_, i) => (
                      <Checkbox
                        key={i}
                        checked={i < r.qtd_nao_fez}
                        disabled
                        className="h-5 w-5 data-[state=checked]:border-destructive data-[state=checked]:bg-destructive disabled:opacity-100"
                      />
                    ))}
                    <span className="ml-2 text-sm tabular-nums text-muted-foreground">{r.qtd_nao_fez}/{limite}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!penalizado && !cumprida && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => atualizar(r, { feito: "S" })}>
                          <Check className="h-4 w-4" /> Cumpriu
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => naoFez(r)}>
                          <ThumbsDown className="h-4 w-4" /> Não fez
                        </Button>
                      </>
                    )}
                    {(r.qtd_nao_fez > 0 || r.feito) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => desfazer(r, cumprida)}
                      >
                        <RotateCcw className="h-4 w-4" /> Desfazer
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
