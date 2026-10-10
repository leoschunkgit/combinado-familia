import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ListTodo, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AtribuicaoDialog } from "@/components/AtribuicaoDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { msgErro, useFilhos, useTarefas, useVigencias, type Tarefa } from "@/lib/db";
import { vigenciaEmAndamento } from "@/components/VigenciaStatus";
import { useActionLoading } from "@/components/ActionLoading";

export const Route = createFileRoute("/_authenticated/tarefas")({
  head: () => ({ meta: [
    { title: "Tarefas — Combinado" },
    { name: "description", content: "Organize as tarefas dos combinados da família." },
    { property: "og:title", content: "Tarefas — Combinado" },
    { property: "og:description", content: "Organize as tarefas dos combinados da família." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: TarefasPage,
});

function TarefasPage() {
  const qc = useQueryClient();
  const { runAction } = useActionLoading();
  const { data: tarefas = [] } = useTarefas();
  const { data: filhos = [] } = useFilhos();
  const { data: vigencias = [] } = useVigencias();
  const vigenciaAtual = vigencias.find(vigenciaEmAndamento);
  const [nome, setNome] = useState("");
  const [lote, setLote] = useState("");
  const [novoAberto, setNovoAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Tarefa | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [confirmarExclusao, setConfirmarExclusao] = useState<number | null>(null);
  const [tarefasPosCadastro, setTarefasPosCadastro] = useState<Array<{ id: number; nome: string }>>([]);
  const [perguntarAtribuicao, setPerguntarAtribuicao] = useState(false);
  const [atribuirAberto, setAtribuirAberto] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const n = nome.trim();
    if (n.length < 2 || n.length > 150) { toast.error("Informe um nome entre 2 e 150 caracteres"); return; }
    const { data: criada, error } = await supabase
      .from("t_tarefa")
      .insert({ nome: n })
      .select("id, nome")
      .single();
    if (error || !criada) { toast.error(msgErro(error)); return; }

    toast.success("Tarefa cadastrada");
    setNome("");
    setNovoAberto(false);
    await qc.invalidateQueries({ queryKey: ["tarefas"] });

    if (filhos.length > 0 && vigenciaAtual) {
      setTarefasPosCadastro([{ id: criada.id, nome: criada.nome }]);
      setPerguntarAtribuicao(true);
    }
  }

  async function salvarLote(e: FormEvent) {
    e.preventDefault();
    const nomes = [...new Set(lote.split("#").map((item) => item.trim()).filter(Boolean))];
    if (nomes.length === 0) { toast.error("Informe ao menos uma tarefa separada por #"); return; }
    const invalida = nomes.find((item) => item.length < 2 || item.length > 150);
    if (invalida) { toast.error(`A tarefa "${invalida}" deve ter entre 2 e 150 caracteres`); return; }

    const { data: criadas, error } = await supabase
      .from("t_tarefa")
      .insert(nomes.map((tarefa) => ({ nome: tarefa })))
      .select("id, nome");
    if (error || !criadas) {
      toast.error(msgErro(error));
      return;
    }

    toast.success(`${nomes.length} tarefa(s) cadastrada(s)`);
    setLote("");
    setNovoAberto(false);
    await qc.invalidateQueries({ queryKey: ["tarefas"] });

    if (filhos.length > 0 && vigenciaAtual && criadas.length > 0) {
      setTarefasPosCadastro(criadas.map((tarefa) => ({ id: tarefa.id, nome: tarefa.nome })));
      setPerguntarAtribuicao(true);
    }
  }

  async function excluir(id: number) {
    const { error } = await supabase.from("t_tarefa").delete().eq("id", id);
    if (error) {
      toast.error(msgErro(error));
      return;
    }
    qc.invalidateQueries();
  }

  async function salvarEdicao(e: FormEvent) {
    e.preventDefault();
    if (!editando) return;
    const n = nomeEdicao.trim();
    if (n.length < 2 || n.length > 150) { toast.error("Informe um nome entre 2 e 150 caracteres"); return; }
    const { error } = await supabase.from("t_tarefa").update({ nome: n }).eq("id", editando.id);
    if (error) { toast.error(msgErro(error)); return; }
    toast.success("Tarefa atualizada");
    setEditando(null);
    qc.invalidateQueries({ queryKey: ["tarefas"] });
    qc.invalidateQueries({ queryKey: ["filho_tarefas"] });
  }

  const tarefasFiltradas = tarefas.filter((t) =>
    t.nome.toLocaleLowerCase().includes(busca.trim().toLocaleLowerCase())
  );

  return (
    <>
      <PageHeader
        title="Tarefas"
        description="Crie as tarefas que poderão ser atribuídas aos filhos."
        icon={<ListTodo className="h-6 w-6" />}
        action={<Button size="sm" onClick={() => setNovoAberto(true)}><Plus className="h-4 w-4" /> Adicionar</Button>}
      />
      <div>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <span>Tarefas cadastradas</span>
                  <span className="text-sm font-medium text-muted-foreground">{tarefas.length}</span>
                </CardTitle>
              </div>
              {tarefas.length > 0 && (
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar tarefa..." className="pl-9" aria-label="Pesquisar tarefa" />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {tarefas.length === 0 ? (
              <EmptyState>Nenhuma tarefa cadastrada ainda.</EmptyState>
            ) : tarefasFiltradas.length === 0 ? (
              <EmptyState>Nenhuma tarefa encontrada.</EmptyState>
            ) : (
              <div className="grid max-h-[65vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                {tarefasFiltradas.map((t) => (
                  <div key={t.id} className="flex min-h-12 items-center gap-2 rounded-xl border bg-card px-3 py-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                    <p className="min-w-0 flex-1 truncate text-sm font-medium" title={t.nome}>{t.nome}</p>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { setEditando(t); setNomeEdicao(t.nome); }} aria-label={`Editar ${t.nome}`}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setConfirmarExclusao(t.id)} aria-label={`Excluir ${t.nome}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={novoAberto} onOpenChange={setNovoAberto}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Adicionar tarefa</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <form onSubmit={(e) => { void runAction(() => salvar(e)); }} className="space-y-4">
              <div className="space-y-2"><Label>Nome <span className="text-destructive" aria-hidden="true">*</span></Label><Input placeholder="Ex.: Arrumar a cama" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
              <Button type="submit" className="w-full">Cadastrar</Button>
            </form>
            <div className="border-t pt-5">
              <form onSubmit={(e) => { void runAction(() => salvarLote(e)); }} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="tarefas-lote">Cadastrar várias tarefas</Label>
                  <Textarea
                    id="tarefas-lote"
                    value={lote}
                    onChange={(e) => setLote(e.target.value)}
                    placeholder="Arrumar a cama # Lavar a louça # Arrumar o banheiro # Varrer a casa"
                    className="min-h-28 resize-y"
                  />
                  <p className="text-xs text-muted-foreground">Separe cada tarefa com #. Os espaços antes e depois serão removidos automaticamente.</p>
                </div>
                <Button type="submit" variant="secondary" className="w-full">Cadastrar tarefas</Button>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={perguntarAtribuicao} onOpenChange={setPerguntarAtribuicao}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tarefasPosCadastro.length > 1 ? "Tarefas cadastradas com sucesso" : "Tarefa cadastrada com sucesso"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {tarefasPosCadastro.length > 1
              ? `Deseja atribuir estas ${tarefasPosCadastro.length} tarefas na vigência atual?`
              : "Deseja atribuir esta tarefa na vigência atual?"}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setPerguntarAtribuicao(false); setTarefasPosCadastro([]); }}>Agora não</Button>
            <Button type="button" onClick={() => { setPerguntarAtribuicao(false); setAtribuirAberto(true); }}>Sim, atribuir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AtribuicaoDialog
        open={atribuirAberto}
        onOpenChange={(open) => { setAtribuirAberto(open); if (!open) setTarefasPosCadastro([]); }}
        mode="POS_CADASTRO_TAREFA"
        vigenciaInicialId={vigenciaAtual?.id ?? null}
        tarefasIniciais={tarefasPosCadastro}
      />

      <Dialog open={confirmarExclusao !== null} onOpenChange={(open) => !open && setConfirmarExclusao(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader>
          <div className="space-y-2"><p>Tem certeza que deseja excluir <strong>{tarefas.find((t) => t.id === confirmarExclusao)?.nome}</strong>?</p><p className="text-sm text-muted-foreground">As atribuições e os registros de Fez/Não fez vinculados a esta tarefa também serão excluídos.</p></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmarExclusao(null)}>Cancelar</Button>
            <Button type="button" variant="destructive" onClick={() => { if (confirmarExclusao !== null) void runAction(() => excluir(confirmarExclusao)); setConfirmarExclusao(null); }}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editando)} onOpenChange={(open) => !open && setEditando(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar tarefa</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { void runAction(() => salvarEdicao(e)); }} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="editar-tarefa-nome">Nome <span className="text-destructive" aria-hidden="true">*</span></Label><Input id="editar-tarefa-nome" value={nomeEdicao} onChange={(e) => setNomeEdicao(e.target.value)} /></div>
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
