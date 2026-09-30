import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ListTodo, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { useTarefas } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/tarefas")({
  head: () => ({ meta: [{ title: "Tarefas — Combinado" }] }),
  component: TarefasPage,
});

function TarefasPage() {
  const qc = useQueryClient();
  const { data: tarefas = [] } = useTarefas();
  const [nome, setNome] = useState("");

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const n = nome.trim();
    if (n.length < 2 || n.length > 150) return toast.error("Informe um nome entre 2 e 150 caracteres");
    const { error } = await supabase.from("t_tarefa").insert({ nome: n });
    if (error) return toast.error(error.message);
    toast.success("Tarefa cadastrada");
    setNome("");
    qc.invalidateQueries({ queryKey: ["tarefas"] });
  }

  async function excluir(id: number) {
    const { error } = await supabase.from("t_tarefa").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries();
  }

  return (
    <>
      <PageHeader title="Tarefas" description="Crie as tarefas que poderão ser atribuídas aos filhos." icon={<ListTodo className="h-6 w-6" />} />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>Cadastrar tarefa</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={salvar} className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input placeholder="Ex.: Arrumar a cama" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
              <Button type="submit" className="w-full">Cadastrar</Button>
            </form>
          </CardContent>
        </Card>
        <div className="grid gap-3 sm:grid-cols-2">
          {tarefas.length === 0 && <div className="sm:col-span-2"><EmptyState>Nenhuma tarefa cadastrada ainda.</EmptyState></div>}
          {tarefas.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
              <p className="flex-1 font-medium">{t.nome}</p>
              <Button variant="ghost" size="icon" onClick={() => excluir(t.id)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
