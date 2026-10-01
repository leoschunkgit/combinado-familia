import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarRange, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { fmtVigencia, msgErro, useFilhoTarefas, useOcorrencias, useVigencias, type Vigencia } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/vigencias")({
  head: () => ({ meta: [
    { title: "Vigências — Combinado" },
    { name: "description", content: "Defina os períodos e limites dos combinados da família." },
    { property: "og:title", content: "Vigências — Combinado" },
    { property: "og:description", content: "Defina os períodos e limites dos combinados da família." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: VigenciasPage,
});

const schema = z
  .object({
    data_inicio: z.string().min(1, "Informe a data de início"),
    data_fim: z.string().min(1, "Informe a data de fim"),
    penalidade: z.string().trim().min(2, "Informe a penalidade").max(200),
    qtd_ocorrencia: z.coerce.number().int().min(1, "Mínimo de 1 ocorrência").max(31, "Máximo de 31"),
  })
  .refine((v) => new Date(v.data_fim) > new Date(v.data_inicio), "A data fim deve ser após a data início");

function VigenciasPage() {
  const qc = useQueryClient();
  const { data: vigencias = [] } = useVigencias();
  const { data: atribuicoes = [] } = useFilhoTarefas();
  const { data: ocorrencias = [] } = useOcorrencias();
  const [form, setForm] = useState({ data_inicio: "", data_fim: "", penalidade: "", qtd_ocorrencia: "3" });
  const [editando, setEditando] = useState<Vigencia | null>(null);
  const [edicao, setEdicao] = useState(form);

  const paraCampo = (valor: string) => {
    const d = new Date(valor);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const dia = (valor: string) => paraCampo(valor).slice(0, 10);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const p = schema.safeParse(form);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Dados inválidos"); return; }
    const { error } = await supabase.from("t_vigencia").insert({
      ...p.data,
      data_inicio: new Date(p.data.data_inicio).toISOString(),
      data_fim: new Date(p.data.data_fim).toISOString(),
    });
    if (error) { toast.error(msgErro(error)); return; }
    toast.success("Vigência cadastrada");
    setForm({ data_inicio: "", data_fim: "", penalidade: "", qtd_ocorrencia: "3" });
    qc.invalidateQueries({ queryKey: ["vigencias"] });
  }

  async function excluir(id: number) {
    const { count, error: buscaErro } = await supabase.from("t_filho_tarefa").select("id", { count: "exact", head: true }).eq("id_vigencia", id);
    if (buscaErro) { toast.error(msgErro(buscaErro)); return; }
    if (count) { toast.error("Esta vigência tem atribuições e não pode ser excluída"); return; }
    const { error } = await supabase.from("t_vigencia").delete().eq("id", id);
    if (error) { toast.error(msgErro(error)); return; }
    qc.invalidateQueries();
  }

  function abrirEdicao(v: Vigencia) {
    setEditando(v);
    setEdicao({ data_inicio: paraCampo(v.data_inicio), data_fim: paraCampo(v.data_fim), penalidade: v.penalidade, qtd_ocorrencia: String(v.qtd_ocorrencia) });
  }

  async function salvarEdicao(e: FormEvent) {
    e.preventDefault();
    if (!editando) return;
    const p = schema.safeParse(edicao);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Dados inválidos"); return; }
    const { data: vinculadas, error: buscaErro } = await supabase.from("t_filho_tarefa").select("id, id_filho, qtd_nao_fez").eq("id_vigencia", editando.id);
    if (buscaErro) { toast.error(msgErro(buscaErro)); return; }
    const totais = new Map<number, number>();
    for (const item of vinculadas ?? []) totais.set(item.id_filho, (totais.get(item.id_filho) ?? 0) + item.qtd_nao_fez);
    const maiorTotal = Math.max(0, ...totais.values());
    if (p.data.qtd_ocorrencia < maiorTotal) {
      toast.error(`O limite não pode ser menor que os ${maiorTotal} registros de “Não fez” já acumulados por um filho nesta vigência`);
      return;
    }
    if (vinculadas?.length) {
      const { data: registros, error: registrosErro } = await supabase.from("t_ocorrencia").select("created_at").in("id_filho_tarefa", vinculadas.map((item) => item.id));
      if (registrosErro) { toast.error(msgErro(registrosErro)); return; }
      const inicio = p.data.data_inicio.slice(0, 10);
      const fim = p.data.data_fim.slice(0, 10);
      if (registros?.some((o) => dia(o.created_at) < inicio || dia(o.created_at) > fim)) {
        toast.error("Há datas de ‘Não fez’ fora do novo período. Corrija-as na aba Ocorrências antes de salvar a vigência.");
        return;
      }
    }
    const { error } = await supabase.from("t_vigencia").update({
      ...p.data,
      data_inicio: new Date(p.data.data_inicio).toISOString(),
      data_fim: new Date(p.data.data_fim).toISOString(),
    }).eq("id", editando.id);
    if (error) { toast.error(msgErro(error)); return; }
    toast.success("Vigência atualizada");
    setEditando(null);
    qc.invalidateQueries({ queryKey: ["vigencias"] });
    qc.invalidateQueries({ queryKey: ["filho_tarefas"] });
  }

  const agora = Date.now();
  const vinculadasNaEdicao = atribuicoes.filter((a) => a.id_vigencia === editando?.id);
  const idsNaEdicao = new Set(vinculadasNaEdicao.map((a) => a.id));
  const totaisNaEdicao = new Map<number, number>();
  for (const a of vinculadasNaEdicao) totaisNaEdicao.set(a.id_filho, (totaisNaEdicao.get(a.id_filho) ?? 0) + a.qtd_nao_fez);
  const minimoNaEdicao = Math.max(1, ...totaisNaEdicao.values());
  const foraDoPeriodo = editando ? ocorrencias.filter((o) => idsNaEdicao.has(o.id_filho_tarefa) &&
    (dia(o.created_at) < edicao.data_inicio.slice(0, 10) || dia(o.created_at) > edicao.data_fim.slice(0, 10))) : [];

  return (
    <>
      <PageHeader title="Vigências" description="Defina o período, a penalidade e quantas falhas são toleradas." icon={<CalendarRange className="h-6 w-6" />} />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>Cadastrar vigência</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={salvar} className="space-y-4">
              <div className="space-y-2"><Label>Data início</Label><Input type="datetime-local" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
              <div className="space-y-2"><Label>Data fim</Label><Input type="datetime-local" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
              <div className="space-y-2"><Label>Penalidade</Label><Input placeholder="Ex.: Sem videogame no fim de semana" value={form.penalidade} onChange={(e) => setForm({ ...form, penalidade: e.target.value })} /></div>
              <div className="space-y-2"><Label>Quantidade de ocorrências</Label><Input type="number" min={1} max={31} value={form.qtd_ocorrencia} onChange={(e) => setForm({ ...form, qtd_ocorrencia: e.target.value })} />
                <p className="text-xs text-muted-foreground">Número de "não fez" que aplica a penalidade.</p></div>
              <Button type="submit" className="w-full">Cadastrar</Button>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-3">
          {vigencias.length === 0 && <EmptyState>Nenhuma vigência cadastrada ainda.</EmptyState>}
          {vigencias.map((v) => {
            const ativa = new Date(v.data_inicio).getTime() <= agora && new Date(v.data_fim).getTime() >= agora;
            return (
              <div key={v.id} className="flex items-start gap-4 rounded-2xl border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{fmtVigencia(v)}</p>
                    {ativa && <Badge className="bg-success text-success-foreground">Em andamento</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Penalidade: {v.penalidade}</p>
                  <p className="text-sm text-muted-foreground">Limite: {v.qtd_ocorrencia} ocorrência(s)</p>
                </div>
                 <Button variant="ghost" size="icon" onClick={() => abrirEdicao(v)} aria-label={`Editar vigência ${fmtVigencia(v)}`}><Pencil className="h-4 w-4" /></Button>
                 <Button variant="ghost" size="icon" disabled={atribuicoes.some((a) => a.id_vigencia === v.id)} title={atribuicoes.some((a) => a.id_vigencia === v.id) ? "Vigência com atribuições não pode ser excluída" : "Excluir vigência"} onClick={() => excluir(v.id)} aria-label={`Excluir vigência ${fmtVigencia(v)}`}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
        </div>
      </div>
      <Dialog open={Boolean(editando)} onOpenChange={(open) => !open && setEditando(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar vigência</DialogTitle></DialogHeader>
          <form onSubmit={salvarEdicao} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="editar-inicio">Data início</Label><Input id="editar-inicio" type="datetime-local" value={edicao.data_inicio} onChange={(e) => setEdicao({ ...edicao, data_inicio: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="editar-fim">Data fim</Label><Input id="editar-fim" type="datetime-local" value={edicao.data_fim} onChange={(e) => setEdicao({ ...edicao, data_fim: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="editar-penalidade">Penalidade</Label><Input id="editar-penalidade" value={edicao.penalidade} onChange={(e) => setEdicao({ ...edicao, penalidade: e.target.value })} /></div>
             <div className="space-y-2"><Label htmlFor="editar-limite">Quantidade de ocorrências</Label><Input id="editar-limite" type="number" min={minimoNaEdicao} max={31} value={edicao.qtd_ocorrencia} onChange={(e) => setEdicao({ ...edicao, qtd_ocorrencia: e.target.value })} />
               {minimoNaEdicao > 1 && <p className="text-xs text-muted-foreground">Mínimo: {minimoNaEdicao}, já registrado por um filho nesta vigência.</p>}</div>
             {foraDoPeriodo.length > 0 && <p className="text-sm text-destructive">{foraDoPeriodo.length} data(s) de “Não fez” fora do novo período. <Link to="/ocorrencias" className="underline">Corrigir em Ocorrências</Link> antes de salvar.</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
              <Button type="submit">Salvar alterações</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
