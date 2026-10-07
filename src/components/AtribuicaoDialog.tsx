import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronsUpDown, Plus, X } from "lucide-react";
import { useActionLoading } from "@/components/ActionLoading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pick } from "@/components/Pick";
import { fmtVigencia, msgErro, useFilhos, useFilhoTarefas, useTarefas, useVigencias } from "@/lib/db";
import { cadastrarAtribuicoes, prepararAtribuicoes, type AtribuicaoItem, type PoliticaVigenciaAtribuicao } from "@/lib/atribuicoes";
import { compararVigencias, situacaoVigencia, VigenciaStatus } from "@/components/VigenciaStatus";

export type AtribuicaoDialogMode = "NORMAL" | "POS_CADASTRO_FILHO" | "POS_CADASTRO_TAREFA";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: AtribuicaoDialogMode;
  vigenciaInicialId?: number | null;
  filhoInicial?: { id: number; nome: string } | null;
  tarefasIniciais?: Array<{ id: number; nome: string }>;
  onSaved?: () => void;
};

function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex min-h-10 items-center rounded-md border bg-muted/30 px-3 text-sm font-medium">
        {value}
      </div>
    </div>
  );
}

export function AtribuicaoDialog({
  open,
  onOpenChange,
  mode = "NORMAL",
  vigenciaInicialId = null,
  filhoInicial = null,
  tarefasIniciais = [],
  onSaved,
}: Props) {
  const qc = useQueryClient();
  const { runAction } = useActionLoading();
  const { data: vigencias = [] } = useVigencias();
  const { data: filhos = [] } = useFilhos();
  const { data: tarefas = [] } = useTarefas();
  const { data: existentes = [] } = useFilhoTarefas();

  const [vig, setVig] = useState("");
  const [filho, setFilho] = useState("");
  const [filhosSelecionados, setFilhosSelecionados] = useState<number[]>([]);
  const [tarefasSelecionadas, setTarefasSelecionadas] = useState<number[]>([]);
  const [itens, setItens] = useState<AtribuicaoItem[]>([]);
  const [saving, setSaving] = useState(false);

  const vigenciasOrdenadas = useMemo(() => [...vigencias].sort(compararVigencias), [vigencias]);
  useEffect(() => {
    if (!open) return;
    setItens([]);
    setVig(vigenciaInicialId ? String(vigenciaInicialId) : "");
    setFilho(filhoInicial ? String(filhoInicial.id) : "");
    setFilhosSelecionados([]);
    setTarefasSelecionadas(mode === "POS_CADASTRO_TAREFA" ? tarefasIniciais.map((t) => t.id) : []);
  }, [open, mode, vigenciaInicialId, filhoInicial?.id, tarefasIniciais.map((t) => t.id).join(",")]);

  const vigenciaSelecionada = vigencias.find((v) => v.id === Number(vig));
  const vigenciaSelecionadaFinalizada = Boolean(vigenciaSelecionada && situacaoVigencia(vigenciaSelecionada) === "finalizada");
  const vigenciaSelecionadaFutura = Boolean(vigenciaSelecionada && situacaoVigencia(vigenciaSelecionada) === "futura");

  const statusVigencia = (v: (typeof vigencias)[number]) => ({
    value: String(v.id),
    label: fmtVigencia(v),
    status: situacaoVigencia(v),
  });

  const nomeF = (id: number) => filhoInicial?.id === id ? filhoInicial.nome : filhos.find((f) => f.id === id)?.nome ?? "";
  const nomeT = (id: number) => tarefasIniciais.find((t) => t.id === id)?.nome ?? tarefas.find((t) => t.id === id)?.nome ?? "";
  const nomeV = (id: number) => {
    const v = vigencias.find((x) => x.id === id);
    return v ? fmtVigencia(v) : "";
  };

  function alternarTarefa(id: number) {
    setTarefasSelecionadas((atuais) => atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id]);
  }

  function alternarFilho(id: number) {
    setFilhosSelecionados((atuais) => atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id]);
  }

  function adicionarNormal() {
    if (!vig || !filho || tarefasSelecionadas.length === 0) {
      toast.error("Selecione vigência, filho e ao menos uma tarefa");
      return;
    }

    const candidatos = tarefasSelecionadas.map((id_tarefa) => ({
      id_vigencia: Number(vig),
      id_filho: Number(filho),
      id_tarefa,
    }));

    const preparado = prepararAtribuicoes({
      candidatos: [...itens, ...candidatos],
      existentes,
      vigencias,
      politica: "ATUAL_OU_FUTURA",
    });

    if (!preparado.ok) {
      toast.error(preparado.mensagem);
      return;
    }

    const novos = preparado.itens.filter((item) =>
      !itens.some((existente) =>
        existente.id_vigencia === item.id_vigencia &&
        existente.id_filho === item.id_filho &&
        existente.id_tarefa === item.id_tarefa
      )
    );

    if (novos.length === 0) {
      toast.error("As atribuições selecionadas já existem");
      return;
    }

    if (novos.length < candidatos.length) {
      toast.info("As atribuições repetidas não foram adicionadas");
    }

    setItens((atuais) => [...atuais, ...novos]);
    setTarefasSelecionadas([]);
  }

  async function salvarItens(
    itensParaSalvar: AtribuicaoItem[],
    politica: PoliticaVigenciaAtribuicao,
  ) {
    setSaving(true);
    const resultado = await cadastrarAtribuicoes({
      candidatos: itensParaSalvar,
      existentes,
      vigencias,
      politica,
    });
    setSaving(false);

    if (!resultado.ok) {
      toast.error("erroBanco" in resultado ? msgErro(resultado.erroBanco) : resultado.mensagem);
      return false;
    }

    if (resultado.repetidas > 0) {
      toast.info("As atribuições repetidas não foram cadastradas");
    }

    toast.success(`${resultado.quantidade} atribuição(ões) cadastrada(s)`);
    setItens([]);
    setFilhosSelecionados([]);
    setTarefasSelecionadas([]);
    await qc.invalidateQueries({ queryKey: ["filho_tarefas"] });
    onOpenChange(false);
    onSaved?.();
    return true;
  }

  async function cadastrarContextual() {
    if (!vigenciaInicialId) {
      toast.error("Vigência atual não encontrada");
      return;
    }

    if (mode === "POS_CADASTRO_FILHO") {
      if (!filhoInicial || tarefasSelecionadas.length === 0) {
        toast.error("Selecione ao menos uma tarefa");
        return;
      }
      const candidatos = tarefasSelecionadas.map((id_tarefa) => ({
        id_vigencia: vigenciaInicialId,
        id_filho: filhoInicial.id,
        id_tarefa,
      }));
      await salvarItens(candidatos, "SOMENTE_ATUAL");
      return;
    }

    if (filhosSelecionados.length === 0 || tarefasIniciais.length === 0) {
      toast.error("Selecione ao menos um filho");
      return;
    }
    const candidatos = filhosSelecionados.flatMap((id_filho) =>
      tarefasIniciais.map((tarefa) => ({
        id_vigencia: vigenciaInicialId,
        id_filho,
        id_tarefa: tarefa.id,
      }))
    );
    await salvarItens(candidatos, "SOMENTE_ATUAL");
  }

  const titulo = mode === "NORMAL"
    ? "Adicionar atribuição"
    : mode === "POS_CADASTRO_FILHO"
      ? "Atribuir tarefas ao filho"
      : tarefasIniciais.length > 1
        ? "Atribuir tarefas aos filhos"
        : "Atribuir tarefa aos filhos";

  const vigenciaAtualTexto = vigenciaSelecionada ? fmtVigencia(vigenciaSelecionada) : "Vigência atual";

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>{titulo}</DialogTitle></DialogHeader>

        <Card className="border-0 shadow-none">
          {mode === "NORMAL" && <CardHeader><CardTitle>Nova atribuição</CardTitle></CardHeader>}
          <CardContent className="space-y-6">
            {mode === "NORMAL" ? (
              <>
                <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                  <Pick required label="Vigência" value={vig} onChange={setVig} options={vigenciasOrdenadas.map(statusVigencia)} />
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
                  <Button variant="secondary" onClick={adicionarNormal} disabled={!vig || vigenciaSelecionadaFinalizada}>
                    <Plus className="h-4 w-4" /> Adicionar
                  </Button>
                </div>

                {vigenciaSelecionadaFinalizada && <p className="text-xs text-destructive">Não é possível fazer atribuições para uma vigência finalizada.</p>}
                {vigenciaSelecionadaFutura && <p className="text-xs text-muted-foreground">Esta vigência ainda vai começar. Você pode preparar e ajustar as atribuições normalmente.</p>}

                {itens.length > 0 && (
                  <div className="rounded-xl border">
                    <Table>
                      <TableHeader><TableRow><TableHead>Filho</TableHead><TableHead>Tarefa</TableHead><TableHead>Vigência</TableHead><TableHead /></TableRow></TableHeader>
                      <TableBody>
                        {itens.map((it, i) => (
                          <TableRow key={`${it.id_vigencia}-${it.id_filho}-${it.id_tarefa}`}>
                            <TableCell className="font-medium">{nomeF(it.id_filho)}</TableCell>
                            <TableCell>{nomeT(it.id_tarefa)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span>{nomeV(it.id_vigencia)}</span>
                                {vigencias.find((v) => v.id === it.id_vigencia) && <VigenciaStatus vigencia={vigencias.find((v) => v.id === it.id_vigencia)!} />}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => setItens((atuais) => atuais.filter((_, j) => j !== i))} aria-label="Remover">
                                <X className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <Button onClick={() => void runAction(() => salvarItens(itens, "ATUAL_OU_FUTURA"))} disabled={saving || itens.length === 0}>
                  Cadastrar {itens.length > 0 && `(${itens.length})`}
                </Button>
              </>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <LockedField label="Vigência atual" value={vigenciaAtualTexto} />

                  {mode === "POS_CADASTRO_FILHO" ? (
                    <>
                      <LockedField label="Filho" value={filhoInicial?.nome ?? "Filho cadastrado"} />
                      <div className="space-y-2">
                        <Label>Tarefas <span className="text-destructive">*</span></Label>
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
                    </>
                  ) : (
                    <>
                      <LockedField
                        label={tarefasIniciais.length > 1 ? "Tarefas cadastradas" : "Tarefa"}
                        value={tarefasIniciais.map((t) => t.nome).join(", ")}
                      />
                      <div className="space-y-2">
                        <Label>Filhos <span className="text-destructive">*</span></Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" className="w-full justify-between font-normal">
                              <span className="truncate">{filhosSelecionados.length === 0 ? "Selecione" : `${filhosSelecionados.length} filho(s) selecionado(s)`}</span>
                              <ChevronsUpDown className="h-4 w-4 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]" onCloseAutoFocus={(e) => e.preventDefault()}>
                            <DropdownMenuCheckboxItem
                              checked={filhos.length > 0 && filhosSelecionados.length === filhos.length}
                              onSelect={(e) => e.preventDefault()}
                              onCheckedChange={(checked) => setFilhosSelecionados(checked ? filhos.map((f) => f.id) : [])}
                            >
                              Selecionar todos
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuSeparator />
                            {filhos.map((f) => (
                              <DropdownMenuCheckboxItem key={f.id} checked={filhosSelecionados.includes(f.id)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => alternarFilho(f.id)}>
                                {f.nome}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Este atalho usa somente a vigência em andamento. Para preparar atribuições de uma vigência futura, use a página Atribuições.
                </p>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
                  <Button type="button" onClick={() => void runAction(cadastrarContextual)} disabled={saving}>
                    Cadastrar atribuição
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
