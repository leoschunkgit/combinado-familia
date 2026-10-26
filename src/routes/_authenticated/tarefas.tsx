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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { msgErro, useFilhos, useTarefas, useVigencias, type Tarefa } from "@/lib/db";
import { vigenciaEmAndamento } from "@/components/VigenciaStatus";
import { useActionLoading } from "@/components/ActionLoading";
import { Hint } from "@/components/Hint";
import { TarefaIcone } from "@/components/TarefaIcone";
import {
  normalizarNomeTarefa,
  TAREFA_SUGESTOES_CATEGORIAS,
} from "@/lib/tarefa-sugestoes";

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
  const [abaNovo, setAbaNovo] = useState<"cadastrar" | "sugestoes">("cadastrar");
  const [sugestoesSelecionadas, setSugestoesSelecionadas] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Tarefa | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [confirmarExclusao, setConfirmarExclusao] = useState<number | null>(null);
  const [confirmarExclusaoTodas, setConfirmarExclusaoTodas] = useState(false);
  const [tarefasPosCadastro, setTarefasPosCadastro] = useState<Array<{ id: number; nome: string }>>([]);
  const [perguntarAtribuicao, setPerguntarAtribuicao] = useState(false);
  const [atribuirAberto, setAtribuirAberto] = useState(false);

  async function cadastrarNomes(nomes: string[]) {
    const nomesUnicos = [
      ...new Map(
        nomes
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => [normalizarNomeTarefa(item), item]),
      ).values(),
    ];

    const { data: criadas, error } = await supabase
      .from("t_tarefa")
      .insert(nomesUnicos.map((tarefa) => ({ nome: tarefa })))
      .select("id, nome");

    if (error || !criadas) {
      toast.error(msgErro(error));
      return false;
    }

    toast.success(
      criadas.length === 1
        ? "Tarefa cadastrada"
        : `${criadas.length} tarefas cadastradas`,
    );
    setNome("");
    setLote("");
    setSugestoesSelecionadas([]);
    setAbaNovo("cadastrar");
    setNovoAberto(false);
    await qc.invalidateQueries({ queryKey: ["tarefas"] });

    if (filhos.length > 0 && vigenciaAtual && criadas.length > 0) {
      setTarefasPosCadastro(
        criadas.map((tarefa) => ({ id: tarefa.id, nome: tarefa.nome })),
      );
      setPerguntarAtribuicao(true);
    }

    return true;
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const n = nome.trim();
    if (n.length < 2 || n.length > 150) {
      toast.error("Informe um nome entre 2 e 150 caracteres");
      return;
    }

    await cadastrarNomes([n]);
  }

  async function salvarLote(e: FormEvent) {
    e.preventDefault();
    const nomes = [...new Set(lote.split("#").map((item) => item.trim()).filter(Boolean))];
    if (nomes.length === 0) {
      toast.error("Informe ao menos uma tarefa separada por #");
      return;
    }
    const invalida = nomes.find((item) => item.length < 2 || item.length > 150);
    if (invalida) {
      toast.error(`A tarefa "${invalida}" deve ter entre 2 e 150 caracteres`);
      return;
    }

    await cadastrarNomes(nomes);
  }

  async function salvarSugestoes() {
    const existentes = new Set(
      tarefas.map((tarefa) => normalizarNomeTarefa(tarefa.nome)),
    );
    const nomes = sugestoesSelecionadas.filter(
      (sugestao) => !existentes.has(normalizarNomeTarefa(sugestao)),
    );

    if (nomes.length === 0) {
      toast.error("Selecione ao menos uma sugestão que ainda não esteja cadastrada");
      return;
    }

    await cadastrarNomes(nomes);
  }

  function alternarSugestao(nomeSugestao: string) {
    setSugestoesSelecionadas((atuais) =>
      atuais.includes(nomeSugestao)
        ? atuais.filter((item) => item !== nomeSugestao)
        : [...atuais, nomeSugestao],
    );
  }

  async function salvarConformePreenchimento(e: FormEvent) {
    e.preventDefault();

    const temNome = nome.trim().length > 0;
    const temLote = lote.trim().length > 0;

    if (temNome && temLote) {
      toast.error("Preencha apenas uma forma de cadastro por vez");
      return;
    }

    if (temNome) {
      await salvar(e);
      return;
    }

    if (temLote) {
      await salvarLote(e);
      return;
    }

    toast.error("Informe uma tarefa ou várias tarefas separadas por #");
  }

  async function excluir(id: number) {
    const { error } = await supabase.rpc("remover_tarefa_com_regra", {
      p_id_tarefa: id,
    });
    if (error) {
      toast.error(msgErro(error));
      return;
    }
    await qc.invalidateQueries();
    toast.success("Tarefa excluída");
  }

  async function excluirTodas() {
    if (tarefas.length === 0) return;

    const { error } = await supabase.rpc("remover_todas_tarefas_com_regra");

    if (error) {
      toast.error(msgErro(error));
      return;
    }

    setConfirmarExclusaoTodas(false);
    await qc.invalidateQueries();
    toast.success("Todas as tarefas foram excluídas");
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
  const podeExcluirTodas = tarefas.length > 0;

  return (
    <>
      <PageHeader
        title="Tarefas"
        description="Cadastre e organize tarefas"
        icon={<ListTodo className="h-6 w-6" />}
        action={
          <div className="flex items-center gap-1.5">
            {podeExcluirTodas && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2 text-xs sm:px-2.5"
                onClick={() => setConfirmarExclusaoTodas(true)}
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir todas
              </Button>
            )}
            <Button
              size="sm"
              className="h-8 px-2 text-xs sm:px-2.5"
              onClick={() => {
                setAbaNovo("cadastrar");
                setSugestoesSelecionadas([]);
                setNovoAberto(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
        }
      />
      <div>
        <Card>
          <CardHeader className="pb-3">
            {tarefas.length > 0 && (
              <div className="relative w-full sm:ml-auto sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar tarefa..." className="pl-9" aria-label="Pesquisar tarefa" />
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {tarefas.length === 0 ? (
              <EmptyState>Nenhuma tarefa cadastrada ainda.</EmptyState>
            ) : tarefasFiltradas.length === 0 ? (
              <EmptyState>Nenhuma tarefa encontrada.</EmptyState>
            ) : (
              <div className="grid min-w-0 max-h-[65vh] gap-2 overflow-x-hidden overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                {tarefasFiltradas.map((t) => (
                  <div key={t.id} className="flex min-h-12 min-w-0 max-w-full items-center gap-2 rounded-xl border bg-card px-3 py-2">
                    <TarefaIcone nome={t.nome} className="text-primary" />
                    <Hint content={t.nome}>
                      <p className="min-w-0 flex-1 whitespace-normal break-words text-sm font-medium leading-snug">{t.nome}</p>
                    </Hint>
                    <div className="flex shrink-0 items-center gap-3 sm:gap-2">
                      <Hint content="Editar tarefa">
                        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 rounded-md" onClick={() => { setEditando(t); setNomeEdicao(t.nome); }} aria-label={`Editar ${t.nome}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </Hint>
                      <Hint content="Excluir tarefa">
                        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 rounded-md" onClick={() => setConfirmarExclusao(t.id)} aria-label={`Excluir ${t.nome}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </Hint>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={novoAberto}
        onOpenChange={(open) => {
          setNovoAberto(open);
          if (!open) {
            setAbaNovo("cadastrar");
            setSugestoesSelecionadas([]);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Adicionar tarefa</DialogTitle></DialogHeader>

          <Tabs
            value={abaNovo}
            onValueChange={(value) => setAbaNovo(value as "cadastrar" | "sugestoes")}
            className="min-w-0"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="cadastrar">Cadastrar</TabsTrigger>
              <TabsTrigger value="sugestoes">Sugestões</TabsTrigger>
            </TabsList>

            <TabsContent value="cadastrar" className="mt-5">
              <form onSubmit={(e) => { void runAction(() => salvarConformePreenchimento(e)); }} className="space-y-5">
                <div className="space-y-2">
                  <Label>Nome <span className="text-destructive" aria-hidden="true">*</span></Label>
                  <Input
                    placeholder="Ex.: Arrumar a cama"
                    value={nome}
                    onChange={(e) => {
                      setNome(e.target.value);
                      if (e.target.value) setLote("");
                    }}
                  />
                </div>

                <div className="border-t pt-5">
                  <div className="space-y-2">
                    <Label htmlFor="tarefas-lote">Cadastrar várias tarefas</Label>
                    <Textarea
                      id="tarefas-lote"
                      value={lote}
                      onChange={(e) => {
                        setLote(e.target.value);
                        if (e.target.value) setNome("");
                      }}
                      placeholder="Arrumar a cama # Lavar a louça # Arrumar o banheiro # Varrer a casa"
                      className="min-h-28 resize-y"
                    />
                    <p className="text-xs text-muted-foreground">Separe cada tarefa com #. Os espaços antes e depois serão removidos automaticamente.</p>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setNovoAberto(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Cadastrar</Button>
                </DialogFooter>
              </form>
            </TabsContent>

            <TabsContent value="sugestoes" className="mt-5 space-y-5">
              <div>
                <p className="text-sm font-medium">Escolha tarefas para adicionar</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Você pode selecionar várias sugestões de uma vez. Tarefas já cadastradas ficam indisponíveis.
                </p>
              </div>

              <div className="max-h-[52vh] space-y-5 overflow-y-auto pr-1">
                {TAREFA_SUGESTOES_CATEGORIAS.map((grupo, grupoIndex) => (
                  <section key={grupo.categoria} className="space-y-2">
                    <h3 className="text-sm font-semibold">{grupo.categoria}</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {grupo.sugestoes.map((sugestao, sugestaoIndex) => {
                        const jaCadastrada = tarefas.some(
                          (tarefa) =>
                            normalizarNomeTarefa(tarefa.nome) ===
                            normalizarNomeTarefa(sugestao),
                        );
                        const selecionada = sugestoesSelecionadas.includes(sugestao);
                        const id = `sugestao-tarefa-${grupoIndex}-${sugestaoIndex}`;

                        return (
                          <label
                            key={sugestao}
                            htmlFor={id}
                            className={`flex min-w-0 items-start gap-2.5 rounded-xl border p-3 text-sm transition-colors ${
                              jaCadastrada
                                ? "cursor-not-allowed bg-muted/35 text-muted-foreground"
                                : selecionada
                                  ? "cursor-pointer border-primary/50 bg-primary/5"
                                  : "cursor-pointer hover:bg-muted/40"
                            }`}
                          >
                            <Checkbox
                              id={id}
                              checked={selecionada}
                              disabled={jaCadastrada}
                              onCheckedChange={() => alternarSugestao(sugestao)}
                              aria-label={`Selecionar ${sugestao}`}
                            />
                            <span className="flex min-w-0 flex-1 items-start gap-2">
                              <TarefaIcone nome={sugestao} className="mt-0.5 text-primary" />
                              <span className="min-w-0 flex-1">
                                <span className="block whitespace-normal break-words font-medium leading-snug">
                                  {sugestao}
                                </span>
                                {jaCadastrada && (
                                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                    Já cadastrada
                                  </span>
                                )}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setNovoAberto(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={sugestoesSelecionadas.length === 0}
                  onClick={() => void runAction(salvarSugestoes)}
                >
                  Adicionar selecionadas
                  {sugestoesSelecionadas.length > 0 && ` (${sugestoesSelecionadas.length})`}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
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

      <Dialog open={confirmarExclusaoTodas} onOpenChange={setConfirmarExclusaoTodas}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir todas as tarefas?</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p>Tem certeza que deseja excluir todas as tarefas cadastradas?</p>
            <p className="text-sm text-muted-foreground">
              As tarefas deixarão de aparecer e não poderão ser usadas em novas atribuições. Registros históricos existentes serão preservados.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmarExclusaoTodas(false)}>Cancelar</Button>
            <Button type="button" variant="destructive" onClick={() => void runAction(excluirTodas)}>
              <Trash2 className="h-4 w-4" /> Excluir todas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmarExclusao !== null} onOpenChange={(open) => !open && setConfirmarExclusao(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar exclusão</DialogTitle></DialogHeader>
          <div className="min-w-0 space-y-2">
            {(() => {
              const tarefa = tarefas.find((t) => t.id === confirmarExclusao);
              return tarefa ? (
                <div className="flex min-w-0 items-start gap-2">
                  <TarefaIcone nome={tarefa.nome} className="mt-0.5" />
                  <p className="min-w-0 break-words">Tem certeza que deseja excluir <strong className="break-words">{tarefa.nome}</strong>?</p>
                </div>
              ) : null;
            })()}
            <p className="text-sm text-muted-foreground">A tarefa deixará de aparecer e não poderá ser usada em novas atribuições. Se já existir histórico, ele será preservado.</p>
          </div>
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
