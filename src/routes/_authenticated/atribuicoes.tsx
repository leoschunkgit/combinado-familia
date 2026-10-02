import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Link2, Pencil, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { BlockedAction } from "@/components/BlockedAction";
import { Pick } from "@/components/Pick";
import { fmtVigencia, msgErro, useFilhos, useFilhoTarefas, useOcorrencias, useTarefas, useVigencias, type FilhoTarefa } from "@/lib/db";
import { erroLimiteMesada } from "@/lib/limite-mesada";

export const Route = createFileRoute("/_authenticated/atribuicoes")({
  head: () => ({ meta: [
    { title: "Atribuições — Combinado" },
    { name: "description", content: "Associe tarefas aos filhos dentro de cada vigência." },
    { property: "og:title", content: "Atribuições — Combinado" },
    { property: "og:description", content: "Associe tarefas aos filhos dentro de cada vigência." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AtribuicoesPage,
});

type Item = { id_vigencia: number; id_filho: number; id_tarefa: number };

function AtribuicoesPage() {
  const qc = useQueryClient();
  const { data: vigencias = [] } = useVigencias();
  const { data: filhos = [] } = useFilhos();
  const { data: tarefas = [] } = useTarefas();
  const { data: existentes = [] } = useFilhoTarefas();
  const { data: ocorrencias = [] } = useOcorrencias();
  const [vig, setVig] = useState("");
  const [filho, setFilho] = useState("");
  const [tarefasSelecionadas, setTarefasSelecionadas] = useState<number[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);
  const [editando, setEditando] = useState<FilhoTarefa | null>(null);
  const [edicao, setEdicao] = useState({ vig: "", filho: "", tarefa: "" });
  const [confirmarExclusao, setConfirmarExclusao] = useState<number | null>(null);
  const [filtroVig, setFiltroVig] = useState("all");
  const [filtroFilho, setFiltroFilho] = useState("all");
  const [filtroTarefa, setFiltroTarefa] = useState("all");

  const nomeF = (id: number) => filhos.find((f) => f.id === id)?.nome ?? "";
  const nomeT = (id: number) => tarefas.find((t) => t.id === id)?.nome ?? "";
  const nomeV = (id: number) => {
    const v = vigencias.find((x) => x.id === id);
    return v ? fmtVigencia(v) : "";
  };

  function adicionar() {
    if (!vig || !filho || tarefasSelecionadas.length === 0) { toast.error("Selecione vigência, filho e ao menos uma tarefa"); return; }
    const escolhido = filhos.find((f) => f.id === Number(filho));
    const periodo = vigencias.find((v) => v.id === Number(vig));
    if (escolhido && periodo) {
      const erro = erroLimiteMesada(escolhido, periodo);
      if (erro) { toast.error(erro); return; }
    }
    const novos = tarefasSelecionadas
      .map((id_tarefa) => ({ id_vigencia: +vig, id_filho: +filho, id_tarefa }))
      .filter((it) => {
        const igual = (a: Item) => a.id_vigencia === it.id_vigencia && a.id_filho === it.id_filho && a.id_tarefa === it.id_tarefa;
        return !itens.some(igual) && !existentes.some(igual);
      });
    if (novos.length === 0) { toast.error("As atribuições selecionadas já existem"); return; }
    if (novos.length < tarefasSelecionadas.length) toast.info("As atribuições repetidas não foram adicionadas");
    setItens([...itens, ...novos]);
    setTarefasSelecionadas([]);
  }

  async function cadastrar() {
    if (itens.length === 0) { toast.error("Adicione ao menos uma atribuição"); return; }
    for (const item of itens) {
      const escolhido = filhos.find((f) => f.id === item.id_filho);
      const periodo = vigencias.find((v) => v.id === item.id_vigencia);
      if (escolhido && periodo) {
        const erro = erroLimiteMesada(escolhido, periodo);
        if (erro) { toast.error(erro); return; }
      }
    }
    setSaving(true);
    const { error } = await supabase.from("t_filho_tarefa").insert(itens);
    setSaving(false);
    if (error) { toast.error(msgErro(error)); return; }
    toast.success(`${itens.length} atribuição(ões) cadastrada(s)`);
    setItens([]);
    qc.invalidateQueries({ queryKey: ["filho_tarefas"] });
  }

  async function excluir(id: number) {
    const alvo = existentes.find((item) => item.id === id);
    if (!alvo) return;
    const { data: atribuicoes, error: buscaErro } = await supabase.from("t_filho_tarefa").select("id").eq("id_filho", alvo.id_filho).eq("id_vigencia", alvo.id_vigencia);
    if (buscaErro) { toast.error(msgErro(buscaErro)); return; }
    const { count, error: historicoErro } = await supabase.from("t_ocorrencia").select("id", { count: "exact", head: true }).in("id_filho_tarefa", (atribuicoes ?? []).map((item) => item.id));
    if (historicoErro) { toast.error(msgErro(historicoErro)); return; }
    if (count) { toast.error("Este filho já tem registros de ‘Não fez’ nesta vigência. Não é possível excluir a atribuição."); return; }
    const { error } = await supabase.from("t_filho_tarefa").delete().eq("id", id);
    if (error) { toast.error(msgErro(error)); return; }
    qc.invalidateQueries({ queryKey: ["filho_tarefas"] });
  }

  function alternarTarefa(id: number) {
    setTarefasSelecionadas((atuais) => atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id]);
  }

  function abrirEdicao(item: FilhoTarefa) {
    setEditando(item);
    setEdicao({ vig: String(item.id_vigencia), filho: String(item.id_filho), tarefa: String(item.id_tarefa) });
  }

  async function salvarEdicao() {
    if (!editando || !edicao.vig || !edicao.filho || !edicao.tarefa) return;
    const { data: atribuicoes, error: buscaErro } = await supabase.from("t_filho_tarefa").select("id").eq("id_filho", editando.id_filho).eq("id_vigencia", editando.id_vigencia);
    if (buscaErro) { toast.error(msgErro(buscaErro)); return; }
    const { count, error: historicoErro } = await supabase.from("t_ocorrencia").select("id", { count: "exact", head: true }).in("id_filho_tarefa", (atribuicoes ?? []).map((item) => item.id));
    if (historicoErro) { toast.error(msgErro(historicoErro)); return; }
    if (count) { toast.error("Este filho já tem registros de ‘Não fez’ nesta vigência. Não é possível editar a atribuição."); return; }
    const atualizada = { id_vigencia: +edicao.vig, id_filho: +edicao.filho, id_tarefa: +edicao.tarefa };
    const escolhido = filhos.find((f) => f.id === atualizada.id_filho);
    const periodo = vigencias.find((v) => v.id === atualizada.id_vigencia);
    if (escolhido && periodo) {
      const erro = erroLimiteMesada(escolhido, periodo);
      if (erro) { toast.error(erro); return; }
    }
    const duplicada = existentes.some((item) => item.id !== editando.id && item.id_vigencia === atualizada.id_vigencia && item.id_filho === atualizada.id_filho && item.id_tarefa === atualizada.id_tarefa);
    if (duplicada) { toast.error("Essa atribuição já existe"); return; }
    setSaving(true);
    const { error } = await supabase.from("t_filho_tarefa").update(atualizada).eq("id", editando.id);
    setSaving(false);
    if (error) { toast.error(msgErro(error)); return; }
    toast.success("Atribuição atualizada");
    setEditando(null);
    qc.invalidateQueries({ queryKey: ["filho_tarefas"] });
    qc.invalidateQueries({ queryKey: ["ocorrencias"] });
  }

  const faltando = vigencias.length === 0 || filhos.length === 0 || tarefas.length === 0;
  const temHistorico = (item: FilhoTarefa) => existentes.some((outra) => outra.id_filho === item.id_filho && outra.id_vigencia === item.id_vigencia && ocorrencias.some((o) => o.id_filho_tarefa === outra.id));
  const filtradas = existentes.filter((item) =>
    (filtroVig === "all" || item.id_vigencia === Number(filtroVig)) &&
    (filtroFilho === "all" || item.id_filho === Number(filtroFilho)) &&
    (filtroTarefa === "all" || item.id_tarefa === Number(filtroTarefa))
  );

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
            <Pick required label="Vigência" value={vig} onChange={setVig} options={vigencias.map((v) => ({ value: String(v.id), label: fmtVigencia(v) }))} />
            <Pick required label="Filho" value={filho} onChange={setFilho} options={filhos.map((f) => ({ value: String(f.id), label: f.nome }))} />
            <div className="space-y-2">
              <span className="text-sm font-medium">Tarefas <span className="text-destructive" aria-hidden="true">*</span></span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between font-normal">
                    <span className="truncate">{tarefasSelecionadas.length === 0 ? "Selecione" : `${tarefasSelecionadas.length} tarefa(s) selecionada(s)`}</span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]" onCloseAutoFocus={(e) => e.preventDefault()}>
                  <DropdownMenuCheckboxItem
                    checked={tarefas.length > 0 && tarefasSelecionadas.length === tarefas.length}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(checked) => setTarefasSelecionadas(checked ? tarefas.map((t) => t.id) : [])}
                  >
                    Selecionar todas
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {tarefas.map((t) => (
                    <DropdownMenuCheckboxItem key={t.id} checked={tarefasSelecionadas.includes(t.id)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => alternarTarefa(t.id)}>
                      {t.nome}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
      {existentes.length > 0 && <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Pick label="Filtrar por vigência" value={filtroVig} onChange={setFiltroVig} allLabel="Todas as vigências" options={vigencias.map((v) => ({ value: String(v.id), label: fmtVigencia(v) }))} />
        <Pick label="Filtrar por filho" value={filtroFilho} onChange={setFiltroFilho} allLabel="Todos os filhos" options={filhos.map((f) => ({ value: String(f.id), label: f.nome }))} />
        <Pick label="Filtrar por tarefa" value={filtroTarefa} onChange={setFiltroTarefa} allLabel="Todas as tarefas" options={tarefas.map((t) => ({ value: String(t.id), label: t.nome }))} />
      </div>}
      {existentes.length === 0 ? (
        <EmptyState>Nenhuma atribuição ainda.</EmptyState>
      ) : filtradas.length === 0 ? (
        <EmptyState>Nenhuma atribuição encontrada para estes filtros.</EmptyState>
      ) : (
        <div className="rounded-2xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Filho</TableHead><TableHead>Tarefa</TableHead><TableHead>Vigência</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {filtradas.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.t_filho?.nome}</TableCell>
                  <TableCell>{e.t_tarefa?.nome}</TableCell>
                  <TableCell>{e.t_vigencia && fmtVigencia(e.t_vigencia)}</TableCell>
                    <TableCell className="space-x-1 text-right">
                       <BlockedAction reason={temHistorico(e) ? "Este filho já tem um registro de Não fez nesta vigência; a atribuição não pode ser editada." : undefined}>
                         <Button variant="ghost" size="icon" disabled={temHistorico(e)} onClick={() => abrirEdicao(e)} aria-label="Editar atribuição"><Pencil className="h-4 w-4" /></Button>
                       </BlockedAction>
                       <BlockedAction reason={temHistorico(e) ? "Este filho já tem um registro de Não fez nesta vigência; a atribuição não pode ser excluída." : undefined}>
                         <Button variant="ghost" size="icon" disabled={temHistorico(e)} onClick={() => setConfirmarExclusao(e.id)} aria-label="Excluir atribuição"><Trash2 className="h-4 w-4" /></Button>
                       </BlockedAction>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={confirmarExclusao !== null} onOpenChange={(open) => !open && setConfirmarExclusao(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader>
          <p>Tem certeza que deseja excluir esta atribuição?</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmarExclusao(null)}>Cancelar</Button>
            <Button type="button" variant="destructive" onClick={() => { if (confirmarExclusao !== null) void excluir(confirmarExclusao); setConfirmarExclusao(null); }}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(editando)} onOpenChange={(open) => !open && setEditando(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar atribuição</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Pick required label="Vigência" value={edicao.vig} onChange={(v) => setEdicao({ ...edicao, vig: v })} options={vigencias.map((v) => ({ value: String(v.id), label: fmtVigencia(v) }))} />
            <Pick required label="Filho" value={edicao.filho} onChange={(v) => setEdicao({ ...edicao, filho: v })} options={filhos.map((f) => ({ value: String(f.id), label: f.nome }))} />
            <Pick required label="Tarefa" value={edicao.tarefa} onChange={(v) => setEdicao({ ...edicao, tarefa: v })} options={tarefas.map((t) => ({ value: String(t.id), label: t.nome }))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button type="button" disabled={saving} onClick={salvarEdicao}><Check className="h-4 w-4" /> Salvar alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
