import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Info,
  Pencil,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
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
import { FilhoAvatar } from "@/components/FilhoAvatar";
import { ResponsiveFilters } from "@/components/ResponsiveFilters";
import { Pick } from "@/components/Pick";
import { Hint } from "@/components/Hint";
import { TarefaIcone } from "@/components/TarefaIcone";
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
  vigenciaEmAndamento,
} from "@/components/VigenciaStatus";
import { uiTypography } from "@/lib/ui-typography";
import { PenalidadeDialog } from "@/components/PenalidadeDialog";
import {
  dataBrasil,
  dataPertenceAVigenciaAteHoje,
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

type BonificacaoInfo = {
  tarefa: FilhoTarefa;
  total: number;
  ocorrencia: Ocorrencia;
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

const checkboxExclusaoClass =
  "h-5 w-5 rounded-[4px] border-2 border-muted-foreground/40 bg-background shadow-sm transition-colors hover:border-muted-foreground/70 focus-visible:ring-muted-foreground/30 data-[state=checked]:border-muted-foreground data-[state=checked]:bg-muted-foreground data-[state=checked]:text-background";

function formatarData(data: string) {
  return data.split("-").reverse().join("/");
}

function formatarDataCurta(data: string) {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano.slice(-2)}`;
}

function valorBonificacaoNumero(valor: string) {
  if (!valor.trim()) return null;
  const numero = Number(valor.replace(",", "."));
  if (!Number.isFinite(numero)) return null;
  return Math.round(numero * 100) / 100;
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
  const filhoDaTarefa = (tarefa?: FilhoTarefa | null) =>
    tarefa ? filhos.find((filho) => filho.id === tarefa.id_filho) : undefined;
  const diasScrollRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const filhosScrollRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [diasSelecionados, setDiasSelecionados] = useState<Record<number, string>>({});
  const [filhosSelecionados, setFilhosSelecionados] = useState<Record<number, number>>({});
  const [f, setF] = useState({ filho: "all", tarefa: "all", resultado: "all" });
  const [filtro, setFiltro] = useState(f);
  const [busy, setBusy] = useState(false);
  const [fez, setFez] = useState<FezDraft | null>(null);
  const [bonificacaoInfo, setBonificacaoInfo] = useState<BonificacaoInfo | null>(null);
  const [troca, setTroca] = useState<Troca | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<number>>(new Set());
  const [acoesAbertas, setAcoesAbertas] = useState<Set<string>>(new Set());
  const [confirmarExcluirSelecionadas, setConfirmarExcluirSelecionadas] =
    useState<ExcluirSelecionadasDraft | null>(null);
  const [penalidadePendente, setPenalidadePendente] =
    useState<PenalidadeDraft | null>(null);
  const [filhosAbertos, setFilhosAbertos] = useState<Record<string, boolean>>({});
  const [agora, setAgora] = useState(() => Date.now());
  const aberturaInicialAplicada = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setAgora(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const vigenciasOrdenadas = useMemo(
    () => [...vigencias].sort(compararVigencias),
    [vigencias],
  );
  const vigenciasEmAndamento = useMemo(
    () =>
      vigenciasOrdenadas.filter(
        (vigencia) => situacaoVigencia(vigencia, agora) === "andamento",
      ),
    [agora, vigenciasOrdenadas],
  );
  useEffect(() => {
    setDiasSelecionados((atual) => {
      const proximo = { ...atual };
      const idsAtivos = new Set(vigenciasEmAndamento.map((vigencia) => vigencia.id));
      let mudou = false;

      for (const id of Object.keys(proximo)) {
        if (!idsAtivos.has(Number(id))) {
          delete proximo[Number(id)];
          mudou = true;
        }
      }

      for (const vigencia of vigenciasEmAndamento) {
        if (!(vigencia.id in proximo)) {
          proximo[vigencia.id] = hoje;
          mudou = true;
        }
      }

      return mudou ? proximo : atual;
    });
  }, [hoje, vigenciasEmAndamento]);

  function datasDoPeriodoDaVigencia(vigencia: Vigencia) {
    const inicio = dataBrasil(vigencia.data_inicio);
    const fim = dataBrasil(vigencia.data_fim);
    const datas: string[] = [];
    let cursor = new Date(`${inicio}T12:00:00-03:00`);
    const limite = new Date(`${fim}T12:00:00-03:00`);

    while (cursor.getTime() <= limite.getTime()) {
      const ano = cursor.getFullYear();
      const mes = String(cursor.getMonth() + 1).padStart(2, "0");
      const dia = String(cursor.getDate()).padStart(2, "0");
      datas.push(`${ano}-${mes}-${dia}`);
      cursor.setDate(cursor.getDate() + 1);
    }

    return datas;
  }

  function rolarDias(vigenciaId: number, direcao: "esquerda" | "direita") {
    const area = diasScrollRefs.current[vigenciaId];
    if (!area) return;
    const distancia = Math.max(area.clientWidth * 0.75, 220);
    area.scrollBy({
      left: direcao === "direita" ? distancia : -distancia,
      behavior: "smooth",
    });
  }

  function rolarFilhos(vigenciaId: number, direcao: "esquerda" | "direita") {
    const area = filhosScrollRefs.current[vigenciaId];
    if (!area) return;
    const distancia = Math.max(area.clientWidth * 0.75, 220);
    area.scrollBy({
      left: direcao === "direita" ? distancia : -distancia,
      behavior: "smooth",
    });
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      for (const vigencia of vigenciasEmAndamento) {
        const dataSelecionada = diasSelecionados[vigencia.id];
        const area = diasScrollRefs.current[vigencia.id];
        if (!dataSelecionada || !area) continue;

        const alvo = area.querySelector<HTMLElement>(`[data-dia="${dataSelecionada}"]`);
        if (!alvo) continue;

        const destino =
          alvo.offsetLeft - (area.clientWidth - alvo.clientWidth) / 2;
        area.scrollTo({
          left: Math.max(0, destino),
          behavior: "smooth",
        });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [diasSelecionados, vigenciasEmAndamento]);

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

  const diaTemPendencia = (vigenciaId: number, data: string) => {
    if (data > hoje) return false;

    const atribuicoesDaVigencia = atribuicoes.filter(
      (tarefa) => tarefa.id_vigencia === vigenciaId,
    );

    return atribuicoesDaVigencia.some(
      (tarefa) => !registroNaData(tarefa, data),
    );
  };

  const datasDaTarefa = (tarefa: FilhoTarefa, vigencia: Vigencia) => {
    if (modo === "pendentes" && !vigenciaEmAndamento(vigencia)) return [];

    const datasGeradas = datasDaVigenciaAteHoje(vigencia, agoraBrasil);
    const datasComRegistro = ocorrenciasDaTarefa(tarefa).map((o) =>
      dataBrasil(o.created_at),
    );
    const datas = [...new Set([...datasGeradas, ...datasComRegistro])].sort(
      (a, b) => a.localeCompare(b),
    );
    const dataSelecionada = diasSelecionados[vigencia.id] ?? hoje;
    const datasFiltradas = datas.filter((data) => data === dataSelecionada);

    if (modo === "pendentes") {
      return datasFiltradas.filter((data) => !registroNaData(tarefa, data));
    }

    if (filtro.resultado === "FEZ") {
      return datasFiltradas.filter((data) => registroNaData(tarefa, data)?.tipo === "FEZ");
    }

    if (filtro.resultado === "NAO_FEZ") {
      return datasFiltradas.filter((data) => {
        const registro = registroNaData(tarefa, data);
        return Boolean(registro && registro.tipo !== "FEZ");
      });
    }

    return datasFiltradas;
  };

  const tarefasVisiveis = (vigencia: Vigencia, idFilho: number) => {
    const dataSelecionada = diasSelecionados[vigencia.id] ?? hoje;

    return atribuicoes
      .filter((tarefa) => {
        if (tarefa.id_vigencia !== vigencia.id || tarefa.id_filho !== idFilho) {
          return false;
        }
        if (filtro.tarefa !== "all" && tarefa.id_tarefa !== Number(filtro.tarefa)) {
          return false;
        }
        const temDatasVisiveis = datasDaTarefa(tarefa, vigencia).length > 0;
        if (
          filtro.resultado !== "all" ||
          diasSelecionados[vigencia.id]
        ) return temDatasVisiveis;
        return modo === "todos" || temDatasVisiveis;
      })
      .sort((a, b) => {
        const aMarcada = Boolean(registroNaData(a, dataSelecionada));
        const bMarcada = Boolean(registroNaData(b, dataSelecionada));

        if (aMarcada === bMarcada) return 0;
        return aMarcada ? 1 : -1;
      });
  };

  const idsVigenciasRascunho = new Set(
    vigenciasEmAndamento.map((vigencia) => vigencia.id),
  );
  const atribuicoesRascunho = atribuicoes.filter((item) =>
    idsVigenciasRascunho.has(item.id_vigencia),
  );
  const idsFilhosRascunho = new Set(atribuicoesRascunho.map((item) => item.id_filho));
  const filhosDisponiveisFiltro = filhos.filter((filho) =>
    idsFilhosRascunho.has(filho.id),
  );
  const atribuicoesRascunhoDoFilho = f.filho === "all"
    ? atribuicoesRascunho
    : atribuicoesRascunho.filter((item) => item.id_filho === Number(f.filho));
  const idsTarefasRascunho = new Set(
    atribuicoesRascunhoDoFilho.map((item) => item.id_tarefa),
  );
  const tarefasDisponiveisFiltro = tarefas.filter((tarefa) =>
    idsTarefasRascunho.has(tarefa.id),
  );

  function alterarFilhoFiltro(filho: string) {
    const atribuicoesDoFilho = filho === "all"
      ? atribuicoesRascunho
      : atribuicoesRascunho.filter((item) => item.id_filho === Number(filho));
    const idsTarefasAlvo = new Set(
      atribuicoesDoFilho.map((item) => item.id_tarefa),
    );
    const tarefa =
      f.tarefa === "all" || idsTarefasAlvo.has(Number(f.tarefa))
        ? f.tarefa
        : "all";

    setF({ ...f, filho, tarefa });
  }

  const filhosEstruturais = filhos.filter(
    (filho) =>
      filtro.filho === "all" || filho.id === Number(filtro.filho),
  );

  const tarefasEstruturais = (vigencia: Vigencia, idFilho: number) =>
    atribuicoes.filter((tarefa) => {
      if (tarefa.id_vigencia !== vigencia.id || tarefa.id_filho !== idFilho) {
        return false;
      }
      return (
        filtro.tarefa === "all" ||
        tarefa.id_tarefa === Number(filtro.tarefa)
      );
    });

  const vigenciasParaExibir = vigenciasEmAndamento
    .filter((vigencia) =>
      filhosEstruturais.some(
        (filho) => tarefasEstruturais(vigencia, filho.id).length > 0,
      ),
    );

  const grupos = vigenciasParaExibir
    .map((vigencia) => ({
      vigencia,
      filhos: filhosEstruturais
        .map((filho) => ({
          filho,
          tarefas: tarefasVisiveis(vigencia, filho.id),
        }))
        .filter((grupo) => grupo.tarefas.length > 0),
    }))
    .filter((grupo) => grupo.filhos.length > 0);
  const assinaturaGruposFilhos = grupos
    .map(
      ({ vigencia, filhos: gruposFilhos }) =>
        `${vigencia.id}:${gruposFilhos.map(({ filho }) => filho.id).join(",")}`,
    )
    .join("|");

  useEffect(() => {
    setFilhosSelecionados((atual) => {
      const proximo = { ...atual };
      const vigenciasComFilhos = new Set(grupos.map(({ vigencia }) => vigencia.id));
      let mudou = false;

      for (const id of Object.keys(proximo)) {
        if (!vigenciasComFilhos.has(Number(id))) {
          delete proximo[Number(id)];
          mudou = true;
        }
      }

      for (const { vigencia, filhos: gruposFilhos } of grupos) {
        const idsFilhos = new Set(gruposFilhos.map(({ filho }) => filho.id));
        const selecionado = proximo[vigencia.id];

        if (!selecionado || !idsFilhos.has(selecionado)) {
          proximo[vigencia.id] = gruposFilhos[0].filho.id;
          mudou = true;
        }
      }

      return mudou ? proximo : atual;
    });
  }, [assinaturaGruposFilhos]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      for (const vigencia of vigenciasEmAndamento) {
        const filhoSelecionado = filhosSelecionados[vigencia.id];
        const area = filhosScrollRefs.current[vigencia.id];
        if (!filhoSelecionado || !area) continue;

        const alvo = area.querySelector<HTMLElement>(
          `[data-filho="${filhoSelecionado}"]`,
        );
        if (!alvo) continue;

        const destino =
          alvo.offsetLeft - (area.clientWidth - alvo.clientWidth) / 2;
        area.scrollTo({
          left: Math.max(0, destino),
          behavior: "smooth",
        });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [filhosSelecionados, vigenciasEmAndamento]);

  useEffect(() => {
    if (isLoading || aberturaInicialAplicada.current || grupos.length === 0) return;

    setFilhosAbertos(
      Object.fromEntries(
        grupos.flatMap(({ vigencia, filhos: gruposFilhos }) =>
          gruposFilhos.map(({ filho }) => [
            `${vigencia.id}-${filho.id}`,
            true,
          ]),
        ),
      ),
    );

    aberturaInicialAplicada.current = true;
  }, [isLoading, grupos]);

  function dataValida(tarefa: FilhoTarefa, data: string) {
    const vigencia = tarefa.t_vigencia;
    return Boolean(
      vigencia && dataPertenceAVigenciaAteHoje(vigencia, data, hoje),
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
          `“Não fez” registrado · Desconto acumulado: ${reais(
            valorDebitado(filho, vigencia, resultado.novoTotal),
          )}`,
        );
      } else if (resultado.penalizado) {
        toast.warning(`Limite atingido! Penalidade: ${resultado.penalidade}`);
      } else {
        toast.success(
          `“Não fez” registrado (${resultado.novoTotal}/${vigencia.qtd_ocorrencia})`,
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

  function abrirEdicaoBonificacao(info: BonificacaoInfo) {
    const { tarefa, total, ocorrencia } = info;
    if (!tarefa.t_vigencia || !vigenciaEmAndamento(tarefa.t_vigencia)) {
      toast.error("Ações só podem ser feitas em uma vigência em andamento");
      return;
    }

    setBonificacaoInfo(null);
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

  function abrirTrocaMarcacao(
    tarefa: FilhoTarefa,
    total: number,
    data: string,
    registro: Ocorrencia,
  ) {
    if (!tarefa.t_vigencia || !vigenciaEmAndamento(tarefa.t_vigencia)) {
      toast.error("Ações só podem ser feitas em uma vigência em andamento");
      return;
    }

    if (registro.tipo === "FEZ") {
      setTroca({
        direcao: "PARA_NAO_FEZ",
        tarefa,
        total,
        ocorrencia: registro,
      });
      return;
    }

    setTroca({
      direcao: "PARA_FEZ",
      tarefa,
      total,
      ocorrencia: registro,
      fez: {
        modo: "REGISTRAR",
        ocorrenciaId: registro.id,
        tarefa,
        total,
        data,
        bonusTipo: "NENHUMA",
        descricao: "",
        valor: "",
      },
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
        ? valorBonificacaoNumero(draft.valor)
        : null;
    if (
      draft.bonusTipo === "VALOR" &&
      (valor === null || valor <= 0)
    ) {
      toast.error("Informe um valor de bonificação maior que zero");
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
          ? "“Fez” registrado"
          : "“Fez” registrado com bonificação",
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
        toast.error("Registro de “Fez” não encontrado");
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
        "Já existe um “Fez” para esta tarefa nesta data.",
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
          ? "Marcação desfeita"
          : "Marcações selecionadas desfeitas",
      );
    } catch (error) {
      toast.error(
        msgErro(error instanceof Error ? { message: error.message } : null),
      );
    } finally {
      setBusy(false);
    }
  }

  const filtrosAtivos =
    filtro.filho !== "all" ||
    filtro.tarefa !== "all" ||
    filtro.resultado !== "all";
  const vazio =
    vigenciasEmAndamento.length === 0
      ? "Não há vigência em andamento no momento."
      : modo === "pendentes"
        ? "Tudo em dia. Não há datas pendentes para os filtros selecionados."
        : filtrosAtivos
          ? "Nenhum resultado encontrado para os filtros selecionados."
          : 'Nenhuma tarefa encontrada. Crie atribuições na aba "Atribuições".';

  return (
    <>
      <PageHeader
        title="Fez / Não fez"
        description="Marque as tarefas do dia"
        icon={<ClipboardCheck className="h-6 w-6" />}
      />

      <ResponsiveFilters
        desktopClassName={modo === "todos" ? "md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]" : "md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"}
        onApply={() => setFiltro(f)}
        hasActiveFilters={filtrosAtivos}
        onClear={() => {
          const limpos = { filho: "all", tarefa: "all", resultado: "all" };
          setF(limpos);
          setFiltro(limpos);
        }}
        renderFilters={() => (
          <>
            <Pick
              label="Filho"
              childIcons
              value={f.filho}
              onChange={alterarFilhoFiltro}
              allLabel="Todos"
              options={filhosDisponiveisFiltro.map((filho) => ({
                value: String(filho.id),
                label: filho.nome,
                cor: filho.cor,
                avatar: filho.avatar === "menino" || filho.avatar === "menina" ? filho.avatar : null,
              }))}
            />
            <Pick
              label="Tarefa"
              taskIcons
              value={f.tarefa}
              onChange={(tarefa) => setF({ ...f, tarefa })}
              allLabel="Todas"
              options={tarefasDisponiveisFiltro.map((tarefa) => ({
                value: String(tarefa.id),
                label: tarefa.nome,
              }))}
            />
            {modo === "todos" && (
              <Pick
                label="Fez / Não fez"
                value={f.resultado}
                onChange={(resultado) => setF({ ...f, resultado })}
                allLabel="Todos"
                options={[
                  { value: "FEZ", label: "Fez" },
                  { value: "NAO_FEZ", label: "Não fez" },
                ]}
              />
            )}
          </>
        )}
      />

      {!isLoading && vigenciasParaExibir.length === 0 && (
        <EmptyState>{vazio}</EmptyState>
      )}

      <div className="space-y-8">
        {vigenciasParaExibir.map((vigencia) => {
          const gruposFilhos =
            grupos.find((grupo) => grupo.vigencia.id === vigencia.id)?.filhos ?? [];
          const filhoSelecionadoId =
            filhosSelecionados[vigencia.id] ?? gruposFilhos[0]?.filho.id;
          const grupoFilhoSelecionado =
            gruposFilhos.find(({ filho }) => filho.id === filhoSelecionadoId) ??
            gruposFilhos[0];
          const corFilhoSelecionado =
            grupoFilhoSelecionado?.filho.cor?.trim() || null;
          return (
            <section key={vigencia.id} className="space-y-3">
              <div className="flex min-w-0 items-start gap-2">
                <CalendarRange className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className={uiTypography.secondaryTitleStrongLargeDesktop}>
                      {fmtVigencia(vigencia)}
                    </h2>
                  </div>
                </div>
              </div>

              <div className="border-t pt-3 pb-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => rolarDias(vigencia.id, "esquerda")}
                    className="flex h-9 w-9 shrink-0 items-center justify-center bg-transparent p-0 text-muted-foreground transition-colors hover:bg-transparent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label="Ver dias anteriores"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <div
                    ref={(elemento) => {
                      diasScrollRefs.current[vigencia.id] = elemento;
                    }}
                    className="flex min-w-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain scroll-smooth px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    role="tablist"
                    aria-label={`Selecionar dia da vigência ${fmtVigencia(vigencia)}`}
                  >
                    {datasDoPeriodoDaVigencia(vigencia).map((data) => {
                      const selecionada = diasSelecionados[vigencia.id] === data;
                      const futura = data > hoje;
                      const comPendencia = !futura && diaTemPendencia(vigencia.id, data);
                      return (
                        <button
                          key={data}
                          data-dia={data}
                          type="button"
                          role="tab"
                          aria-selected={selecionada}
                          disabled={futura}
                          onClick={() =>
                            !futura &&
                            setDiasSelecionados((atual) => ({
                              ...atual,
                              [vigencia.id]: data,
                            }))
                          }
                          className={`relative shrink-0 snap-start rounded-lg px-2.5 py-2 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                            futura
                              ? "cursor-not-allowed border-b-2 border-transparent bg-transparent text-muted-foreground/40"
                              : selecionada
                                ? "border-b-2 border-muted-foreground/80 bg-transparent text-foreground"
                                : "border-b-2 border-transparent bg-transparent text-foreground hover:bg-transparent"
                          }`}
                          style={
                            selecionada && !futura && corFilhoSelecionado
                              ? { borderBottomColor: corFilhoSelecionado }
                              : undefined
                          }
                        >
                          {formatarDataCurta(data)}
                          {comPendencia && (
                            <span
                              aria-hidden="true"
                              className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-red-500"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => rolarDias(vigencia.id, "direita")}
                    className="flex h-9 w-9 shrink-0 items-center justify-center bg-transparent p-0 text-muted-foreground transition-colors hover:bg-transparent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label="Ver próximos dias"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {gruposFilhos.length === 0 ? (
                <EmptyState>
                  {modo === "pendentes"
                    ? "Tudo em dia para esta data e filtros."
                    : "Nenhum resultado encontrado para esta data e filtros."}
                </EmptyState>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-1 border-t pt-3 pb-1">
                    <button
                      type="button"
                      onClick={() => rolarFilhos(vigencia.id, "esquerda")}
                      className="flex h-9 w-9 shrink-0 items-center justify-center bg-transparent p-0 text-muted-foreground transition-colors hover:bg-transparent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      aria-label="Ver filhos anteriores"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    <div
                      ref={(elemento) => {
                        filhosScrollRefs.current[vigencia.id] = elemento;
                      }}
                      className="flex min-w-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain scroll-smooth px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      role="tablist"
                      aria-label={`Selecionar filho da vigência ${fmtVigencia(vigencia)}`}
                    >
                      {gruposFilhos.map(({ filho }) => {
                        const selecionado = filho.id === filhoSelecionadoId;
                        return (
                          <button
                            key={filho.id}
                            data-filho={filho.id}
                            type="button"
                            role="tab"
                            aria-selected={selecionado}
                            onClick={() =>
                              setFilhosSelecionados((atual) => ({
                                ...atual,
                                [vigencia.id]: filho.id,
                              }))
                            }
                            className={`shrink-0 snap-start rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                              selecionado
                                ? "border-b-2 border-muted-foreground/80 bg-transparent text-foreground"
                                : "border-b-2 border-transparent bg-transparent text-foreground hover:bg-transparent"
                            }`}
                            style={
                              selecionado && filho.cor?.trim()
                                ? { borderBottomColor: filho.cor.trim() }
                                : undefined
                            }
                          >
                            <span className="flex items-center gap-1.5">
                              <FilhoAvatar nome={filho.nome} cor={filho.cor} avatar={filho.avatar === "menino" || filho.avatar === "menina" ? filho.avatar : null} className="h-5 w-5" />
                              <span>{filho.nome}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => rolarFilhos(vigencia.id, "direita")}
                      className="flex h-9 w-9 shrink-0 items-center justify-center bg-transparent p-0 text-muted-foreground transition-colors hover:bg-transparent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      aria-label="Ver próximos filhos"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  {grupoFilhoSelecionado &&
                    [grupoFilhoSelecionado].map(({ filho, tarefas: tarefasDoFilho }) => {
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
                    const totalDescontado = comDesconto
                      ? valorDebitado(filho, vigencia, totalNaoFez)
                      : 0;
                    const saldoMesada = Math.max(
                      0,
                      (filho.valor_mesada ?? 0) - totalDescontado,
                    );
                    const penalizado =
                      !comDesconto &&
                      totalNaoFez >= vigencia.qtd_ocorrencia;
                    const dataSelecionada = diasSelecionados[vigencia.id] ?? hoje;
                    const bloqueada = !vigenciaEmAndamento(vigencia);
                    const registrosDoDia = tarefasDoFilho
                      .map((tarefa) => ({
                        tarefa,
                        registro: registroNaData(tarefa, dataSelecionada),
                      }))
                      .filter(
                        (item): item is { tarefa: FilhoTarefa; registro: Ocorrencia } =>
                          Boolean(item.registro),
                      );
                    const selecionadasDoFilho = registrosDoDia.filter(({ registro }) =>
                      selecionadas.has(registro.id),
                    );

                    return (
                      <article
                        key={filho.id}
                        className="overflow-hidden rounded-xl border bg-background"
                      >
                        <button
                          type="button"
                          className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 bg-white px-4 py-3 text-left dark:bg-background"
                          onClick={() =>
                            setFilhosAbertos((atual) => ({
                              ...atual,
                              [chave]: !filhoAberto,
                            }))
                          }
                        >
                          <CollapseChevron open={filhoAberto} />
                          <div className="min-w-0">
                            <h3
                              className={`truncate tabular-nums ${uiTypography.secondaryTitleStrong}`}
                            >
                              {formatarData(dataSelecionada)}
                            </h3>
                          </div>
                          <div className="flex shrink-0 flex-col items-end justify-center gap-0.5 text-sm">
                            {modo === "pendentes" && (
                              <span className="font-semibold text-primary tabular-nums">
                                {totalPendencias}{" "}
                                {totalPendencias === 1
                                  ? "pendência"
                                  : "pendências"}
                              </span>
                            )}
                            {comDesconto ? (
                              <span className="font-semibold text-muted-foreground">
                                Com mesada
                              </span>
                            ) : (
                              <span className="font-semibold tabular-nums">
                                Não fez: {totalNaoFez} de{" "}
                                {vigencia.qtd_ocorrencia}
                              </span>
                            )}
                          </div>
                        </button>

                        {filhoAberto && (
                          <div className="border-t bg-white p-3 dark:bg-background sm:p-4">
                            {comDesconto ? (
                              <div className="mb-4 grid grid-cols-3 overflow-hidden rounded-lg border bg-muted/20 text-sm tabular-nums">
                                <div className="px-3 py-2.5">
                                  <p className="text-[11px] font-medium text-muted-foreground">Mesada</p>
                                  <p className="mt-0.5 font-semibold">{reais(filho.valor_mesada ?? 0)}</p>
                                </div>
                                <div className="border-l px-3 py-2.5">
                                  <p className="text-[11px] font-medium text-muted-foreground">Descontos</p>
                                  <p className="mt-0.5 font-semibold text-destructive">-{reais(totalDescontado)}</p>
                                </div>
                                <div className="border-l px-3 py-2.5">
                                  <p className="text-[11px] font-medium text-muted-foreground">Saldo atual</p>
                                  <p className="mt-0.5 font-semibold text-primary">{reais(saldoMesada)}</p>
                                </div>
                              </div>
                            ) : penalizado ? (
                              <div className="mb-4">
                                <Badge variant="destructive" className="px-3 py-1 text-[13px] font-bold">
                                  <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                                  Penalidade: {vigencia.penalidade}
                                </Badge>
                              </div>
                            ) : null}

                            <div className="bg-white dark:bg-background">
                              <div className="border-b border-border/60 bg-transparent px-1 py-2.5">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex min-w-0 items-baseline gap-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      Tarefa(s)
                                    </p>
                                  </div>

                                  {!bloqueada && registrosDoDia.length > 0 && (
                                    <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
                                      <span>Desfazer marcação</span>
                                      <Checkbox
                                        className={checkboxExclusaoClass}
                                        checked={
                                          registrosDoDia.every(({ registro }) =>
                                            selecionadas.has(registro.id),
                                          )
                                            ? true
                                            : registrosDoDia.some(({ registro }) =>
                                                  selecionadas.has(registro.id),
                                                )
                                              ? "indeterminate"
                                              : false
                                        }
                                        onCheckedChange={(checked) =>
                                          setSelecionadas((atual) => {
                                            const proximo = new Set(atual);
                                            if (checked === true) {
                                              registrosDoDia.forEach(({ registro }) =>
                                                proximo.add(registro.id),
                                              );
                                            } else {
                                              registrosDoDia.forEach(({ registro }) =>
                                                proximo.delete(registro.id),
                                              );
                                            }
                                            return proximo;
                                          })
                                        }
                                        aria-label={`Selecionar todas as marcações para desfazer de ${formatarData(dataSelecionada)}`}
                                      />
                                    </label>
                                  )}
                                </div>

                                {!bloqueada &&
                                  selecionadasDoFilho.length > 0 && (
                                    <div className="mt-2 flex justify-end">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-muted-foreground hover:text-foreground"
                                        disabled={busy}
                                        onClick={() =>
                                          setConfirmarExcluirSelecionadas({
                                            tarefa: selecionadasDoFilho[0].tarefa,
                                            ids: selecionadasDoFilho.map(({ registro }) => registro.id),
                                          })
                                        }
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        Desfazer marcação ({selecionadasDoFilho.length})
                                      </Button>
                                    </div>
                                  )}
                              </div>

                              <div className="divide-y divide-border/60">
                                {tarefasDoFilho.map((tarefa) => {
                                  const registro = registroNaData(tarefa, dataSelecionada);
                                  return (
                                    <div
                                      key={tarefa.id}
                                      className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-1 py-3"
                                    >
                                      <div className="flex min-w-0 items-center gap-2">
                                        <div
                                          className={`flex min-w-0 items-start gap-2 ${
                                            registro
                                              ? "w-36 shrink-0 sm:w-48 md:w-56 lg:w-64"
                                              : "flex-1"
                                          }`}
                                        >
                                          <TarefaIcone
                                            nome={tarefa.t_tarefa?.nome ?? "Tarefa"}
                                            className={`mt-0.5 ${
                                              registro
                                                ? registro.tipo === "FEZ"
                                                  ? "text-green-700 dark:text-green-300"
                                                  : "text-red-700 dark:text-red-300"
                                                : ""
                                            }`}
                                          />
                                          <p
                                            className={`min-w-0 break-words text-sm font-medium leading-tight ${
                                              registro
                                                ? registro.tipo === "FEZ"
                                                  ? "text-green-700 dark:text-green-300"
                                                  : "text-red-700 dark:text-red-300"
                                                : ""
                                            }`}
                                          >
                                            {tarefa.t_tarefa?.nome}
                                          </p>
                                        </div>
                                        {registro && (
                                          <>
                                            <Hint content={registro.tipo === "FEZ" ? "Fez" : "Não fez"}>
                                              <span
                                                className={
                                                  registro.tipo === "FEZ"
                                                    ? "inline-flex shrink-0 items-center justify-center text-green-600 dark:text-green-400"
                                                    : "inline-flex shrink-0 items-center justify-center text-red-600 dark:text-red-400"
                                                }
                                              >
                                                {registro.tipo === "FEZ" ? (
                                                  <ThumbsUp className="h-3.5 w-3.5" />
                                                ) : (
                                                  <ThumbsDown className="h-3.5 w-3.5" />
                                                )}
                                                <span className="sr-only">
                                                  {registro.tipo === "FEZ" ? "Fez" : "Não fez"}
                                                </span>
                                              </span>
                                            </Hint>
                                            <button
                                              type="button"
                                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/50 text-muted-foreground shadow-sm transition-all duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                              aria-label={
                                                acoesAbertas.has(`${tarefa.id}:${dataSelecionada}`)
                                                  ? "Ocultar ações da tarefa"
                                                  : "Mostrar ações da tarefa"
                                              }
                                              aria-expanded={acoesAbertas.has(
                                                `${tarefa.id}:${dataSelecionada}`,
                                              )}
                                              onClick={() => {
                                                const chave = `${tarefa.id}:${dataSelecionada}`;
                                                setAcoesAbertas((atual) => {
                                                  const proximo = new Set(atual);
                                                  if (proximo.has(chave)) {
                                                    proximo.delete(chave);
                                                  } else {
                                                    proximo.add(chave);
                                                  }
                                                  return proximo;
                                                });
                                              }}
                                            >
                                              {acoesAbertas.has(
                                                `${tarefa.id}:${dataSelecionada}`,
                                              ) ? (
                                                <X className="h-4 w-4" />
                                              ) : (
                                                <ChevronRight className="h-4 w-4" />
                                              )}
                                            </button>
                                          </>
                                        )}
                                        {registro &&
                                          registro.tipo !== "FEZ" &&
                                          !comDesconto &&
                                          penalizadas.has(registro.id) && (
                                            <span
                                              className="inline-flex shrink-0 text-destructive"
                                              role="img"
                                              aria-label="Limite de penalidade atingido"
                                            >
                                              <AlertTriangle className="h-4 w-4" />
                                            </span>
                                          )}
                                      </div>

                                      <div className="flex shrink-0 items-center justify-end gap-3 sm:gap-2">
                                        {!registro && !bloqueada && (
                                          <>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className={`min-w-0 px-2.5 sm:min-w-24 sm:px-3 ${botaoFezClass}`}
                                              disabled={busy}
                                              onClick={() =>
                                                abrirFez(
                                                  tarefa,
                                                  totalNaoFez,
                                                  dataSelecionada,
                                                )
                                              }
                                            >
                                              <ThumbsUp className="h-4 w-4 text-green-600" />
                                              Fez
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className={`min-w-0 px-2.5 sm:min-w-24 sm:px-3 ${botaoNaoFezClass}`}
                                              disabled={busy}
                                              onClick={() =>
                                                solicitarNaoFez(
                                                  tarefa,
                                                  totalNaoFez,
                                                  dataSelecionada,
                                                )
                                              }
                                            >
                                              <ThumbsDown className="h-4 w-4 text-red-600" />
                                              Não fez
                                            </Button>
                                          </>
                                        )}

                                        {registro && (
                                          <>
                                            <div
                                              className={`flex w-[76px] shrink-0 items-center justify-end gap-3 overflow-hidden transition-all duration-300 ease-out sm:w-[72px] sm:gap-2 ${
                                                acoesAbertas.has(
                                                  `${tarefa.id}:${dataSelecionada}`,
                                                )
                                                  ? "translate-x-0 opacity-100"
                                                  : "pointer-events-none translate-x-2 opacity-0"
                                              }`}
                                              aria-hidden={
                                                !acoesAbertas.has(
                                                  `${tarefa.id}:${dataSelecionada}`,
                                                )
                                              }
                                            >
                                              {!bloqueada && (
                                                <Hint
                                                  content={
                                                    registro.tipo === "FEZ"
                                                      ? "Alterar para Não fez"
                                                      : "Alterar para Fez"
                                                  }
                                                >
                                                  <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-8 w-8 shrink-0 rounded-md"
                                                    disabled={busy}
                                                    aria-label={
                                                      registro.tipo === "FEZ"
                                                        ? "Alterar marcação para Não fez"
                                                        : "Alterar marcação para Fez"
                                                    }
                                                    onClick={() =>
                                                      abrirTrocaMarcacao(
                                                        tarefa,
                                                        totalNaoFez,
                                                        dataSelecionada,
                                                        registro,
                                                      )
                                                    }
                                                  >
                                                    <Pencil className="h-4 w-4" />
                                                  </Button>
                                                </Hint>
                                              )}

                                              {registro.tipo === "FEZ" && (
                                                <Hint content="Ver bonificação">
                                                  <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-8 w-8 shrink-0 rounded-md"
                                                    disabled={busy}
                                                    aria-label="Ver bonificação"
                                                    onClick={() =>
                                                      setBonificacaoInfo({
                                                        tarefa,
                                                        total: totalNaoFez,
                                                        ocorrencia: registro,
                                                      })
                                                    }
                                                  >
                                                    <Info className="h-4 w-4" />
                                                  </Button>
                                                </Hint>
                                              )}
                                            </div>

                                            {!bloqueada && (
                                              <Checkbox
                                                className={checkboxExclusaoClass}
                                                checked={selecionadas.has(registro.id)}
                                                onCheckedChange={(checked) =>
                                                  setSelecionadas((atual) => {
                                                    const proximo = new Set(atual);
                                                    if (checked === true) {
                                                      proximo.add(registro.id);
                                                    } else {
                                                      proximo.delete(registro.id);
                                                    }
                                                    return proximo;
                                                  })
                                                }
                                                aria-label={`Selecionar ${registro.tipo === "FEZ" ? "Fez" : "Não fez"} de ${formatarData(dataSelecionada)}`}
                                              />
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
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
        contexto={penalidadePendente ? (() => {
          const filho = filhoDaTarefa(penalidadePendente.tarefa);
          return (
            <span className="inline-flex max-w-full min-w-0 items-center gap-1.5">
              {filho && <FilhoAvatar nome={filho.nome} cor={filho.cor} avatar={filho.avatar === "menino" || filho.avatar === "menina" ? filho.avatar : null} className="h-5 w-5" />}
              <span className="min-w-0 whitespace-normal break-words">{filho?.nome ?? "Filho"}</span>
            </span>
          );
        })() : undefined}
        limite={penalidadePendente?.tarefa.t_vigencia?.qtd_ocorrencia ?? null}
        onChange={(descricao) =>
          setPenalidadePendente((atual) =>
            atual ? { ...atual, descricao } : atual,
          )
        }
        onCancel={() => setPenalidadePendente(null)}
        onConfirm={() => void runAction(confirmarPenalidade)}
      />

      <Dialog
        open={Boolean(bonificacaoInfo)}
        onOpenChange={(open) => !open && setBonificacaoInfo(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bonificação do “Fez”</DialogTitle>
            <DialogDescription>
              {bonificacaoInfo && (() => {
                const filho = filhoDaTarefa(bonificacaoInfo.tarefa);
                return (
                  <span className="block max-w-full min-w-0 overflow-hidden rounded-lg border bg-muted/20">
                    <span className="flex min-w-0 items-center gap-2 px-3 py-2.5">
                      {filho && (
                        <FilhoAvatar
                          nome={filho.nome}
                          cor={filho.cor}
                          avatar={filho.avatar === "menino" || filho.avatar === "menina" ? filho.avatar : null}
                          className="h-5 w-5"
                        />
                      )}
                      <span className="min-w-0">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Filho</span>
                        <span className="block min-w-0 whitespace-normal break-words font-medium text-foreground">{filho?.nome ?? "Filho"}</span>
                      </span>
                    </span>
                    <span className="block border-t px-3 py-2.5">
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tarefa</span>
                      <span className="mt-0.5 flex min-w-0 items-start gap-2">
                        <TarefaIcone nome={bonificacaoInfo.tarefa.t_tarefa?.nome ?? "Tarefa"} className="mt-0.5" />
                        <span className="min-w-0 whitespace-normal break-words font-medium text-foreground">{bonificacaoInfo.tarefa.t_tarefa?.nome}</span>
                      </span>
                    </span>
                    <span className="block border-t px-3 py-2.5">
                      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Data</span>
                      <span className="mt-0.5 block font-medium text-foreground">{formatarData(dataBrasil(bonificacaoInfo.ocorrencia.created_at))}</span>
                    </span>
                  </span>
                );
              })()}
            </DialogDescription>
          </DialogHeader>

          {bonificacaoInfo && (
            <div className="rounded-lg border bg-muted/20 p-4">
              {bonificacaoInfo.ocorrencia.bonificacao_tipo === "TEXTO" ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Bonificação escrita
                  </p>
                  <p className="text-sm font-medium">
                    {bonificacaoInfo.ocorrencia.bonificacao_descricao}
                  </p>
                </div>
              ) : bonificacaoInfo.ocorrencia.bonificacao_tipo === "VALOR" ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Valor da bonificação
                  </p>
                  <p className="text-base font-semibold">
                    {reais(Number(bonificacaoInfo.ocorrencia.bonificacao_valor ?? 0))}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma bonificação definida.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBonificacaoInfo(null)}
            >
              Fechar
            </Button>
            {bonificacaoInfo && (
              <Button
                disabled={busy}
                onClick={() => abrirEdicaoBonificacao(bonificacaoInfo)}
              >
                <Pencil className="h-4 w-4" />
                Editar bonificação
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              {fez && (() => {
                const filho = filhoDaTarefa(fez.tarefa);

                if (fez.modo !== "EDITAR") {
                  return (
                    <>
                      <span className="inline-flex max-w-full min-w-0 items-start gap-1.5">
                        {filho && <FilhoAvatar nome={filho.nome} cor={filho.cor} avatar={filho.avatar === "menino" || filho.avatar === "menina" ? filho.avatar : null} className="h-5 w-5" />}
                        <span className="min-w-0 whitespace-normal break-words">{filho?.nome ?? "Filho"} ·</span>
                        <TarefaIcone nome={fez.tarefa.t_tarefa?.nome ?? "Tarefa"} className="mt-0.5" />
                        <span className="min-w-0 whitespace-normal break-words">{fez.tarefa.t_tarefa?.nome} · {formatarData(fez.data)}</span>
                      </span>
                      {" · "}A bonificação é opcional.
                    </>
                  );
                }

                return (
                  <span className="block space-y-2.5">
                    <span className="block max-w-full min-w-0 overflow-hidden rounded-lg border bg-muted/20">
                      <span className="flex min-w-0 items-center gap-2 px-3 py-2.5">
                        {filho && (
                          <FilhoAvatar
                            nome={filho.nome}
                            cor={filho.cor}
                            avatar={filho.avatar === "menino" || filho.avatar === "menina" ? filho.avatar : null}
                            className="h-5 w-5"
                          />
                        )}
                        <span className="min-w-0">
                          <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Filho</span>
                          <span className="block min-w-0 whitespace-normal break-words font-medium text-foreground">{filho?.nome ?? "Filho"}</span>
                        </span>
                      </span>
                      <span className="block border-t px-3 py-2.5">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tarefa</span>
                        <span className="mt-0.5 flex min-w-0 items-start gap-2">
                          <TarefaIcone nome={fez.tarefa.t_tarefa?.nome ?? "Tarefa"} className="mt-0.5" />
                          <span className="min-w-0 whitespace-normal break-words font-medium text-foreground">{fez.tarefa.t_tarefa?.nome}</span>
                        </span>
                      </span>
                      <span className="block border-t px-3 py-2.5">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Data</span>
                        <span className="mt-0.5 block font-medium text-foreground">{formatarData(fez.data)}</span>
                      </span>
                    </span>
                    <span className="block">A bonificação é opcional.</span>
                  </span>
                );
              })()}
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
                    valueMode="decimal"
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
          <DialogHeader className="space-y-3">
            <DialogTitle>
              {troca?.direcao === "PARA_FEZ"
                ? "Alterar para “Fez”?"
                : "Alterar para “Não fez”?"}
            </DialogTitle>
            <DialogDescription className="space-y-3">
              {troca && (
                <>
                  {(() => {
                    const filho = filhoDaTarefa(troca.tarefa);
                    return (
                      <span className="block max-w-full min-w-0 overflow-hidden rounded-lg border bg-muted/20">
                        <span className="flex min-w-0 items-center gap-2 px-3 py-2.5">
                          {filho && (
                            <FilhoAvatar
                              nome={filho.nome}
                              cor={filho.cor}
                              avatar={filho.avatar === "menino" || filho.avatar === "menina" ? filho.avatar : null}
                              className="h-5 w-5"
                            />
                          )}
                          <span className="min-w-0">
                            <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Filho
                            </span>
                            <span className="block min-w-0 whitespace-normal break-words font-medium text-foreground">
                              {filho?.nome ?? "Filho"}
                            </span>
                          </span>
                        </span>
                        <span className="block border-t px-3 py-2.5">
                          <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Tarefa
                          </span>
                          <span className="mt-0.5 flex min-w-0 items-start gap-2">
                            <TarefaIcone nome={troca.tarefa.t_tarefa?.nome ?? "Tarefa"} className="mt-0.5" />
                            <span className="min-w-0 whitespace-normal break-words font-medium text-foreground">
                              {troca.tarefa.t_tarefa?.nome}
                            </span>
                          </span>
                        </span>
                      </span>
                    );
                  })()}

                  <span className="block rounded-lg bg-muted/15 px-3 py-2.5 leading-relaxed">
                    Esta tarefa está marcada como{" "}
                    <span className="font-medium text-foreground">
                      {troca.direcao === "PARA_FEZ" ? "“Não fez”" : "“Fez”"}
                    </span>{" "}
                    em{" "}
                    <span className="font-medium text-foreground">
                      {formatarData(dataBrasil(troca.ocorrencia.created_at))}
                    </span>
                    . Ao continuar, o resultado será substituído
                    {troca.direcao === "PARA_NAO_FEZ"
                      ? " e qualquer bonificação será removida"
                      : ""}
                    .
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {troca?.direcao === "PARA_FEZ" && troca.fez && (
            <div className="space-y-4 rounded-xl border bg-muted/10 p-3.5 sm:p-4">
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
                    valueMode="decimal"
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
            <DialogTitle>Desfazer marcações selecionadas?</DialogTitle>
            <DialogDescription className="pt-1">
              {confirmarExcluirSelecionadas && (() => {
                const filho = filhoDaTarefa(confirmarExcluirSelecionadas.tarefa);
                const quantidade = confirmarExcluirSelecionadas.ids.length;
                return (
                  <span className="block space-y-3">
                    <span className="flex max-w-full min-w-0 items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2.5">
                      {filho && (
                        <FilhoAvatar
                          nome={filho.nome}
                          cor={filho.cor}
                          avatar={filho.avatar === "menino" || filho.avatar === "menina" ? filho.avatar : null}
                          className="h-5 w-5"
                        />
                      )}
                      <span className="min-w-0 whitespace-normal break-words font-medium text-foreground">
                        {filho?.nome ?? "Filho"}
                      </span>
                    </span>

                    <span className="block">
                      <span className="block font-medium text-foreground">
                        {quantidade} {quantidade === 1 ? "marcação selecionada será desfeita" : "marcações selecionadas serão desfeitas"}.
                      </span>
                      <span className="mt-1.5 block leading-relaxed">
                        As datas que ficarem sem uma marcação de “Fez” ou “Não fez” voltarão para as pendências.
                      </span>
                    </span>
                  </span>
                );
              })()}
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
