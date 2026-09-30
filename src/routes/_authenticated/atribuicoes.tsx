import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { Pick } from "@/components/Pick";
import { fmtVigencia, useFilhos, useFilhoTarefas, useTarefas, useVigencias } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/atribuicoes")({
  head: () => ({ meta: [{ title: "Atribuições — Combinado" }] }),
  component: AtribuicoesPage,
});

type Item = { id_vigencia: number; id_filho: number; id_tarefa: number };

function AtribuicoesPage() {
  const qc = useQueryClient();
  const { data: vigencias = [] } = useVigencias();
  const { data: filhos = [] } = useFilhos();
  const { data: tarefas = [] } = useTarefas();
  const { data: existentes = [] } = useFilhoTarefas();
  const [vig, setVig] = useState("");
  const [filho, setFilho] = useState("");
  const [tarefa, setTarefa] = useState("");
  const [itens, setItens] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);

  const nomeF = (id: number) => filhos.find((f) => f.id === id)?.nome ?? "";
  const nomeT = (id: number) => tarefas.find((t) => t.id === id)?.nome ?? "";
  const nomeV = (id: number) => {
    const v = vigencias.find((x) => x.id === id);
    return v ? fmtVigencia(v) : "";
  };

  function adicionar() {
    if (!vig || !filho || !tarefa) { toast.error("Selecione vigência, filho e tarefa"); return; }
    const it = { id_vigencia: +vig, id_filho: +filho, id_tarefa: +tarefa };
    const dup = (a: Item) => a.id_vigencia === it.id_vigencia && a.id_filho === it.id_filho && a.id_tarefa === it.id_tarefa;
    if (itens.some(dup) || existentes.some(dup)) { toast.error("Essa atribuição já existe"); return; }
    setItens([...itens, it]);
    setTarefa("");
  }

  async function cadastrar() {
    if (itens.length === 0) { toast.error("Adicione ao menos uma atribuição"); return; }
    setSaving(true);
    const { error } = await supabase.from("t_filho_tarefa").insert(itens);
    setSaving(false);
    if (error) { toast.error(msgErro(error)); return; }
    toast.success(`${itens.length} atribuição(ões) cadastrada(s)`);
    setItens([]);
    qc.invalidateQueries({ queryKey: ["filho_tarefas"] });
  }

  async function excluir(id: number) {
    const { error } = await supabase.from("t_filho_tarefa").delete().eq("id", id);
    if (error) { toast.error(msgErro(error)); return; }
    qc.invalidateQueries({ queryKey: ["filho_tarefas"] });
  }

  const faltando = vigencias.length === 0 || filhos.length === 0 || tarefas.length === 0;

  return (
    <>
      <PageHeader title="Filho na tarefa" description="Associe tarefas aos filhos dentro de uma vigência." icon={<Link2 className="h-6 w-6" />} />
      {faltando && (
        <div className="mb-6 rounded-2xl bg-accent/30 p-4 text-sm">
          Para atribuir, cadastre antes pelo menos uma vigência, um filho e uma tarefa.
        </div>
      )}
      <Card className="mb-8">
        <CardHeader><CardTitle>Nova atribuição</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
            <Pick label="Vigência" value={vig} onChange={setVig} options={vigencias.map((v) => ({ value: String(v.id), label: fmtVigencia(v) }))} />
            <Pick label="Filho" value={filho} onChange={setFilho} options={filhos.map((f) => ({ value: String(f.id), label: f.nome }))} />
            <Pick label="Tarefa" value={tarefa} onChange={setTarefa} options={tarefas.map((t) => ({ value: String(t.id), label: t.nome }))} />
            <Button variant="secondary" onClick={adicionar}><Plus className="h-4 w-4" /> Adicionar</Button>
          </div>
          {itens.length > 0 && (
            <div className="rounded-xl border">
              <Table>
                <TableHeader><TableRow><TableHead>Filho</TableHead><TableHead>Tarefa</TableHead><TableHead>Vigência</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {itens.map((it, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{nomeF(it.id_filho)}</TableCell>
                      <TableCell>{nomeT(it.id_tarefa)}</TableCell>
                      <TableCell>{nomeV(it.id_vigencia)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setItens(itens.filter((_, j) => j !== i))} aria-label="Remover"><X className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <Button onClick={cadastrar} disabled={saving || itens.length === 0}>Cadastrar {itens.length > 0 && `(${itens.length})`}</Button>
        </CardContent>
      </Card>

      <h2 className="mb-3 text-xl font-bold">Atribuições cadastradas</h2>
      {existentes.length === 0 ? (
        <EmptyState>Nenhuma atribuição ainda.</EmptyState>
      ) : (
        <div className="rounded-2xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Filho</TableHead><TableHead>Tarefa</TableHead><TableHead>Vigência</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {existentes.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.t_filho?.nome}</TableCell>
                  <TableCell>{e.t_tarefa?.nome}</TableCell>
                  <TableCell>{e.t_vigencia && fmtVigencia(e.t_vigencia)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => excluir(e.id)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
