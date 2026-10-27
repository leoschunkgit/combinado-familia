import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, EllipsisVertical, Loader2, Pencil, Plus, Star, ThumbsDown, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { erroRegra, msgErro } from "@/lib/app-error";
import { useFilhoTarefas, useOcorrencias, useVigencias, type Filho } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { RecompensasAproveitadasSection } from "@/components/RecompensasAproveitadasSection";
import { resumoEstrelasVazio, type RecompensaEstrelaResumo, type ResumoEstrelas } from "@/lib/estrelas-model";
import { compararVigencias, situacaoVigencia } from "@/components/VigenciaStatus";
import { normalizarNomeRecompensa, RECOMPENSA_SUGESTOES_CATEGORIAS } from "@/lib/recompensa-sugestoes";
import { RecompensaIcone } from "@/components/RecompensaIcone";

function Estrela({ className = "" }: { className?: string }) {
  return (
    <Star
      aria-hidden="true"
      className={`h-3.5 w-3.5 fill-amber-400 text-amber-500 ${className}`}
    />
  );
}


export function FilhoEstrelasPainel({ filho, modo = "completo", seletorFilho }: { filho: Filho; modo?: "completo" | "recompensas"; seletorFilho?: ReactNode }) {
  const somenteRecompensas = modo === "recompensas";
  const { data: ocorrencias = [] } = useOcorrencias();
  const { data: vigencias = [] } = useVigencias();
  const { data: atribuicoes = [] } = useFilhoTarefas();
  const [resumo, setResumo] = useState<ResumoEstrelas>(resumoEstrelasVazio);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [formAberto, setFormAberto] = useState(false);
  const [abaForm, setAbaForm] = useState<"cadastrar" | "sugestoes">("cadastrar");
  const [sugestoesSelecionadas, setSugestoesSelecionadas] = useState<string[]>([]);
  const [estrelasSugestoes, setEstrelasSugestoes] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState<RecompensaEstrelaResumo | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [estrelas, setEstrelas] = useState("");
  const [recompensasAbertas, setRecompensasAbertas] = useState(!somenteRecompensas);
  const [confirmacao, setConfirmacao] = useState<
    | { tipo: "APROVEITOU"; recompensa: RecompensaEstrelaResumo }
    | { tipo: "EXCLUIR"; recompensa: RecompensaEstrelaResumo }
    | null
  >(null);

  async function carregar(silencioso = false) {
    if (!silencioso) setCarregando(true);
    try {
      const { data, error } = await supabase.rpc("resumo_estrelas_filho", {
        p_id_filho: filho.id,
      });

      if (error) throw error;

      const proximoResumo = (data as unknown as ResumoEstrelas | null) ?? resumoEstrelasVazio;
      setResumo(proximoResumo);
    } catch (error) {
      if (!silencioso) {
        toast.error(msgErro(error));
      }
    } finally {
      if (!silencioso) setCarregando(false);
    }
  }

  useEffect(() => {
    setResumo(resumoEstrelasVazio);
    setEditando(null);
    setNome("");
    setDescricao("");
    setEstrelas("");
    setFormAberto(false);
    setAbaForm("cadastrar");
    setSugestoesSelecionadas([]);
    setEstrelasSugestoes({});
    setRecompensasAbertas(!somenteRecompensas);
    setConfirmacao(null);
    void carregar();

    const intervalo = window.setInterval(() => {
      void carregar(true);
    }, 5_000);

    return () => window.clearInterval(intervalo);
  }, [filho.id, somenteRecompensas]);

  function limparForm() {
    setEditando(null);
    setNome("");
    setDescricao("");
    setEstrelas("");
    setAbaForm("cadastrar");
    setSugestoesSelecionadas([]);
    setEstrelasSugestoes({});
    setFormAberto(false);
  }

  function novaRecompensa() {
    setEditando(null);
    setNome("");
    setDescricao("");
    setEstrelas("");
    setAbaForm("cadastrar");
    setSugestoesSelecionadas([]);
    setEstrelasSugestoes({});
    setFormAberto(true);
  }

  function editarRecompensa(recompensa: RecompensaEstrelaResumo) {
    if (!recompensa.pode_editar) {
      toast.error("Aguarde a recompensa ser marcada como aproveitada para editar.");
      return;
    }

    setEditando(recompensa);
    setNome(recompensa.nome);
    setDescricao(recompensa.descricao ?? "");
    setEstrelas(String(recompensa.estrelas_necessarias));
    setAbaForm("cadastrar");
    setSugestoesSelecionadas([]);
    setEstrelasSugestoes({});
    setFormAberto(true);
  }

  function alternarSugestaoRecompensa(nomeSugestao: string) {
    setSugestoesSelecionadas((atuais) =>
      atuais.includes(nomeSugestao)
        ? atuais.filter((item) => item !== nomeSugestao)
        : [...atuais, nomeSugestao],
    );
  }

  function prepararSugestoesParaCadastro() {
    setEstrelasSugestoes((atuais) =>
      Object.fromEntries(
        sugestoesSelecionadas.map((item) => [item, atuais[item] ?? ""]),
      ),
    );
    setAbaForm("cadastrar");
  }

  async function salvarSugestoesSelecionadas(evento: FormEvent) {
    evento.preventDefault();

    const recompensas = sugestoesSelecionadas.map((nomeSugestao) => ({
      nome: nomeSugestao,
      estrelas: Number(estrelasSugestoes[nomeSugestao] ?? ""),
    }));

    const invalida = recompensas.find(
      (recompensa) =>
        !Number.isInteger(recompensa.estrelas) ||
        recompensa.estrelas < 1 ||
        recompensa.estrelas > 100000,
    );

    if (invalida) {
      toast.error(`Informe uma quantidade válida de estrelas para “${invalida.nome}”.`);
      return;
    }

    setSalvando(true);
    let cadastradas = 0;

    try {
      for (const recompensa of recompensas) {
        const { error } = await supabase.rpc("salvar_recompensa_estrelas", {
          p_id_filho: filho.id,
          p_nome: recompensa.nome,
          p_descricao: "",
          p_estrelas_necessarias: recompensa.estrelas,
        });

        if (error) throw error;
        cadastradas += 1;
      }

      toast.success(
        cadastradas === 1
          ? "Recompensa cadastrada"
          : `${cadastradas} recompensas cadastradas`,
      );
      limparForm();
      await carregar();
    } catch (error) {
      if (cadastradas > 0) {
        toast.error(
          `${cadastradas} recompensa${cadastradas === 1 ? "" : "s"} cadastrada${cadastradas === 1 ? "" : "s"} antes do erro. ${msgErro(error)}`,
        );
        limparForm();
        await carregar();
      } else {
        toast.error(msgErro(error));
      }
    } finally {
      setSalvando(false);
    }
  }

  async function salvarRecompensa(evento: FormEvent) {
    evento.preventDefault();

    const quantidade = Number(estrelas);
    if (nome.trim().length < 2) {
      toast.error("Informe o nome da recompensa.");
      return;
    }
    if (!Number.isInteger(quantidade) || quantidade < 1) {
      toast.error("Informe uma quantidade válida de estrelas.");
      return;
    }

    setSalvando(true);
    try {
      const { error } = await supabase.rpc("salvar_recompensa_estrelas", {
        p_id_filho: filho.id,
        p_nome: nome.trim(),
        p_descricao: descricao.trim(),
        p_estrelas_necessarias: quantidade,
        ...(editando ? { p_id_recompensa: editando.id } : {}),
      });

      if (error) throw error;

      toast.success(editando ? "Recompensa atualizada" : "Recompensa cadastrada");
      limparForm();
      await carregar();
    } catch (error) {
      toast.error(msgErro(error));
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarAcao() {
    if (!confirmacao) return;

    let resumoAtualizado: ResumoEstrelas | null = null;

    setSalvando(true);
    try {
      if (confirmacao.tipo === "APROVEITOU") {
        const { data, error } = await supabase.rpc("confirmar_recompensa_aproveitada", {
          p_id_recompensa: confirmacao.recompensa.id,
        });
        if (error) throw error;

        const retorno = data as unknown as {
          ok?: boolean;
          codigo?: string;
          mensagem?: string;
          resumo?: ResumoEstrelas;
        } | null;
        if (!retorno?.ok) {
          throw erroRegra(
            retorno?.mensagem ?? "Não foi possível confirmar a recompensa.",
            retorno?.codigo,
          );
        }

        resumoAtualizado = retorno.resumo ?? null;
        toast.success("Recompensa marcada como aproveitada");
      } else if (confirmacao.tipo === "EXCLUIR") {
        const { error } = await supabase.rpc("excluir_recompensa_estrelas", {
          p_id_recompensa: confirmacao.recompensa.id,
        });
        if (error) throw error;
        toast.success("Recompensa excluída");
      }

      setConfirmacao(null);
      if (resumoAtualizado) {
        setResumo(resumoAtualizado);
      } else {
        await carregar();
      }
    } catch (error) {
      toast.error(msgErro(error));
    } finally {
      setSalvando(false);
    }
  }

  const recompensasOrdenadas = [...resumo.recompensas].sort((a, b) => a.id - b.id);
  const agora = Date.now();
  const vigenciaResumo = [...vigencias]
    .sort(compararVigencias)
    .find(
      (vigencia) =>
        situacaoVigencia(vigencia, agora) === "andamento" &&
        atribuicoes.some(
          (atribuicao) =>
            atribuicao.id_vigencia === vigencia.id &&
            atribuicao.id_filho === filho.id,
        ),
    );
  const totalNaoFezVigencia = vigenciaResumo
    ? ocorrencias.filter(
        (ocorrencia) =>
          ocorrencia.tipo === "NAO_FEZ" &&
          ocorrencia.t_filho_tarefa?.id_filho === filho.id &&
          ocorrencia.t_filho_tarefa?.id_vigencia === vigenciaResumo.id,
      ).length
    : 0;

  if (carregando) {
    return (
      <div className={somenteRecompensas ? "flex min-h-24 items-center justify-center" : "flex min-h-64 items-center justify-center rounded-2xl border bg-card"}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className={somenteRecompensas ? "space-y-3" : "space-y-4"}>
        <div className={!somenteRecompensas && seletorFilho ? "overflow-hidden rounded-2xl border bg-card" : ""}>
          {!somenteRecompensas && seletorFilho}

          {!somenteRecompensas && seletorFilho && (
            <div className="flex min-w-0 items-center justify-end gap-2 border-b border-border/60 px-3 py-2.5 sm:px-4">
              <span
                className="animate-subtle-shake inline-flex h-9 items-center gap-1.5 rounded-full border bg-background px-2.5 text-xs font-bold"
                aria-label={`${resumo.total_conquistado} estrelas conquistadas`}
              >
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                {resumo.total_conquistado}
              </span>
              <span
                className="animate-subtle-shake inline-flex h-9 items-center gap-1.5 rounded-full border bg-background px-2.5 text-xs font-bold"
                aria-label={`${totalNaoFezVigencia} não fez`}
              >
                <ThumbsDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                {totalNaoFezVigencia}
              </span>
            </div>
          )}

        <CollapsibleSection
          className={!somenteRecompensas && seletorFilho ? "mt-1.5 rounded-none border-0 bg-clean-surface" : "bg-clean-surface"}
          title="Recompensas"
          count={resumo.recompensas.length}
          open={recompensasAbertas}
          onOpenChange={setRecompensasAbertas}
          contentDivider={false}
          contentClassName="bg-clean-surface px-3.5 pb-3.5 pt-2 sm:px-4 sm:pb-4 sm:pt-2.5"
          action={
            <Button type="button" size="sm" className="h-8 shrink-0 px-2.5 text-xs" onClick={novaRecompensa}>
              <Plus className="h-3.5 w-3.5" /> Nova
            </Button>
          }
        >
          <div className="space-y-3.5">
            {recompensasOrdenadas.map((recompensa) => {
              const metaExibida = recompensa.meta_exibicao;
              const progressoExibido = recompensa.progresso_exibicao;
              const progresso = Math.min(
                100,
                Math.max(0, (progressoExibido / metaExibida) * 100),
              );
              return (
                <article key={recompensa.id} className="rounded-xl border bg-clean-surface p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <RecompensaIcone nome={recompensa.nome_exibicao} className="mt-0.5 h-4 w-4 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-semibold">{recompensa.nome_exibicao}</p>
                        {recompensa.descricao_exibicao && <p className="mt-0.5 break-words text-xs text-muted-foreground">{recompensa.descricao_exibicao}</p>}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/20 px-2 py-1 text-xs font-semibold">{somenteRecompensas && <span>Meta:</span>}<Estrela />{metaExibida}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" disabled={salvando} aria-label={`Mais ações para ${recompensa.nome_exibicao}`}>
                            <EllipsisVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            disabled={!recompensa.pode_editar}
                            title={!recompensa.pode_editar ? "Aguarde a recompensa ser marcada como aproveitada." : undefined}
                            onSelect={() => editarRecompensa(recompensa)}
                          >
                            <Pencil className="h-4 w-4" />Editar
                          </DropdownMenuItem>
                          {recompensa.pode_excluir && (
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirmacao({ tipo: "EXCLUIR", recompensa })}>
                              <Trash2 className="h-4 w-4" />Excluir
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {!somenteRecompensas ? (
                    <>
                      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progresso}%` }} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">{progressoExibido} de {metaExibida}<Estrela className="h-3 w-3" /></span>
                        <div className="flex items-center gap-2">
                          <span className={recompensa.conquistada ? "font-semibold text-amber-700 dark:text-amber-300" : "text-muted-foreground"}>
                            {recompensa.conquistada
                              ? "Conquistada"
                              : <span className="inline-flex items-center gap-1">Faltam {recompensa.faltam_exibicao}<Estrela className="h-3 w-3" /></span>}
                          </span>
                          {recompensa.pode_confirmar_aproveitada && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[11px] font-semibold"
                              onClick={() => setConfirmacao({ tipo: "APROVEITOU", recompensa })}
                              disabled={salvando}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Já aproveitou
                            </Button>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (recompensa.conquistada || recompensa.pode_confirmar_aproveitada) ? (
                    <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-xs">
                      {recompensa.conquistada && (
                        <span className="font-semibold text-amber-700 dark:text-amber-300">Conquistada</span>
                      )}
                      {recompensa.pode_confirmar_aproveitada && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px] font-semibold"
                          onClick={() => setConfirmacao({ tipo: "APROVEITOU", recompensa })}
                          disabled={salvando}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Já aproveitou
                        </Button>
                      )}
                    </div>
                  ) : null}

                </article>
              );
            })}
            {resumo.recompensas.length === 0 && <p className="rounded-xl border border-dashed bg-background px-4 py-5 text-center text-sm text-muted-foreground">Nenhuma recompensa cadastrada.</p>}
          </div>
        </CollapsibleSection>
        </div>

        {!somenteRecompensas && <RecompensasAproveitadasSection resgates={resumo.resgates} />}

      </div>

      <Dialog
        open={formAberto}
        onOpenChange={(open) => {
          if (!open) limparForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar recompensa" : "Nova recompensa"}</DialogTitle>
          </DialogHeader>

          {editando ? (
            <form onSubmit={(evento) => void salvarRecompensa(evento)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="recompensa-nome">Recompensa *</Label>
                <Input id="recompensa-nome" value={nome} onChange={(evento) => setNome(evento.target.value)} maxLength={100} placeholder="Ex.: Ir ao cinema" autoFocus />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="recompensa-descricao">Descrição <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                <Input id="recompensa-descricao" value={descricao} onChange={(evento) => setDescricao(evento.target.value)} maxLength={300} placeholder="Ex.: Sessão de cinema no fim de semana" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="recompensa-estrelas">Estrelas necessárias *</Label>
                <div className="relative max-w-40">
                  <Input id="recompensa-estrelas" type="number" min="1" max="100000" step="1" inputMode="numeric" value={estrelas} onChange={(evento) => setEstrelas(evento.target.value)} className="pr-9" />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center"><Estrela /></span>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={limparForm}>Cancelar</Button>
                <Button type="submit" disabled={salvando}>
                  {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar alterações
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <Tabs
              value={abaForm}
              onValueChange={(value) => setAbaForm(value as "cadastrar" | "sugestoes")}
              className="min-w-0"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="cadastrar">Cadastrar</TabsTrigger>
                <TabsTrigger value="sugestoes">Sugestões</TabsTrigger>
              </TabsList>

              <TabsContent value="cadastrar" className="mt-5">
                {sugestoesSelecionadas.length > 0 ? (
                  <form onSubmit={(evento) => void salvarSugestoesSelecionadas(evento)} className="space-y-5">
                    <div>
                      <p className="text-sm font-medium">Recompensas selecionadas</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Informe quantas estrelas são necessárias para cada recompensa.
                      </p>
                    </div>

                    <div className="max-h-[48vh] space-y-2 overflow-y-auto pr-1">
                      {sugestoesSelecionadas.map((nomeSugestao, index) => (
                        <div
                          key={nomeSugestao}
                          className="flex min-w-0 items-center gap-2 rounded-xl border p-3"
                        >
                          <RecompensaIcone
                            nome={nomeSugestao}
                            className="h-4 w-4 text-primary"
                          />
                          <span className="min-w-0 flex-1 break-words text-sm font-medium leading-snug">
                            {nomeSugestao}
                          </span>
                          <div className="relative w-24 shrink-0">
                            <Input
                              id={`recompensa-sugestao-estrelas-${index}`}
                              type="number"
                              min="1"
                              max="100000"
                              step="1"
                              inputMode="numeric"
                              value={estrelasSugestoes[nomeSugestao] ?? ""}
                              onChange={(evento) =>
                                setEstrelasSugestoes((atuais) => ({
                                  ...atuais,
                                  [nomeSugestao]: evento.target.value,
                                }))
                              }
                              className="pr-8 text-center"
                              aria-label={`Estrelas necessárias para ${nomeSugestao}`}
                            />
                            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                              <Estrela />
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => {
                              setSugestoesSelecionadas((atuais) =>
                                atuais.filter((item) => item !== nomeSugestao),
                              );
                              setEstrelasSugestoes((atuais) => {
                                const proximas = { ...atuais };
                                delete proximas[nomeSugestao];
                                return proximas;
                              });
                            }}
                            aria-label={`Remover ${nomeSugestao}`}
                            title="Remover"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={limparForm}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={salvando}>
                        {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                        Cadastrar selecionadas ({sugestoesSelecionadas.length})
                      </Button>
                    </DialogFooter>
                  </form>
                ) : (
                  <form onSubmit={(evento) => void salvarRecompensa(evento)} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="recompensa-nome">Recompensa *</Label>
                      <Input id="recompensa-nome" value={nome} onChange={(evento) => setNome(evento.target.value)} maxLength={100} placeholder="Ex.: Partiu cinema!" autoFocus />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="recompensa-descricao">Descrição <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                      <Input id="recompensa-descricao" value={descricao} onChange={(evento) => setDescricao(evento.target.value)} maxLength={300} placeholder="Ex.: Sessão de cinema no fim de semana" />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="recompensa-estrelas">Estrelas necessárias *</Label>
                      <div className="relative max-w-40">
                        <Input id="recompensa-estrelas" type="number" min="1" max="100000" step="1" inputMode="numeric" value={estrelas} onChange={(evento) => setEstrelas(evento.target.value)} className="pr-9" />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center"><Estrela /></span>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={limparForm}>Cancelar</Button>
                      <Button type="submit" disabled={salvando}>
                        {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                        Cadastrar
                      </Button>
                    </DialogFooter>
                  </form>
                )}
              </TabsContent>

              <TabsContent value="sugestoes" className="mt-5 space-y-5">
                <div>
                  <p className="text-sm font-medium">Escolha recompensas para adicionar</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Você pode selecionar várias sugestões de uma vez. Recompensas já cadastradas para este filho ficam indisponíveis.
                  </p>
                </div>

                <div className="max-h-[52vh] space-y-5 overflow-y-auto pr-1">
                  {RECOMPENSA_SUGESTOES_CATEGORIAS.map((grupo, grupoIndex) => (
                    <section key={grupo.categoria} className="space-y-2">
                      <h3 className="text-sm font-semibold">{grupo.categoria}</h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {grupo.sugestoes.map((sugestao, sugestaoIndex) => {
                          const jaCadastrada = resumo.recompensas.some(
                            (recompensa) =>
                              normalizarNomeRecompensa(recompensa.nome) ===
                              normalizarNomeRecompensa(sugestao.nome),
                          );
                          const selecionada = sugestoesSelecionadas.includes(sugestao.nome);
                          const id = `sugestao-recompensa-${grupoIndex}-${sugestaoIndex}`;

                          return (
                            <label
                              key={sugestao.nome}
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
                                onCheckedChange={() =>
                                  alternarSugestaoRecompensa(sugestao.nome)
                                }
                                aria-label={`Selecionar ${sugestao.nome}`}
                              />
                              <span className="flex min-w-0 flex-1 items-start gap-2">
                                <RecompensaIcone icone={sugestao.icone} className="mt-0.5 h-4 w-4 text-primary" />
                                <span className="min-w-0 flex-1">
                                  <span className="block whitespace-normal break-words font-medium leading-snug">
                                    {sugestao.nome}
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
                  <Button type="button" variant="outline" onClick={limparForm}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    disabled={sugestoesSelecionadas.length === 0}
                    onClick={prepararSugestoesParaCadastro}
                  >
                    Adicionar selecionadas
                    {sugestoesSelecionadas.length > 0 && ` (${sugestoesSelecionadas.length})`}
                  </Button>
                </DialogFooter>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmacao !== null} onOpenChange={(value) => !value && setConfirmacao(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmacao?.tipo === "APROVEITOU"
                ? "Já aproveitou?"
                : "Excluir recompensa?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmacao?.tipo === "APROVEITOU"
              ? `Confirme que ${filho.nome} já aproveitou “${confirmacao.recompensa.nome_exibicao}”. A nova contagem começa a partir das próximas estrelas.`
              : "Esta recompensa será excluída. As estrelas já conquistadas e o histórico existente serão preservados."}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmacao(null)}>Voltar</Button>
            <Button
              type="button"
              variant={confirmacao?.tipo === "EXCLUIR" ? "destructive" : "default"}
              onClick={() => void confirmarAcao()}
              disabled={salvando}
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmacao?.tipo === "APROVEITOU"
                ? "Sim, já aproveitou"
                : confirmacao?.tipo === "EXCLUIR"
                  ? "Excluir"
                  : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
