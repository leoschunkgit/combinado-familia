import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronsUpDown, Plus, X } from "lucide-react";
import { useActionLoading } from "@/components/ActionLoading";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/Hint";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pick } from "@/components/Pick";
import { fmtVigencia, msgErro, useFilhos, useFilhoTarefas, useTarefas, useVigencias } from "@/lib/db";
import { cadastrarAtribuicoes, prepararAtribuicoes, type AtribuicaoItem, type PoliticaVigenciaAtribuicao } from "@/lib/atribuicoes";
import { compararVigencias, situacaoVigencia, VigenciaStatus } from "@/components/VigenciaStatus";
import { FilhoAvatar } from "@/components/FilhoAvatar";
import { TarefaIcone } from "@/components/TarefaIcone";

export type AtribuicaoDialogMode = "NORMAL" | "POS_CADASTRO_FILHO" | "POS_CADASTRO_TAREFA" | "CONTEXTO_FILHO_VIGENCIA";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: AtribuicaoDialogMode;
  vigenciaInicialId?: number | null;
  filhoInicial?: { id: number; nome: string; cor?: string | null; avatar?: string | null } | null;
  tarefasIniciais?: Array<{ id: number; nome: string }>;
  onSaved?: () => void;
};

function FixedInfo({ label, values, taskIcons = false }: { label: string; values: string[]; taskIcons?: boolean }) {
  return (
    <div className="min-w-0 space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="space-y-0.5">
        {values.map((value, index) => (
          <div key={index} className="flex min-w-0 items-start gap-2">
            {taskIcons && <TarefaIcone nome={value} className="mt-0.5" />}
            <p className="min-w-0 break-words text-xs font-medium leading-5 text-foreground">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FixedCurrentValidity({ value }: { value: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">Vigência</Label>
      <div className="flex min-h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full bg-green-300" aria-hidden="true" />
          <span className="min-w-0 truncate">{value}</span>
        </span>
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
  const vigenciaAtiva = useMemo(
    () => vigenciasOrdenadas.find((v) => situacaoVigencia(v) === "andamento") ?? null,
    [vigenciasOrdenadas],
  );

  useEffect(() => {
    if (!open) return;
    setItens([]);
    setVig(
      vigenciaInicialId
        ? String(vigenciaInicialId)
        : mode === "NORMAL" && vigenciaAtiva
          ? String(vigenciaAtiva.id)
          : "",
    );
    setFilho(filhoInicial ? String(filhoInicial.id) : "");
    setFilhosSelecionados([]);
    setTarefasSelecionadas(mode === "POS_CADASTRO_TAREFA" ? tarefasIniciais.map((t) => t.id) : []);
  }, [open, mode, vigenciaInicialId, vigenciaAtiva?.id, filhoInicial?.id, tarefasIniciais.map((t) => t.id).join(",")]);

  useEffect(() => {
    if (
      !open ||
      mode !== "NORMAL" ||
      vigenciaInicialId ||
      vig ||
      !vigenciaAtiva
    ) {
      return;
    }
    setVig(String(vigenciaAtiva.id));
  }, [open, mode, vigenciaInicialId, vig, vigenciaAtiva?.id]);

  const vigenciaSelecionada = vigencias.find((v) => v.id === Number(vig));
  const vigenciaSelecionadaFinalizada = Boolean(vigenciaSelecionada && situacaoVigencia(vigenciaSelecionada) === "finalizada");
  const vigenciaSelecionadaFutura = Boolean(vigenciaSelecionada && situacaoVigencia(vigenciaSelecionada) === "futura");
  const semVigencias = vigencias.length === 0;
  const semFilhos = filhos.length === 0;
  const semTarefas = tarefas.length === 0;
  const faltamCadastrosNormal = semVigencias || semFilhos || semTarefas;
  const tarefasParaSelecionar = mode === "CONTEXTO_FILHO_VIGENCIA" && vigenciaInicialId && filhoInicial
    ? tarefas.filter((tarefa) =>
        !existentes.some((item) =>
          item.id_vigencia === vigenciaInicialId
          && item.id_filho === filhoInicial.id
          && item.id_tarefa === tarefa.id
        )
      )
    : tarefas;
  const semTarefasSelecionaveis = tarefasParaSelecionar.length === 0;

  const statusVigencia = (v: (typeof vigencias)[number]) => ({
    value: String(v.id),
    label: fmtVigencia(v),
    status: situacaoVigencia(v),
  });

  const filhoPorId = (id: number) => filhos.find((f) => f.id === id);
  const nomeF = (id: number) => filhoInicial?.id === id ? filhoInicial.nome : filhoPorId(id)?.nome ?? "";
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

    if (mode === "POS_CADASTRO_FILHO" || mode === "CONTEXTO_FILHO_VIGENCIA") {
      if (!filhoInicial || tarefasSelecionadas.length === 0) {
        toast.error("Selecione ao menos uma tarefa");
        return;
      }
      const candidatos = tarefasSelecionadas.map((id_tarefa) => ({
        id_vigencia: vigenciaInicialId,
        id_filho: filhoInicial.id,
        id_tarefa,
      }));
      await salvarItens(
        candidatos,
        mode === "CONTEXTO_FILHO_VIGENCIA" ? "ATUAL_OU_FUTURA" : "SOMENTE_ATUAL",
      );
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
    : mode === "CONTEXTO_FILHO_VIGENCIA"
      ? "Adicionar tarefa"
      : mode === "POS_CADASTRO_FILHO"
        ? "Atribuir tarefas ao filho"
        : tarefasIniciais.length > 1
          ? "Atribuir tarefas aos filhos"
          : "Atribuir tarefa aos filhos";

  const vigenciaAtualTexto = vigenciaSelecionada ? fmtVigencia(vigenciaSelecionada) : "Vigência atual";

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[92vh] overflow-x-hidden overflow-y-auto bg-background sm:max-w-3xl">
        <DialogHeader><DialogTitle>{titulo}</DialogTitle></DialogHeader>

        <div className="space-y-6">
            {mode === "NORMAL" ? (
              <>
                <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
                  <Pick
                    required
                    label="Vigência"
                    value={vig}
                    onChange={setVig}
                    options={vigenciasOrdenadas.map(statusVigencia)}
                    placeholder={semVigencias ? "Nenhuma vigência cadastrada" : "Selecione"}
                    disabled={semVigencias}
                  />
                  <Pick
                    required
                    label="Filho"
                    childIcons
                    value={filho}
                    onChange={setFilho}
                    options={filhos.map((f) => ({
                      value: String(f.id),
                      label: f.nome,
                      cor: f.cor,
                      avatar: f.avatar === "menino" || f.avatar === "menina" ? f.avatar : null,
                    }))}
                    placeholder={semFilhos ? "Nenhum filho cadastrado" : "Selecione"}
                    disabled={semFilhos}
                  />
                  <div className="min-w-0 space-y-2">
                    <span className="text-sm font-medium">Tarefas <span className="text-destructive" aria-hidden="true">*</span></span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" className="w-full justify-between font-normal" disabled={semTarefas}>
                          <span className="truncate">
                            {semTarefas
                              ? "Nenhuma tarefa cadastrada"
                              : tarefasSelecionadas.length === 0
                                ? "Selecione"
                                : `${tarefasSelecionadas.length} tarefa(s) selecionada(s)`}
                          </span>
                          <ChevronsUpDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]" onCloseAutoFocus={(e) => e.preventDefault()}>
                        {tarefas.length > 0 && (
                          <>
                            <DropdownMenuCheckboxItem
                              checked={tarefasSelecionadas.length === tarefas.length}
                              onSelect={(e) => e.preventDefault()}
                              onCheckedChange={(checked) => setTarefasSelecionadas(checked ? tarefas.map((t) => t.id) : [])}
                            >
                              Selecionar todas
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {tarefas.map((t) => (
                          <DropdownMenuCheckboxItem key={t.id} className="whitespace-normal break-words" checked={tarefasSelecionadas.includes(t.id)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => alternarTarefa(t.id)}>
                            <span className="flex min-w-0 flex-1 items-start gap-2">
                              <TarefaIcone nome={t.nome} className="mt-0.5" />
                              <span className="min-w-0 flex-1 whitespace-normal break-words">{t.nome}</span>
                            </span>
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <Button
                    className="w-full md:w-fit"
                    variant="secondary"
                    onClick={adicionarNormal}
                    disabled={!vig || !filho || tarefasSelecionadas.length === 0 || vigenciaSelecionadaFinalizada || faltamCadastrosNormal}
                  >
                    <Plus className="h-4 w-4" /> Adicionar
                  </Button>
                </div>

                {faltamCadastrosNormal && (
                  <p className="text-xs text-muted-foreground">
                    Para fazer uma atribuição, cadastre uma vigência, ao menos um filho e ao menos uma tarefa.
                  </p>
                )}
                {vigenciaSelecionadaFinalizada && <p className="text-xs text-destructive">Não é possível fazer atribuições para uma vigência finalizada.</p>}
                {vigenciaSelecionadaFutura && <p className="text-xs text-muted-foreground">Esta vigência ainda vai começar. Você pode preparar e ajustar as atribuições normalmente.</p>}

                {itens.length > 0 && (
                  <>
                    <div className="space-y-2 md:hidden">
                      {itens.map((it, i) => {
                        const filhoItem = filhoInicial?.id === it.id_filho ? filhoInicial : filhoPorId(it.id_filho);
                        const vigenciaItem = vigencias.find((v) => v.id === it.id_vigencia);

                        return (
                          <div key={`${it.id_vigencia}-${it.id_filho}-${it.id_tarefa}`} className="min-w-0 rounded-xl border bg-card p-3">
                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3">
                              <div className="min-w-0 space-y-2">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Filho</p>
                                  <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                                    {filhoItem && (
                                      <FilhoAvatar
                                        nome={filhoItem.nome}
                                        cor={filhoItem.cor}
                                        avatar={filhoItem.avatar === "menino" || filhoItem.avatar === "menina" ? filhoItem.avatar : null}
                                        className="h-5 w-5"
                                      />
                                    )}
                                    <span className="min-w-0 whitespace-normal break-words [overflow-wrap:anywhere]">{nomeF(it.id_filho)}</span>
                                  </div>
                                </div>

                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tarefa</p>
                                  <div className="mt-0.5 flex min-w-0 items-start gap-2">
                                    <TarefaIcone nome={nomeT(it.id_tarefa)} className="mt-0.5" />
                                    <p className="min-w-0 whitespace-normal break-words font-medium [overflow-wrap:anywhere]">{nomeT(it.id_tarefa)}</p>
                                  </div>
                                </div>

                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Vigência</p>
                                  <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2">
                                    <span className="min-w-0 whitespace-normal break-words [overflow-wrap:anywhere]">{nomeV(it.id_vigencia)}</span>
                                    {vigenciaItem && <VigenciaStatus vigencia={vigenciaItem} />}
                                  </div>
                                </div>
                              </div>

                              <Hint content="Remover">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 rounded-md"
                                  onClick={() => setItens((atuais) => atuais.filter((_, j) => j !== i))}
                                  aria-label="Remover"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </Hint>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="hidden min-w-0 rounded-xl border md:block">
                      <Table className="table-fixed">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[22%]">Filho</TableHead>
                            <TableHead className="w-[34%]">Tarefa</TableHead>
                            <TableHead className="w-[34%]">Vigência</TableHead>
                            <TableHead className="w-[10%]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {itens.map((it, i) => (
                            <TableRow key={`${it.id_vigencia}-${it.id_filho}-${it.id_tarefa}`}>
                              <TableCell className="min-w-0 font-medium">
                                <span className="flex min-w-0 items-start gap-1.5">
                                  {(() => {
                                    const filhoItem = filhoInicial?.id === it.id_filho ? filhoInicial : filhoPorId(it.id_filho);
                                    return filhoItem ? (
                                      <FilhoAvatar
                                        nome={filhoItem.nome}
                                        cor={filhoItem.cor}
                                        avatar={filhoItem.avatar === "menino" || filhoItem.avatar === "menina" ? filhoItem.avatar : null}
                                        className="h-5 w-5"
                                      />
                                    ) : null;
                                  })()}
                                  <span className="min-w-0 whitespace-normal break-words [overflow-wrap:anywhere]">{nomeF(it.id_filho)}</span>
                                </span>
                              </TableCell>
                              <TableCell className="min-w-0 whitespace-normal break-words [overflow-wrap:anywhere]">
                                <span className="flex min-w-0 items-start gap-2">
                                  <TarefaIcone nome={nomeT(it.id_tarefa)} className="mt-0.5" />
                                  <span className="min-w-0 whitespace-normal break-words [overflow-wrap:anywhere]">{nomeT(it.id_tarefa)}</span>
                                </span>
                              </TableCell>
                              <TableCell className="min-w-0">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                  <span className="min-w-0 whitespace-normal break-words [overflow-wrap:anywhere]">{nomeV(it.id_vigencia)}</span>
                                  {vigencias.find((v) => v.id === it.id_vigencia) && <VigenciaStatus vigencia={vigencias.find((v) => v.id === it.id_vigencia)!} />}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Hint content="Remover">
                                  <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 rounded-md" onClick={() => setItens((atuais) => atuais.filter((_, j) => j !== i))} aria-label="Remover">
                                    <X className="h-4 w-4" />
                                  </Button>
                                </Hint>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void runAction(() => salvarItens(itens, "ATUAL_OU_FUTURA"))}
                    disabled={saving || itens.length === 0}
                  >
                    Cadastrar {itens.length > 0 && `(${itens.length})`}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <FixedCurrentValidity value={vigenciaAtualTexto} />

                  <div className="grid gap-4 md:grid-cols-2">
                  {mode === "POS_CADASTRO_FILHO" || mode === "CONTEXTO_FILHO_VIGENCIA" ? (
                    <>
                      <div className="min-w-0 space-y-1">
                        <Label className="text-xs text-muted-foreground">Filho</Label>
                        <div className="flex min-w-0 items-center gap-1.5">
                          {filhoInicial && (
                            <FilhoAvatar
                              nome={filhoInicial.nome}
                              cor={filhoInicial.cor}
                              avatar={filhoInicial.avatar === "menino" || filhoInicial.avatar === "menina" ? filhoInicial.avatar : null}
                              className="h-5 w-5"
                            />
                          )}
                          <p className="min-w-0 truncate text-xs font-medium leading-5 text-foreground">{filhoInicial?.nome ?? "Filho cadastrado"}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Tarefas <span className="text-destructive">*</span></Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" className="w-full justify-between font-normal" disabled={semTarefasSelecionaveis}>
                              <span className="truncate">
                                {semTarefasSelecionaveis
                                  ? mode === "CONTEXTO_FILHO_VIGENCIA"
                                    ? "Todas as tarefas já foram atribuídas"
                                    : "Nenhuma tarefa cadastrada"
                                  : tarefasSelecionadas.length === 0
                                    ? "Selecione"
                                    : `${tarefasSelecionadas.length} tarefa(s) selecionada(s)`}
                              </span>
                              <ChevronsUpDown className="h-4 w-4 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]" onCloseAutoFocus={(e) => e.preventDefault()}>
                            {tarefasParaSelecionar.length > 0 && (
                              <>
                                <DropdownMenuCheckboxItem
                                  checked={tarefasSelecionadas.length === tarefasParaSelecionar.length}
                                  onSelect={(e) => e.preventDefault()}
                                  onCheckedChange={(checked) => setTarefasSelecionadas(checked ? tarefasParaSelecionar.map((t) => t.id) : [])}
                                >
                                  Selecionar todas
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {tarefasParaSelecionar.map((t) => (
                              <DropdownMenuCheckboxItem key={t.id} className="whitespace-normal break-words" checked={tarefasSelecionadas.includes(t.id)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => alternarTarefa(t.id)}>
                                <span className="flex min-w-0 flex-1 items-start gap-2">
                                  <TarefaIcone nome={t.nome} className="mt-0.5" />
                                  <span className="min-w-0 flex-1 whitespace-normal break-words">{t.nome}</span>
                                </span>
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </>
                  ) : (
                    <>
                      <FixedInfo
                        label={tarefasIniciais.length > 1 ? "Tarefas cadastradas" : "Tarefa"}
                        values={tarefasIniciais.map((t) => t.nome)}
                        taskIcons
                      />
                      <div className="space-y-2">
                        <Label>Filhos <span className="text-destructive">*</span></Label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" className="w-full justify-between font-normal" disabled={semFilhos}>
                              <span className="truncate">
                                {semFilhos
                                  ? "Nenhum filho cadastrado"
                                  : filhosSelecionados.length === 0
                                    ? "Selecione"
                                    : `${filhosSelecionados.length} filho(s) selecionado(s)`}
                              </span>
                              <ChevronsUpDown className="h-4 w-4 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]" onCloseAutoFocus={(e) => e.preventDefault()}>
                            {filhos.length > 0 && (
                              <>
                                <DropdownMenuCheckboxItem
                                  checked={filhosSelecionados.length === filhos.length}
                                  onSelect={(e) => e.preventDefault()}
                                  onCheckedChange={(checked) => setFilhosSelecionados(checked ? filhos.map((f) => f.id) : [])}
                                >
                                  Selecionar todos
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            {filhos.map((f) => (
                              <DropdownMenuCheckboxItem key={f.id} checked={filhosSelecionados.includes(f.id)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => alternarFilho(f.id)}>
                                <span className="flex min-w-0 items-center gap-2">
                                  <FilhoAvatar
                                    nome={f.nome}
                                    cor={f.cor}
                                    avatar={f.avatar === "menino" || f.avatar === "menina" ? f.avatar : null}
                                    className="h-5 w-5"
                                  />
                                  <span className="min-w-0 truncate">{f.nome}</span>
                                </span>
                              </DropdownMenuCheckboxItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </>
                  )}
                  </div>
                </div>

                {mode !== "CONTEXTO_FILHO_VIGENCIA" && (
                  <p className="text-xs text-muted-foreground">
                    Este atalho usa somente a vigência em andamento. Para preparar atribuições de uma vigência futura, use a página Atribuições.
                  </p>
                )}

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
                  <Button
                    type="button"
                    onClick={() => void runAction(cadastrarContextual)}
                    disabled={saving || ((mode === "POS_CADASTRO_FILHO" || mode === "CONTEXTO_FILHO_VIGENCIA") ? semTarefasSelecionaveis || tarefasSelecionadas.length === 0 : semFilhos || filhosSelecionados.length === 0)}
                  >
                    Cadastrar atribuição
                  </Button>
                </DialogFooter>
              </>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
