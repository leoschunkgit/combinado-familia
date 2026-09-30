import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarRange, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { fmtVigencia, msgErro, useVigencias } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/vigencias")({
  head: () => ({ meta: [{ title: "Vigências — Combinado" }] }),
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
  const [form, setForm] = useState({ data_inicio: "", data_fim: "", penalidade: "", qtd_ocorrencia: "3" });

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
    const { error } = await supabase.from("t_vigencia").delete().eq("id", id);
    if (error) { toast.error(msgErro(error)); return; }
    qc.invalidateQueries();
  }

  const agora = Date.now();

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
                <Button variant="ghost" size="icon" onClick={() => excluir(v.id)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
