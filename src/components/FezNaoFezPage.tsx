import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardCheck,
  Pencil,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { CurrencyInput } from "@/components/CurrencyInput";
import { CollapseChevron } from "@/components/CollapseChevron";
import { ResponsiveFilters } from "@/components/ResponsiveFilters";
import { Pick } from "@/components/Pick";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fmtVigencia,
  msgErro,
  useFilhos,
  useFilhoTarefas,
  useOcorrencias,
  useVigencias,
  useTarefas,
  type FilhoTarefa,
  type Ocorrencia,
  type Vigencia,
} from "@/lib/db";
import {
  ocorrenciasPenalizadas,
  registrarNaoFezComPenalidade,
} from "@/lib/penalidade";
import {
  reais,
  resumoMesada,
  usaDesconto,
  valorDebitado,
} from "@/lib/mesada";
import {
  botaoFezClass,
  botaoNaoFezClass,
} from "@/lib/action-button-styles";
import { useActionLoading } from "@/components/ActionLoading";
import {
  compararVigencias,
  situacaoVigencia,
  VigenciaStatus,
  vigenciaEmAndamento,
} from "@/components/VigenciaStatus";
import { uiTypography } from "@/lib/ui-typography";
import { PenalidadeDialog } from "@/components/PenalidadeDialog";
import {
  dataBrasil,
  datasDaVigenciaAteHoje,
  useDataBrasilAtual,
} from "@/lib/notificacoes";

type ModoPagina = "todos" | "pendentes";
type BonusTipo = "NENHUMA" | "TEXTO" | "VALOR";

type FezDraft = {
  modo: "REGISTRAR" | "EDITAR";
  ocorrenciaId?: number;
  tarefa: FilhoTarefa;
  total: number;
  data: string;
  bonusTipo: BonusTipo;
  descricao: string;
  valor: string;
};

type Troca = {
  direcao: "PARA_FEZ" | "PARA_NAO_FEZ";
  tarefa: FilhoTarefa;
  total: number;
  ocorrencia: Ocorrencia;
  fez?: FezDraft;
};

type ExcluirSelecionadasDraft = {
  tarefa: FilhoTarefa;
  ids: number[];
};

type PenalidadeDraft = {
  tarefa: FilhoTarefa;
  total: number;
  data: string;
  existente?: Ocorrencia;
  descricao: string;
};

type FezNaoFezPageProps = {
  modo: ModoPagina;
};

function formatarData(data: string) {
  return data.split("-").reverse().join("/");
}

export function FezNaoFezPage({ modo }: FezNaoFezPageProps) {
  const qc = useQueryClient();
  const { runAction } = useActionLoading();
  const { data: vigencias = [] } = useVigencias();
  const { data: filhos = [] } = useFilhos();
  const { data: atribuicoes = [], isLoading } = useFilhoTarefas();
  const { data: tarefas = [] } = useTarefas();
  const { data: ocorrencias = [] } = useOcorrencias();
  const hoje = useDataBrasilAtual();
  const agoraBrasil = new Date(hoje + "T12:00:00-03:00");

  const penalizadas = ocorrenciasPenalizadas(ocorrencias, vigencias);
  const [f, setF] = useState({ vig: "all", filho: "all", tarefa: "all" });
  const [filtro, setFiltro] = useState(f);
  const [busy, setBusy] = useState(false);
  const [fez, setFez] = useState<FezDraft | null>(null);
  const [troca, setTroca] = useState<Troca | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [confirmarExcluirSelecionadas, setConfirmarExcluirSelecionadas] =
    useState<ExcluirSelecionadasDraft | null>(null);
  const [penalidadePendente, setPenalidadePendente] =
    useState<PenalidadeDraft | null>(null);
  const [vigenciasAbertas, setVigenciasAbertas] = useState<
    Record<number, boolean>
  >({});
  const [filhosAbertos, setFilhosAbertos] = useState<Record<string, boolean>>({});
  const [tarefasAbertas, setTarefasAbertas] = useState<Record<number, boolean>>({});

  const vigenciasOrdenadas = [...vigencias].sort(compararVigencias);

  const ocorrenciasDaTarefa = (tarefa: FilhoTarefa) =>
    ocorrencias
      .filter((o) => o.id_filho_tarefa === tarefa.id)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

  const registroNaData = (tarefa: FilhoTarefa, data: string) =>
    ocorrencias.find(
      (o) =>
        o.id_filho_tarefa === tarefa.id &&
        dataBrasil(o.created_at) === data,
    );

  const datasDaTarefa = (tarefa: FilhoTarefa, vigencia: Vigencia) => {
    if (modo === "pendentes" && !vigenciaEmAndamento(vigencia)) return [];

    const datasGeradas = datasDaVigenciaAteHoje(vigencia, agoraBrasil);
    const datasComRegistro = ocorrenciasDaTarefa(tarefa).map((o) =>
      dataBrasil(o.created_at),
    );
    const datas = [...new Set([...datasGeradas, ...datasComRegistro])].sort(
      (a, b) => b.localeCompare(a),
    );

    if (modo === "pendentes") {
      return datas.filter((data) => !registroNaData(tarefa, data));
    }

    return datas;
  };

  const tarefasVisiveis = (vigencia: Vigencia, idFilho: number) =>
    atribuicoes.filter((tarefa) => {
      if (tarefa.id_vigencia !== vigencia.id || tarefa.id_filho !== idFilho) {
        return false;
      }
      if (filtro.tarefa !== "all" && tarefa.id_tarefa !== Number(filtro.tarefa)) {
        return false;
      }
      return modo === "todos" || datasDaTarefa(tarefa, vigencia).length > 0;
    });

  const grupos = vigenciasOrdenadas
    .filter(
      (vigencia) =>
        filtro.vig === "all" || vigencia.id === Number(filtro.vig),
    )
    .map((vigencia) => ({
      vigencia,
      filhos: filhos
        .filter(
          (filho) =>
            filtro.filho === "all" || filho.id === Number(filtro.filho),
        )
        .map((filho) => ({
          filho,
          tarefas: tarefasVisiveis(vigencia, filho.id),
        }))
        .filter((grupo) => grupo.tarefas.length > 0),
    }))
    .filter((grupo) => grupo.filhos.length > 0);

  function definirTudo(aberto: boolean) {
    setVigenciasAbertas(
      Object.fromEntries(grupos.map(({ vigencia }) => [vigencia.id, aberto])),
    );
    setFilhosAbertos(
      Object.fromEntries(
        grupos.flatMap(({ vigencia, filhos: gruposFilhos }) =>
          gruposFilhos.map(({ filho }) => [
            `${vigencia.id}-${filho.id}`,
            aberto,
          ]),
        ),
      ),
    );
    setTarefasAbertas(
      Object.fromEntries(
        grupos.flatMap(({ filhos: gruposFilhos }) =>
          gruposFilhos.flatMap(({ tarefas: tarefasDoFilho }) =>
            tarefasDoFilho.map((tarefa) => [tarefa.id, aberto]),
          ),
        ),
      ),
    );
  }

  function dataValida(tarefa: FilhoTarefa, data: string) {
    const vigencia = tarefa.t_vigencia;
    if (!vigencia) return false;
    const fim = dataBrasil(
      new Date(Math.min(new Date(vigencia.data_fim).getTime(), Date.now())),
    );
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(data) &&
      data >= dataBrasil(vigencia.data_inicio) &&
      data <= fim &&
      data <= hoje
    );
  }

  async function salvarNaoFez(
    tarefa: FilhoTarefa,
    total: number,
    data: string,
    existente?: Ocorrencia,
    penalidadeTexto?: string,
  ) {
    const vigencia = tarefa.t_vigencia;
    if (!vigencia || !vigenciaEmAndamento(vigencia)) {
      toast.error("Ações só podem ser feitas em uma vigência em andamento");
      return;
    }

    if (!dataValida(tarefa, data)) {
      toast.error(
        "A data do “Não fez” deve estar entre o início da vigência e hoje, sem ultrapassar o fim da vigência",
      );
      return;
    }

    const filho = filhos.find((item) => item.id === tarefa.id_filho);
    const vigenciaCompleta = vigencias.find(
      (item) => item.id === tarefa.id_vigencia,
    );

    setBusy(true);
    try {
      const resultado = await registrarNaoFezComPenalidade({
        tarefa,
        filho,
        vigenciaCompleta,
        filhos,
        ocorrencias,
        dataIso: new Date(data + "T12:00:00-03:00").toISOString(),
        existente,
        penalidadeTexto,
      });

      if (resultado.status === "PRECISA_PENALIDADE") {
        setTroca(null);
        setPenalidadePendente({
          tarefa,
          total: resultado.totalAtual,
          data,
          existente,
          descricao: "",
        });
        return;
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ocorrencias"] }),
        qc.invalidateQueries({ queryKey: ["vigencias"] }),
        qc.invalidateQueries({ queryKey: ["filho_tarefas"] }),
      ]);
      setTroca(null);
      setPenalidadePendente(null);

      if (resultado.comDesconto && filho) {
        toast.success(
          `Não fez registrado · Desconto acumulado: ${reais(
            valorDebitado(filho, vigencia, resultado.novoTotal),
          )}`,
        );
      } else if (resultado.penalizado) {
        toast.warning(`Limite atingido! Penalidade: ${resultado.penalidade}`);
      } else {
        toast.success(
          `Não fez registrado (${resultado.novoTotal}/${vigencia.qtd_ocorrencia})`,
        );
      }
    } catch (error) {
      toast.error(
        msgErro(
          error instanceof Error
            ? { message: error.message }
            : (error as { message?: string }),
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  function solicitarNaoFez(
    tarefa: FilhoTarefa,
    total: number,
    data: string,
    existente?: Ocorrencia,
  ) {
    if (existente?.tipo === "FEZ") {
      setTroca({
        direcao: "PARA_NAO_FEZ",
        tarefa,
        total,
        ocorrencia: existente,
      });
      return;
    }
    if (existente) return;
    void runAction(() => salvarNaoFez(tarefa, total, data));
  }

  async function confirmarPenalidade() {
    if (!penalidadePendente) return;
    await salvarNaoFez(
      penalidadePendente.tarefa,
      penalidadePendente.total,
      penalidadePendente.data,
      penalidadePendente.existente,
      penalidadePendente.descricao.trim(),
    );
  }

  function abrirFez(
    tarefa: FilhoTarefa,
    total: number,
    data: string,
    existente?: Ocorrencia,
  ) {
    if (!tarefa.t_vigencia || !vigenciaEmAndamento(tarefa.t_vigencia)) {
      toast.error("Ações só podem ser feitas em uma vigência em andamento");
      return;
    }

    setFez({
      modo: "REGISTRAR",
      tarefa,
      total,
      data,
      bonusTipo: "NENHUMA",
      descricao: "",
      valor: "",
      ...(existente ? { ocorrenciaId: existente.id } : {}),
    });
  }

  function editarBonificacao(
    tarefa: FilhoTarefa,
    total: number,
    ocorrencia: Ocorrencia,
  ) {
    if (!tarefa.t_vigencia || !vigenciaEmAndamento(tarefa.t_vigencia)) {
      toast.error("Ações só podem ser feitas em uma vigência em andamento");
      return;
    }
    setFez({
      modo: "EDITAR",
      ocorrenciaId: ocorrencia.id,
      tarefa,
      total,
      data: dataBrasil(ocorrencia.created_at),
      bonusTipo:
        ocorrencia.bonificacao_tipo === "TEXTO"
          ? "TEXTO"
          : ocorrencia.bonificacao_tipo === "VALOR"
            ? "VALOR"
            : "NENHUMA",
      descricao: ocorrencia.bonificacao_descricao ?? "",
      valor:
        ocorrencia.bonificacao_valor == null
          ? ""
          : String(ocorrencia.bonificacao_valor).replace(".", ","),
    });
  }

  async function salvarFez(draft: FezDraft, existente?: Ocorrencia) {
    const tarefa = draft.tarefa;
    const vigencia = tarefa.t_vigencia;
    if (!vigencia || !vigenciaEmAndamento(vigencia)) {
      toast.error("Ações só podem ser feitas em uma vigência em andamento");
      return;
    }
    if (!dataValida(tarefa, draft.data)) {
      toast.error(
        "A data do “Fez” deve estar entre o início da vigência e hoje, sem ultrapassar o fim da vigência",
      );
      return;
    }
    if (draft.bonusTipo === "TEXTO" && !draft.descricao.trim()) {
      toast.error("Informe a bonificação escrita");
      return;
    }

    const valor =
      draft.bonusTipo === "VALOR"
        ? Number(draft.valor.replace(",", "."))
        : null;
    if (
      draft.bonusTipo === "VALOR" &&
      (valor === null || !Number.isFinite(valor) || valor < 0)
    ) {
      toast.error("Informe um valor de bonificação válido");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        tipo: "FEZ",
        bonificacao_tipo:
          draft.bonusTipo === "NENHUMA" ? null : draft.bonusTipo,
        bonificacao_descricao:
          draft.bonusTipo === "TEXTO" ? draft.descricao.trim() : null,
        bonificacao_valor: draft.bonusTipo === "VALOR" ? valor : null,
      };
      const resposta = existente
        ? await supabase
            .from("t_ocorrencia")
            .update(payload)
            .eq("id", existente.id)
        : await supabase.from("t_ocorrencia").insert({
            ...payload,
            id_filho_tarefa: tarefa.id,
            created_at: new Date(
              draft.data + "T12:00:00-03:00",
            ).toISOString(),
          });

      if (resposta.error) {
        toast.error(msgErro(resposta.error));
        return;
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ocorrencias"] }),
        qc.invalidateQueries({ queryKey: ["vigencias"] }),
      ]);
      setFez(null);
      setTroca(null);
      toast.success(
        draft.bonusTipo === "NENHUMA"
          ? "Fez registrado"
          : "Fez registrado com bonificação",
      );
    } catch (error) {
      toast.error(
        msgErro(error instanceof Error ? { message: error.message } : null),
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmarFez() {
    if (!fez) return;

    if (fez.modo === "EDITAR") {
      const existente = ocorrencias.find(
        (o) => o.id === fez.ocorrenciaId && o.tipo === "FEZ",
      );
      if (!existente) {
        toast.error("Registro de Fez não encontrado");
        return;
      }
      await salvarFez(fez, existente);
      return;
    }

    const existente = registroNaData(fez.tarefa, fez.data);
    if (existente) {
      if (existente.tipo !== "FEZ") {
        setTroca({
          direcao: "PARA_FEZ",
          tarefa: fez.tarefa,
          total: fez.total,
          ocorrencia: existente,
          fez,
        });
        setFez(null);
        return;
      }
      toast.error(
        "Já existe um “Fez” para esta tarefa nesta data. Use o lápis para editar a bonificação.",
      );
      return;
    }

    await salvarFez(fez);
  }

  async function excluirSelecionadas(item: ExcluirSelecionadasDraft) {
    const { tarefa, ids } = item;
    const vigencia = tarefa.t_vigencia;
    if (!vigencia || !vigenciaEmAndamento(vigencia)) {
      toast.error("Ações só podem ser feitas em uma vigência em andamento");
      return;
    }
    if (ids.length === 0) return;

    setBusy(true);
    try {
      const { error } = await supabase
        .from("t_ocorrencia")
        .delete()
        .in("id", ids);
      if (error) {
        toast.error(msgErro(error));
        return;
      }

      const projetadas = ocorrencias.filter((o) => !ids.includes(o.id));
      qc.setQueryData<Ocorrencia[]>(["ocorrencias"], projetadas);
      setSelecionadas((atual) => {
        const proximo = new Set(atual);
        ids.forEach((id) => proximo.delete(id));
        return proximo;
      });

      await Promise.all([
        qc.invalidateQueries({
          queryKey: ["ocorrencias"],
          refetchType: "all",
        }),
        qc.invalidateQueries({
          queryKey: ["vigencias"],
          refetchType: "all",
        }),
        qc.invalidateQueries({
          queryKey: ["filho_tarefas"],
          refetchType: "all",
        }),
      ]);

      setConfirmarExcluirSelecionadas(null);
      toast.success(
        ids.length === 1
          ? "Marcação excluída"
          : "Marcações selecionadas excluídas",
      );
    } catch (error) {
      toast.error(
        msgErro(error instanceof Error ? { message: error.message } : null),
      );
    } finally {
      setBusy(false);
    }
  }

  const vazio =
    modo === "pendentes"
      ? "Tudo em dia. Não há datas pendentes para os filtros selecionados."
      : 'Nenhuma tarefa encontrada. Crie atribuições na aba "Atribuições".';

  return (
    <>
      <PageHeader
        title="Fez / Não fez"
        description={
          modo === "pendentes"
            ? "Marque rapidamente os dias que ainda estão sem Fez ou Não fez."
            : "Acompanhe e marque cada dia das tarefas, sem precisar escolher a data."
        }
        icon={<ClipboardCheck className="h-6 w-6" />}
      />

      <ResponsiveFilters
        desktopClassName="md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
        onApply={() => setFiltro(f)}
        renderFilters={() => (
          <>
            <Pick
              label="Vigência"
              value={f.vig}
              onChange={(vig) => setF({ ...f, vig })}
              allLabel="Todas"
              options={vigenciasOrdenadas.map((vigencia) => ({
                value: String(vigencia.id),
                label: fmtVigencia(vigencia),
                status: situacaoVigencia(vigencia),
              }))}
            />
            <Pick
              label="Filho"
              value={f.filho}
              onChange={(filho) => setF({ ...f, filho })}
              allLabel="Todos"
              options={filhos.map((filho) => ({
                value: String(filho.id),
                label: filho.nome,
              }))}
            />
            <Pick
              label="Tarefa"
              value={f.tarefa}
              onChange={(tarefa) => setF({ ...f, tarefa })}
              allLabel="Todas"
              options={tarefas.map((tarefa) => ({
                value: String(tarefa.id),
                label: tarefa.nome,
              }))}
            />
          </>
        )}
      />

      <div className="mb-6 flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => definirTudo(true)}>
          <ChevronsDownUp className="h-4 w-4" /> Expandir tudo
        </Button>
        <Button variant="outline" size="sm" onClick={() => definirTudo(false)}>
          <ChevronsUpDown className="h-4 w-4" /> Recolher tudo
        </Button>
      </div>

      {!isLoading && grupos.length === 0 && <EmptyState>{vazio}</EmptyState>}

      <div className="space-y-8">
        {grupos.map(({ vigencia, filhos: gruposFilhos }) => {
          const vigenciaAberta =
            vigenciasAbertas[vigencia.id] ?? vigenciaEmAndamento(vigencia);
          return (
            <section
              key={vigencia.id}
              className="overflow-hidden rounded-2xl border bg-card shadow-sm"
            >
              <button
                type="button"
                className="flex w-full min-w-0 cursor-pointer items-start gap-3 border-b bg-primary/5 px-4 py-4 text-left sm:px-5"
                onClick={() =>
                  setVigenciasAbertas((atual) => ({
                    ...atual,
                    [vigencia.id]: !vigenciaAberta,
                  }))
                }
              >
                <CollapseChevron
                  open={vigenciaAberta}
                  className="mt-0.5 text-primary"
                />
                <CalendarRange className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Vigência
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={uiTypography.secondaryTitleStrongLargeDesktop}>
                      {fmtVigencia(vigencia)}
                    </h2>
                    <VigenciaStatus vigencia={vigencia} />
                  </div>
                </div>
              </button>

              {vigenciaAberta && (
                <div className="space-y-4 p-3 sm:p-4">
                  {gruposFilhos.map(({ filho, tarefas: tarefasDoFilho }) => {
                    const chave = `${vigencia.id}-${filho.id}`;
                    const filhoAberto = filhosAbertos[chave] === true;
                    const totalNaoFez = ocorrencias.filter(
                      (ocorrencia) =>
                        ocorrencia.tipo !== "FEZ" &&
                        ocorrencia.t_filho_tarefa?.id_filho === filho.id &&
                        ocorrencia.t_filho_tarefa?.id_vigencia === vigencia.id,
                    ).length;
                    const totalPendencias =
                      modo === "pendentes"
                        ? tarefasDoFilho.reduce(
                            (soma, tarefa) =>
                              soma + datasDaTarefa(tarefa, vigencia).length,
                            0,
                          )
                        : 0;
                    const comDesconto = usaDesconto(filho, vigencia);
                    const penalizado =
                      !comDesconto &&
                      totalNaoFez >= vigencia.qtd_ocorrencia;

                    return (
                      <article
                        key={filho.id}
                        className="overflow-hidden rounded-xl border bg-background"
                      >
                        <button
                          type="button"
                          className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 bg-muted/35 px-4 py-3 text-left sm:flex sm:items-center sm:justify-between"
                          onClick={() =>
                            setFilhosAbertos((atual) => ({
                              ...atual,
                              [chave]: !filhoAberto,
                            }))
                          }
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <CollapseChevron open={filhoAberto} />
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Filho
                              </p>
                              <h3
                                className={`truncate ${uiTypography.secondaryTitleStrong}`}
                              >
                                {filho.nome}
                              </h3>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-0.5 text-sm">
                            {modo === "pendentes" && (
                              <span className="font-semibold text-primary tabular-nums">
                                {totalPendencias}{" "}
                                {totalPendencias === 1
                                  ? "pendência"
                                  : "pendências"}
                              </span>
                            )}
                            {!comDesconto && (
                              <span className="font-semibold tabular-nums">
                                Não fez: {totalNaoFez} de{" "}
                                {vigencia.qtd_ocorrencia}
                              </span>
                            )}
                          </div>
                        </button>

                        {filhoAberto && (
                          <div className="border-t p-3 sm:p-4">
                            {comDesconto ? (
                              <p className="mb-4 text-sm font-medium tabular-nums">
                                Mesada: {reais(filho.valor_mesada ?? 0)} ·{" "}
                                {resumoMesada(
                                  filho,
                                  vigencia,
                                  totalNaoFez,
                                )}
                              </p>
                            ) : penalizado ? (
                              <div className="mb-4">
                                <Badge variant="destructive">
                                  <AlertTriangle className="mr-1 h-3 w-3" />
                                  Penalidade: {vigencia.penalidade}
                                </Badge>
                              </div>
                            ) : null}

                            <div className="space-y-4">
                              {tarefasDoFilho.map((tarefa) => {
                                const registros = ocorrenciasDaTarefa(tarefa);
                                const datas = datasDaTarefa(tarefa, vigencia);
                                const bloqueada = !vigenciaEmAndamento(vigencia);
                                const tarefaAberta =
                                  tarefasAbertas[tarefa.id] === true;
                                const selecionadasDaTarefa = registros.filter(
                                  (registro) => selecionadas.has(registro.id),
                                );

                                return (
                                  <section
                                    key={tarefa.id}
                                    className="overflow-hidden rounded-xl border"
                                  >
                                    <div className="flex flex-col gap-2 border-b bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                                      <button
                                        type="button"
                                        className="flex min-w-0 items-center gap-2 text-left"
                                        onClick={() =>
                                          setTarefasAbertas((atual) => ({
                                            ...atual,
                                            [tarefa.id]: !tarefaAberta,
                                          }))
                                        }
                                        aria-expanded={tarefaAberta}
                                      >
                                        <CollapseChevron
                                          open={tarefaAberta}
                                          className="shrink-0"
                                        />
                                        <div className="min-w-0">
                                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            Tarefa
                                          </p>
                                          <p className="break-words font-semibold">
                                            {tarefa.t_tarefa?.nome}
                                          </p>
                                        </div>
                                      </button>

                                      {!bloqueada && registros.length > 0 && (
                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
                                            <Checkbox
                                              checked={
                                                registros.every((registro) =>
                                                  selecionadas.has(registro.id),
                                                )
                                                  ? true
                                                  : registros.some((registro) =>
                                                        selecionadas.has(
                                                          registro.id,
                                                        ),
                                                      )
                                                    ? "indeterminate"
                                                    : false
                                              }
                                              onCheckedChange={(checked) =>
                                                setSelecionadas((atual) => {
                                                  const proximo = new Set(atual);
                                                  if (checked === true) {
                                                    registros.forEach(
                                                      (registro) =>
                                                        proximo.add(registro.id),
                                                    );
                                                  } else {
                                                    registros.forEach(
                                                      (registro) =>
                                                        proximo.delete(
                                                          registro.id,
                                                        ),
                                                    );
                                                  }
                                                  return proximo;
                                                })
                                              }
                                              aria-label={`Selecionar todas as marcações de ${tarefa.t_tarefa?.nome ?? "tarefa"}`}
                                            />
                                            Selecionar tudo
                                          </label>

                                          {selecionadasDaTarefa.length > 0 && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="text-destructive hover:text-destructive"
                                              disabled={busy}
                                              onClick={() =>
                                                setConfirmarExcluirSelecionadas({
                                                  tarefa,
                                                  ids: selecionadasDaTarefa.map(
                                                    (registro) => registro.id,
                                                  ),
                                                })
                                              }
                                            >
                                              <Trash2 className="h-4 w-4" />
                                              Excluir (
                                              {selecionadasDaTarefa.length})
                                            </Button>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {tarefaAberta && (datas.length === 0 ? (
                                      <p className="px-4 py-4 text-sm text-muted-foreground">
                                        {modo === "pendentes"
                                          ? "Nenhuma pendência nesta tarefa."
                                          : "Ainda não há datas para exibir nesta vigência."}
                                      </p>
                                    ) : (
                                      <div className="divide-y">
                                        {datas.map((data) => {
                                          const registro = registroNaData(
                                            tarefa,
                                            data,
                                          );
                                          return (
                                            <div
                                              key={data}
                                              className="grid gap-3 px-3 py-3 sm:grid-cols-[8.75rem_minmax(0,1fr)_auto] sm:items-center sm:px-4"
                                            >
                                              <div className="flex items-center gap-2">
                                                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                <span className="font-semibold tabular-nums">
                                                  {formatarData(data)}
                                                </span>
                                              </div>

                                              <div className="min-w-0">
                                                {registro ? (
                                                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                                                    <span
                                                      className={
                                                        registro.tipo === "FEZ"
                                                          ? "inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2.5 py-1 font-semibold text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
                                                          : "inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                                                      }
                                                    >
                                                      {registro.tipo ===
                                                      "FEZ" ? (
                                                        <ThumbsUp className="h-4 w-4" />
                                                      ) : (
                                                        <ThumbsDown className="h-4 w-4" />
                                                      )}
                                                      {registro.tipo === "FEZ"
                                                        ? "Fez"
                                                        : "Não fez"}
                                                    </span>

                                                    {registro.tipo === "FEZ" &&
                                                      registro.bonificacao_tipo ===
                                                        "TEXTO" && (
                                                        <span className="min-w-0 break-words text-muted-foreground">
                                                          {registro.bonificacao_descricao}
                                                        </span>
                                                      )}
                                                    {registro.tipo === "FEZ" &&
                                                      registro.bonificacao_tipo ===
                                                        "VALOR" && (
                                                        <span className="text-muted-foreground">
                                                          Bonificação:{" "}
                                                          {reais(
                                                            registro.bonificacao_valor ??
                                                              0,
                                                          )}
                                                        </span>
                                                      )}
                                                    {registro.tipo === "FEZ" &&
                                                      registro.bonificacao_tipo ===
                                                        null && (
                                                        <span className="text-muted-foreground">
                                                          Sem bonificação
                                                        </span>
                                                      )}
                                                    {registro.tipo !== "FEZ" &&
                                                      !comDesconto &&
                                                      penalizadas.has(
                                                        registro.id,
                                                      ) && (
                                                        <span
                                                          className="inline-flex items-center gap-1 text-xs font-semibold text-destructive"
                                                          title="Esta marcação atingiu o limite de penalidade"
                                                        >
                                                          <AlertTriangle className="h-3.5 w-3.5" />
                                                          Limite atingido
                                                        </span>
                                                      )}
                                                  </div>
                                                ) : null}
                                              </div>

                                              <div className="flex flex-wrap items-center justify-end gap-2">
                                                {!registro && !bloqueada && (
                                                  <>
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      className={`min-w-24 ${botaoFezClass}`}
                                                      disabled={busy}
                                                      onClick={() =>
                                                        abrirFez(
                                                          tarefa,
                                                          totalNaoFez,
                                                          data,
                                                        )
                                                      }
                                                    >
                                                      <ThumbsUp className="h-4 w-4 text-green-600" />
                                                      Fez
                                                    </Button>
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      className={`min-w-24 ${botaoNaoFezClass}`}
                                                      disabled={busy}
                                                      onClick={() =>
                                                        solicitarNaoFez(
                                                          tarefa,
                                                          totalNaoFez,
                                                          data,
                                                        )
                                                      }
                                                    >
                                                      <ThumbsDown className="h-4 w-4 text-red-600" />
                                                      Não fez
                                                    </Button>
                                                  </>
                                                )}

                                                {registro &&
                                                  !bloqueada &&
                                                  registro.tipo === "FEZ" && (
                                                    <>
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className={botaoNaoFezClass}
                                                        disabled={busy}
                                                        onClick={() =>
                                                          solicitarNaoFez(
                                                            tarefa,
                                                            totalNaoFez,
                                                            data,
                                                            registro,
                                                          )
                                                        }
                                                      >
                                                        <ThumbsDown className="h-4 w-4 text-red-600" />
                                                        Não fez
                                                      </Button>
                                                      <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        disabled={busy}
                                                        title="Editar bonificação"
                                                        aria-label="Editar bonificação"
                                                        onClick={() =>
                                                          editarBonificacao(
                                                            tarefa,
                                                            totalNaoFez,
                                                            registro,
                                                          )
                                                        }
                                                      >
                                                        <Pencil className="h-4 w-4" />
                                                      </Button>
                                                    </>
                                                  )}

                                                {registro &&
                                                  !bloqueada &&
                                                  registro.tipo !== "FEZ" && (
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      className={botaoFezClass}
                                                      disabled={busy}
                                                      onClick={() =>
                                                        abrirFez(
                                                          tarefa,
                                                          totalNaoFez,
                                                          data,
                                                          registro,
                                                        )
                                                      }
                                                    >
                                                      <ThumbsUp className="h-4 w-4 text-green-600" />
                                                      Fez
                                                    </Button>
                                                  )}

                                                {registro && !bloqueada && (
                                                  <Checkbox
                                                    checked={selecionadas.has(
                                                      registro.id,
                                                    )}
                                                    onCheckedChange={(checked) =>
                                                      setSelecionadas(
                                                        (atual) => {
                                                          const proximo =
                                                            new Set(atual);
                                                          if (checked === true) {
                                                            proximo.add(
                                                              registro.id,
                                                            );
                                                          } else {
                                                            proximo.delete(
                                                              registro.id,
                                                            );
                                                          }
                                                          return proximo;
                                                        },
                                                      )
                                                    }
                                                    aria-label={`Selecionar ${registro.tipo === "FEZ" ? "Fez" : "Não fez"} de ${formatarData(data)}`}
                                                  />
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ))}
                                  </section>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <PenalidadeDialog
        open={Boolean(penalidadePendente)}
        value={penalidadePendente?.descricao ?? ""}
        busy={busy}
        inputId="penalidade-limite"
        onChange={(descricao) =>
          setPenalidadePendente((atual) =>
            atual ? { ...atual, descricao } : atual,
          )
        }
        onCancel={() => setPenalidadePendente(null)}
        onConfirm={() => void runAction(confirmarPenalidade)}
      />

      <Dialog
        open={Boolean(fez)}
        onOpenChange={(open) => !open && !busy && setFez(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {fez?.modo === "EDITAR"
                ? "Editar bonificação"
                : "Registrar “Fez”"}
            </DialogTitle>
            <DialogDescription>
              {fez?.tarefa.t_tarefa?.nome}
              {fez ? ` · ${formatarData(fez.data)}` : ""}
              {" · "}A bonificação é opcional.
            </DialogDescription>
          </DialogHeader>

          {fez && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Bonificação</Label>
                <Select
                  value={fez.bonusTipo}
                  onValueChange={(valor) =>
                    setFez({ ...fez, bonusTipo: valor as BonusTipo })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NENHUMA">Nenhuma</SelectItem>
                    <SelectItem value="TEXTO">Escrita</SelectItem>
                    <SelectItem value="VALOR">Valor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {fez.bonusTipo === "TEXTO" && (
                <div className="space-y-2">
                  <Label htmlFor="bonus-texto">Bonificação escrita</Label>
                  <input
                    id="bonus-texto"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Ex.: Escolher o filme no sábado"
                    value={fez.descricao}
                    onChange={(event) =>
                      setFez({ ...fez, descricao: event.target.value })
                    }
                  />
                </div>
              )}

              {fez.bonusTipo === "VALOR" && (
                <div className="space-y-2">
                  <Label htmlFor="bonus-valor">
                    Valor da bonificação (R$)
                  </Label>
                  <CurrencyInput
                    id="bonus-valor"
                    value={fez.valor}
                    onValueChange={(valor) => setFez({ ...fez, valor })}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setFez(null)}
            >
              Cancelar
            </Button>
            <Button
              disabled={busy || !fez}
              onClick={() => void runAction(confirmarFez)}
            >
              <ThumbsUp className="h-4 w-4" />
              {fez?.modo === "EDITAR"
                ? "Salvar bonificação"
                : "Salvar Fez"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(troca)}
        onOpenChange={(open) => !open && !busy && setTroca(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {troca?.direcao === "PARA_FEZ"
                ? "Alterar para “Fez”?"
                : "Alterar para “Não fez”?"}
            </DialogTitle>
            <DialogDescription>
              {troca && (
                <>
                  Esta tarefa está marcada como{" "}
                  {troca.direcao === "PARA_FEZ" ? "“Não fez”" : "“Fez”"} em{" "}
                  {formatarData(dataBrasil(troca.ocorrencia.created_at))}. Ao
                  continuar, o resultado será substituído
                  {troca.direcao === "PARA_NAO_FEZ"
                    ? " e qualquer bonificação será removida"
                    : ""}
                  .
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {troca?.direcao === "PARA_FEZ" && troca.fez && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Bonificação</Label>
                <Select
                  value={troca.fez.bonusTipo}
                  onValueChange={(valor) =>
                    setTroca({
                      ...troca,
                      fez: {
                        ...troca.fez!,
                        bonusTipo: valor as BonusTipo,
                      },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NENHUMA">Nenhuma</SelectItem>
                    <SelectItem value="TEXTO">Escrita</SelectItem>
                    <SelectItem value="VALOR">Valor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {troca.fez.bonusTipo === "TEXTO" && (
                <div className="space-y-2">
                  <Label htmlFor="troca-bonus-texto">
                    Bonificação escrita
                  </Label>
                  <input
                    id="troca-bonus-texto"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Ex.: Escolher o filme no sábado"
                    value={troca.fez.descricao}
                    onChange={(event) =>
                      setTroca({
                        ...troca,
                        fez: {
                          ...troca.fez!,
                          descricao: event.target.value,
                        },
                      })
                    }
                  />
                </div>
              )}

              {troca.fez.bonusTipo === "VALOR" && (
                <div className="space-y-2">
                  <Label htmlFor="troca-bonus-valor">
                    Valor da bonificação (R$)
                  </Label>
                  <CurrencyInput
                    id="troca-bonus-valor"
                    value={troca.fez.valor}
                    onValueChange={(valor) =>
                      setTroca({
                        ...troca,
                        fez: { ...troca.fez!, valor },
                      })
                    }
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setTroca(null)}
            >
              Cancelar
            </Button>
            <Button
              disabled={busy || !troca}
              onClick={() =>
                troca &&
                void runAction(() =>
                  troca.direcao === "PARA_FEZ" && troca.fez
                    ? salvarFez(troca.fez, troca.ocorrencia)
                    : salvarNaoFez(
                        troca.tarefa,
                        troca.total,
                        dataBrasil(troca.ocorrencia.created_at),
                        troca.ocorrencia,
                      ),
                )
              }
            >
              Confirmar alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(confirmarExcluirSelecionadas)}
        onOpenChange={(open) =>
          !open && !busy && setConfirmarExcluirSelecionadas(null)
        }
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir marcações selecionadas?</DialogTitle>
            <DialogDescription>
              {confirmarExcluirSelecionadas?.tarefa.t_tarefa?.nome} ·{" "}
              {confirmarExcluirSelecionadas?.ids.length ?? 0} marcação(ões)
              serão excluídas. Os dias que ficarem sem Fez ou Não fez voltarão
              para as pendências.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmarExcluirSelecionadas(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !confirmarExcluirSelecionadas}
              onClick={() =>
                confirmarExcluirSelecionadas &&
                void runAction(() =>
                  excluirSelecionadas(confirmarExcluirSelecionadas),
                )
              }
            >
              <Trash2 className="h-4 w-4" /> Sim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
