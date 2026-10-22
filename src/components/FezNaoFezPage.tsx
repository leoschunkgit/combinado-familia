import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BellRing,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  EllipsisVertical,
  Info,
  Pencil,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  useRevisoesTarefaFilho,
  useSolicitacoesTarefaFilho,
  useVigencias,
  useTarefas,
  type FilhoTarefa,
  type Ocorrencia,
  type Vigencia,
} from "@/lib/db";
import { reais } from "@/lib/mesada";
import {
  consequenciaEhDescontoAplicado,
  consequenciaEhPenalidadeCumprida,
  consequenciaEhPenalidadePendente,
  descreverConsequenciaOcorrencia,
} from "@/lib/ocorrencia-model";
import {
  cumprirPenalidade,
  desfazerOcorrencias,
  registrarFez,
  registrarNaoFez,
  resolverRevisao,
  type ConsequenciaNaoFezTipo,
} from "@/lib/ocorrencia-service";
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
import { NaoFezDialog, type NaoFezDraft } from "@/components/NaoFezDialog";
import {
  dataBrasil,
  dataPertenceAVigenciaAteHoje,
  datasDaVigenciaAteHoje,
  useDataBrasilAtual,
} from "@/lib/notificacoes";
import { notificarRespostaFilho } from "@/lib/child-response-notifications";

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

type NaoFezPageDraft = NaoFezDraft & {
  tarefa: FilhoTarefa;
  total: number;
  existente?: Ocorrencia;
};

export type FocoSolicitacaoTarefa = {
  idFilho?: number;
  idFilhoTarefa?: number;
  data?: string;
  idSolicitacao?: number;
  idRevisao?: number;
};

type FezNaoFezPageProps = {
  modo: ModoPagina;
  focoSolicitacao?: FocoSolicitacaoTarefa;
};

function formatarData(data: string) {
  return data.split("-").reverse().join("/");
}

function primeiroNomeFilho(nome?: string | null) {
  return nome?.trim().split(/\s+/)[0] || "Filho";
}

function formatarDataCurta(data: string) {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano.slice(-2)}`;
}

function formatarHora(data: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(data));
}

function valorBonificacaoNumero(valor: string) {
  if (!valor.trim()) return null;
  const numero = Number(valor.replace(",", "."));
  if (!Number.isFinite(numero)) return null;
  return Math.round(numero * 100) / 100;
}

export function FezNaoFezPage({ modo, focoSolicitacao }: FezNaoFezPageProps) {
  const qc = useQueryClient();
  const { runAction } = useActionLoading();
  const { data: vigencias = [] } = useVigencias();
  const { data: filhos = [] } = useFilhos();
  const { data: atribuicoes = [], isLoading } = useFilhoTarefas();
  const { data: tarefas = [] } = useTarefas();
  const { data: ocorrencias = [] } = useOcorrencias();
  const { data: solicitacoesTarefaFilho = [] } = useSolicitacoesTarefaFilho();
  const { data: revisoesTarefaFilho = [] } = useRevisoesTarefaFilho();
  const hoje = useDataBrasilAtual();
  const agoraBrasil = new Date(hoje + "T12:00:00-03:00");

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
  const [confirmarExcluirSelecionadas, setConfirmarExcluirSelecionadas] =
    useState<ExcluirSelecionadasDraft | null>(null);
  const [naoFez, setNaoFez] = useState<NaoFezPageDraft | null>(null);
  const [filhosAbertos, setFilhosAbertos] = useState<Record<string, boolean>>({});
  const [totaisEstrelas, setTotaisEstrelas] = useState<Record<number, number>>({});
  const [agora, setAgora] = useState(() => Date.now());
  const aberturaInicialAplicada = useRef(false);
  const ultimoFocoAplicado = useRef<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setAgora(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let ativo = true;

    async function carregarTotaisEstrelas() {
      const idsFilhos = filhos.map((filho) => filho.id);
      if (idsFilhos.length === 0) {
        setTotaisEstrelas({});
        return;
      }

      const totais: Record<number, number> = {};

      await Promise.all(
        idsFilhos.map(async (idFilho) => {
          const { data, error } = await supabase.rpc("resumo_estrelas_filho", {
            p_id_filho: idFilho,
          });

          if (error) return;

          const resumo = data as { total_conquistado?: number } | null;
          totais[idFilho] = Number(resumo?.total_conquistado ?? 0);
        }),
      );

      if (ativo) setTotaisEstrelas(totais);
    }

    void carregarTotaisEstrelas();
    return () => {
      ativo = false;
    };
  }, [filhos, ocorrencias]);

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

  const solicitacaoNaData = (tarefa: FilhoTarefa, data: string) =>
    solicitacoesTarefaFilho.find(
      (s) =>
        s.id_filho_tarefa === tarefa.id &&
        s.data_referencia === data &&
        s.status === "PENDENTE",
    );

  const revisaoNaData = (tarefa: FilhoTarefa, data: string) => {
    const registro = registroNaData(tarefa, data);
    return registro
      ? revisoesTarefaFilho.find(
          (revisao) => revisao.id_ocorrencia === registro.id,
        )
      : undefined;
  };

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

  const tarefasVisiveis = (vigencia: Vigencia, idFilho: number) =>
    atribuicoes.filter((tarefa) => {
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
    });

  useEffect(() => {
    if (!focoSolicitacao?.idFilhoTarefa || isLoading) return;

    const chaveFoco = [
      focoSolicitacao.idFilhoTarefa,
      focoSolicitacao.data ?? "",
      focoSolicitacao.idSolicitacao ?? "",
      focoSolicitacao.idRevisao ?? "",
    ].join(":");

    if (ultimoFocoAplicado.current === chaveFoco) return;

    const atribuicao = atribuicoes.find(
      (item) => item.id === focoSolicitacao.idFilhoTarefa,
    );
    if (!atribuicao) return;

    const vigencia = vigencias.find((item) => item.id === atribuicao.id_vigencia);
    if (!vigencia || !vigenciaEmAndamento(vigencia)) return;

    const dataFoco =
      focoSolicitacao.data &&
      dataPertenceAVigenciaAteHoje(vigencia, focoSolicitacao.data, hoje)
        ? focoSolicitacao.data
        : hoje;

    const proximoFiltro = {
      filho: String(atribuicao.id_filho),
      tarefa: String(atribuicao.id_tarefa),
      resultado: "all",
    };

    setF(proximoFiltro);
    setFiltro(proximoFiltro);
    setDiasSelecionados((atual) => ({ ...atual, [vigencia.id]: dataFoco }));
    setFilhosSelecionados((atual) => ({
      ...atual,
      [vigencia.id]: atribuicao.id_filho,
    }));
    setFilhosAbertos((atual) => ({
      ...atual,
      [`${vigencia.id}-${atribuicao.id_filho}`]: true,
    }));

    ultimoFocoAplicado.current = chaveFoco;
  }, [atribuicoes, focoSolicitacao, hoje, isLoading, vigencias]);

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

    setFilhosAbertos((atual) =>
      Object.fromEntries(
        grupos.flatMap(({ vigencia, filhos: gruposFilhos }) =>
          gruposFilhos.map(({ filho }) => {
            const chave = `${vigencia.id}-${filho.id}`;
            return [chave, atual[chave] === true];
          }),
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

  function abrirNaoFez(
    tarefa: FilhoTarefa,
    total: number,
    data: string,
    existente?: Ocorrencia,
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

    const filho = filhoDaTarefa(tarefa);
    if (!filho) {
      toast.error("Filho não encontrado");
      return;
    }

    const consequenciaAtual = existente?.t_ocorrencia_consequencia;
    const temMesada =
      filho.tem_mesada_opcional === true && filho.valor_mesada !== null;
    const tipoAtual: ConsequenciaNaoFezTipo =
      consequenciaAtual?.tipo === "DESCONTO" && temMesada
        ? "DESCONTO"
        : consequenciaAtual?.tipo === "PENALIDADE"
          ? "PENALIDADE"
          : "NENHUMA";

    setNaoFez({
      tarefa,
      total,
      data,
      existente,
      filhoNome: filho.nome,
      filhoCor: filho.cor,
      filhoAvatar: filho.avatar,
      tarefaNome: tarefa.t_tarefa?.nome ?? "Tarefa",
      temMesada,
      consequenciaTipo: tipoAtual,
      descontoValor:
        tipoAtual === "DESCONTO" && consequenciaAtual?.desconto_valor != null
          ? String(consequenciaAtual.desconto_valor).replace(".", ",")
          : "",
      penalidadeDescricao:
        tipoAtual === "PENALIDADE"
          ? consequenciaAtual?.penalidade_descricao ?? ""
          : "",
    });
  }

  async function salvarNaoFez(draft: NaoFezPageDraft) {
    const { tarefa, data, existente } = draft;
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

    const descontoValor =
      draft.consequenciaTipo === "DESCONTO"
        ? valorBonificacaoNumero(draft.descontoValor)
        : null;

    if (
      draft.consequenciaTipo === "DESCONTO" &&
      (descontoValor === null || descontoValor <= 0)
    ) {
      toast.error("Informe um valor de desconto maior que zero");
      return;
    }

    if (
      draft.consequenciaTipo === "PENALIDADE" &&
      (draft.penalidadeDescricao.trim().length < 2 ||
        draft.penalidadeDescricao.trim().length > 200)
    ) {
      toast.error("Informe uma penalidade entre 2 e 200 caracteres");
      return;
    }

    const solicitacaoPendente = solicitacaoNaData(tarefa, data);

    setBusy(true);
    try {
      const resultado = await registrarNaoFez({
        idOcorrencia: existente?.id,
        idFilhoTarefa: existente ? undefined : tarefa.id,
        dataIso: existente
          ? undefined
          : new Date(data + "T12:00:00-03:00").toISOString(),
        consequenciaTipo: draft.consequenciaTipo,
        descontoValor,
        penalidadeDescricao:
          draft.consequenciaTipo === "PENALIDADE"
            ? draft.penalidadeDescricao.trim()
            : null,
        motivo: existente?.tipo === "FEZ"
          ? "Alteração de Fez para Não fez"
          : "Registro de Não fez",
      });

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ocorrencias"] }),
        qc.invalidateQueries({ queryKey: ["vigencias"] }),
        qc.invalidateQueries({ queryKey: ["filho_tarefas"] }),
        qc.invalidateQueries({ queryKey: ["solicitacoes_tarefa_filho"] }),
        qc.invalidateQueries({ queryKey: ["revisoes_tarefa_filho"] }),
        solicitacaoPendente
          ? notificarRespostaFilho("SOLICITACAO", solicitacaoPendente.id)
          : Promise.resolve(null),
      ]);

      setNaoFez(null);
      setTroca(null);

      const resposta = resultado as {
        contador_nao_fez_vigencia?: number;
      } | null;
      const contador = Number(resposta?.contador_nao_fez_vigencia ?? 0);

      if (draft.consequenciaTipo === "DESCONTO" && descontoValor !== null) {
        toast.success(
          `“Não fez” registrado · Desconto: ${reais(descontoValor)} · Total na vigência: ${contador}`,
        );
      } else if (draft.consequenciaTipo === "PENALIDADE") {
        toast.success(
          `“Não fez” registrado · Penalidade pendente · Total na vigência: ${contador}`,
        );
      } else {
        toast.success(
          `“Não fez” registrado · Total na vigência: ${contador}`,
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
    abrirNaoFez(tarefa, total, data);
  }

  async function confirmarNaoFez() {
    if (!naoFez) return;
    await salvarNaoFez(naoFez);
  }

  function abrirFez(
    tarefa: FilhoTarefa,
    total: number,
    data: string,
    existente?: Ocorrencia,
  ) {
    const draft: FezDraft = {
      modo: "REGISTRAR",
      tarefa,
      total,
      data,
      bonusTipo: "NENHUMA",
      descricao: "",
      valor: "",
      ...(existente ? { ocorrenciaId: existente.id } : {}),
    };

    void runAction(() => salvarFez(draft, existente));
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

    const gerouEstrela = !existente || existente.tipo !== "FEZ";
    const revisaoPendente = existente
      ? revisoesTarefaFilho.find(
          (revisao) =>
            revisao.id_ocorrencia === existente.id &&
            revisao.status === "PENDENTE",
        )
      : undefined;
    const solicitacaoPendente = solicitacaoNaData(tarefa, draft.data);
    const interacaoPendente =
      revisaoPendente
        ? { tipo: "REVISAO" as const, id: revisaoPendente.id }
        : solicitacaoPendente
          ? { tipo: "SOLICITACAO" as const, id: solicitacaoPendente.id }
          : null;

    setBusy(true);
    try {
      await registrarFez({
        idOcorrencia: existente?.id,
        idFilhoTarefa: existente ? undefined : tarefa.id,
        dataIso: existente
          ? undefined
          : new Date(draft.data + "T12:00:00-03:00").toISOString(),
        bonusTipo: draft.bonusTipo,
        bonusDescricao:
          draft.bonusTipo === "TEXTO" ? draft.descricao.trim() : null,
        bonusValor: draft.bonusTipo === "VALOR" ? valor : null,
        idRevisao:
          existente?.tipo === "NAO_FEZ" ? revisaoPendente?.id : undefined,
        motivo:
          existente?.tipo === "NAO_FEZ"
            ? "Alteração de Não fez para Fez"
            : draft.modo === "EDITAR"
              ? "Edição de recompensa extra do Fez"
              : "Registro de Fez",
      });

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ocorrencias"] }),
        qc.invalidateQueries({ queryKey: ["vigencias"] }),
        qc.invalidateQueries({ queryKey: ["filho_tarefas"] }),
        qc.invalidateQueries({ queryKey: ["solicitacoes_tarefa_filho"] }),
        qc.invalidateQueries({ queryKey: ["revisoes_tarefa_filho"] }),
        interacaoPendente
          ? notificarRespostaFilho(interacaoPendente.tipo, interacaoPendente.id)
          : Promise.resolve(null),
      ]);
      setFez(null);
      setTroca(null);
      toast.success(
        gerouEstrela
          ? "“Fez” registrado · +1 estrela"
          : "Recompensa extra atualizada",
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
      await desfazerOcorrencias(ids);

      const projetadas = ocorrencias.filter((o) => !ids.includes(o.id));
      qc.setQueryData<Ocorrencia[]>(["ocorrencias"], projetadas);

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
        qc.invalidateQueries({
          queryKey: ["solicitacoes_tarefa_filho"],
          refetchType: "all",
        }),
        qc.invalidateQueries({
          queryKey: ["revisoes_tarefa_filho"],
          refetchType: "all",
        }),
      ]);

      setConfirmarExcluirSelecionadas(null);
      toast.success(
        ids.length === 1
          ? "Marcação desfeita"
          : "Marcações desfeitas",
      );
    } catch (error) {
      toast.error(
        msgErro(error instanceof Error ? { message: error.message } : null),
      );
    } finally {
      setBusy(false);
    }
  }

  async function manterNaoFezRevisao(idRevisao: number) {
    setBusy(true);
    try {
      await resolverRevisao(idRevisao, "MANTER_NAO_FEZ");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ocorrencias"] }),
        qc.invalidateQueries({ queryKey: ["revisoes_tarefa_filho"] }),
        notificarRespostaFilho("REVISAO", idRevisao),
      ]);
      toast.success("Revisão encerrada · Não fez mantido");
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

  async function marcarPenalidadeCumprida(idOcorrencia: number) {
    setBusy(true);
    try {
      await cumprirPenalidade(idOcorrencia);
      await qc.invalidateQueries({ queryKey: ["ocorrencias"] });
      toast.success("Penalidade marcada como cumprida");
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
                resultIcons
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
                              <span
                                className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold leading-none text-foreground dark:border-amber-800 dark:bg-amber-950/35"
                                aria-label={`${totaisEstrelas[filho.id] ?? 0} estrelas conquistadas`}
                              >
                                <Star className="animate-notification-bell h-3 w-3 fill-amber-400 text-amber-500" aria-hidden="true" />
                                <span>{totaisEstrelas[filho.id] ?? 0}</span>
                              </span>
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
                    const ocorrenciasFilhoVigencia = ocorrencias.filter(
                      (ocorrencia) =>
                        ocorrencia.t_filho_tarefa?.id_filho === filho.id &&
                        ocorrencia.t_filho_tarefa?.id_vigencia === vigencia.id,
                    );
                    const totalNaoFez = ocorrenciasFilhoVigencia.filter(
                      (ocorrencia) => ocorrencia.tipo === "NAO_FEZ",
                    ).length;
                    const totalPendencias =
                      modo === "pendentes"
                        ? tarefasDoFilho.reduce(
                            (soma, tarefa) =>
                              soma + datasDaTarefa(tarefa, vigencia).length,
                            0,
                          )
                        : 0;
                    const temMesada =
                      filho.tem_mesada_opcional === true &&
                      filho.valor_mesada !== null;
                    const totalDescontado = ocorrenciasFilhoVigencia.reduce(
                      (total, ocorrencia) => {
                        const consequencia = ocorrencia.t_ocorrencia_consequencia;
                        return consequenciaEhDescontoAplicado(consequencia)
                          ? total + Number(consequencia?.desconto_valor ?? 0)
                          : total;
                      },
                      0,
                    );
                    const saldoMesada = Math.max(
                      0,
                      (filho.valor_mesada ?? 0) - totalDescontado,
                    );
                    const penalidadesPendentes = ocorrenciasFilhoVigencia.filter(
                      (ocorrencia) =>
                        ocorrencia.tipo === "NAO_FEZ" &&
                        consequenciaEhPenalidadePendente(
                          ocorrencia.t_ocorrencia_consequencia,
                        ),
                    ).length;
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
                            <span className="font-semibold tabular-nums">
                              Não fez: {totalNaoFez}
                            </span>
                          </div>
                        </button>

                        {filhoAberto && (
                          <div className="border-t bg-white p-3 dark:bg-background sm:p-4">
                            {temMesada && (
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
                            )}
                            {penalidadesPendentes > 0 && (
                              <div className="mb-4 rounded-lg border bg-muted/20 px-3 py-2 text-sm font-medium">
                                {penalidadesPendentes} {penalidadesPendentes === 1 ? "penalidade pendente" : "penalidades pendentes"}
                              </div>
                            )}

                            <div className="bg-white dark:bg-background">
                              <div className="border-b border-border/60 bg-transparent px-1 py-2.5">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex min-w-0 items-baseline gap-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      Tarefa(s)
                                    </p>
                                  </div>

                                  {!bloqueada && registrosDoDia.length > 0 && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-8 shrink-0 gap-1.5 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                                      disabled={busy}
                                      onClick={() =>
                                        setConfirmarExcluirSelecionadas({
                                          tarefa: registrosDoDia[0].tarefa,
                                          ids: registrosDoDia.map(({ registro }) => registro.id),
                                        })
                                      }
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Desfazer todos
                                    </Button>
                                  )}
                                </div>
                              </div>

                              <div className="divide-y divide-border/60">
                                {tarefasDoFilho.map((tarefa) => {
                                  const registro = registroNaData(tarefa, dataSelecionada);
                                  const solicitacao = solicitacaoNaData(tarefa, dataSelecionada);
                                  const revisao = revisaoNaData(tarefa, dataSelecionada);
                                  const filho = filhos.find((item) => item.id === tarefa.id_filho);
                                  const consequencia = registro?.t_ocorrencia_consequencia;
                                  return (
                                    <div
                                      key={tarefa.id}
                                      className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-1 py-3"
                                    >
                                      <div className="flex min-w-0 items-center gap-2">
                                        <div
                                          className="min-w-0 flex-1"
                                        >
                                          <div className="flex min-w-0 items-start gap-2">
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

                                          {!registro && solicitacao?.status === "PENDENTE" && (
                                            <div className="animate-soft-attention ml-6 mt-1.5 min-w-0 text-[11px] leading-snug text-amber-700 dark:text-amber-300">
                                              <p className="flex min-w-0 items-center gap-1 font-medium text-amber-700 dark:text-amber-300">
                                                <BellRing className="h-3.5 w-3.5 shrink-0" />
                                                <span className="min-w-0 break-words">
                                                  {primeiroNomeFilho(filho?.nome)} avisou que terminou às {formatarHora(solicitacao.created_at)}
                                                </span>
                                              </p>
                                            </div>
                                          )}

                                          {registro?.tipo === "NAO_FEZ" && revisao?.status === "PENDENTE" && (
                                            <div className="animate-soft-attention ml-6 mt-1.5 min-w-0 text-[11px] leading-snug text-amber-700 dark:text-amber-300">
                                              <p className="flex min-w-0 items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
                                                <BellRing className="h-3.5 w-3.5 shrink-0" />
                                                <span className="min-w-0 break-words">
                                                  {primeiroNomeFilho(filho?.nome)} pediu revisão às {formatarHora(revisao.created_at)}
                                                </span>
                                              </p>
                                            </div>
                                          )}

                                          {registro?.tipo === "NAO_FEZ" && (
                                            <p className="ml-6 mt-1.5 text-[11px] leading-snug text-muted-foreground">
                                              {descreverConsequenciaOcorrencia(
                                                consequencia,
                                                reais,
                                              )}
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
                                        {registro && (
                                          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
                                            <Hint content={registro.tipo === "FEZ" ? "Fez" : "Não fez"}>
                                              <span
                                                className={
                                                  registro.tipo === "FEZ"
                                                    ? "inline-flex h-5 w-5 items-center justify-center text-green-600 dark:text-green-400"
                                                    : "inline-flex h-5 w-5 items-center justify-center text-red-600 dark:text-red-400"
                                                }
                                              >
                                                {registro.tipo === "FEZ" ? (
                                                  <ThumbsUp className="h-4 w-4" />
                                                ) : (
                                                  <ThumbsDown className="h-4 w-4" />
                                                )}
                                                <span className="sr-only">
                                                  {registro.tipo === "FEZ" ? "Fez" : "Não fez"}
                                                </span>
                                              </span>
                                            </Hint>

                                            {registro.tipo === "FEZ" && (
                                              <Hint content="+1 estrela">
                                                <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-600">
                                                  <Star className="h-3.5 w-3.5" />
                                                  +1
                                                </span>
                                              </Hint>
                                            )}

                                            {registro.tipo === "NAO_FEZ" &&
                                              consequenciaEhPenalidadePendente(consequencia) && (
                                                <span
                                                  className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500"
                                                  role="img"
                                                  aria-label="Penalidade pendente"
                                                />
                                              )}
                                          </div>
                                        )}
                                        {registro?.tipo === "NAO_FEZ" &&
                                          revisao?.status === "PENDENTE" &&
                                          !bloqueada && (
                                            <div
                                              className="inline-flex shrink-0 items-center gap-1 self-center"
                                              role="group"
                                              aria-label="Ações da revisão solicitada"
                                            >
                                              <Hint content="Aceitar revisão e alterar para Fez">
                                                <Button
                                                  type="button"
                                                  size="icon"
                                                  variant="outline"
                                                  className="h-8 w-8 shrink-0 rounded-full p-0"
                                                  disabled={busy}
                                                  aria-label="Aceitar revisão e alterar para Fez"
                                                  onClick={() =>
                                                    abrirTrocaMarcacao(
                                                      tarefa,
                                                      totalNaoFez,
                                                      dataSelecionada,
                                                      registro,
                                                    )
                                                  }
                                                >
                                                  <ThumbsUp className="h-4 w-4 text-green-600" />
                                                </Button>
                                              </Hint>
                                              <Hint content="Manter Não fez">
                                                <Button
                                                  type="button"
                                                  size="icon"
                                                  variant="outline"
                                                  className="h-8 w-8 shrink-0 rounded-full p-0"
                                                  disabled={busy}
                                                  aria-label="Manter Não fez"
                                                  onClick={() => void manterNaoFezRevisao(revisao.id)}
                                                >
                                                  <ThumbsDown className="h-4 w-4 text-red-600" />
                                                </Button>
                                              </Hint>
                                            </div>
                                          )}

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
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 shrink-0 rounded-full"
                                                disabled={busy}
                                                aria-label={`Mais ações para ${tarefa.t_tarefa?.nome ?? "tarefa"}`}
                                              >
                                                <EllipsisVertical className="h-4 w-4" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                              {!bloqueada && (
                                                <DropdownMenuItem
                                                  onSelect={() =>
                                                    abrirTrocaMarcacao(
                                                      tarefa,
                                                      totalNaoFez,
                                                      dataSelecionada,
                                                      registro,
                                                    )
                                                  }
                                                >
                                                  <Pencil className="h-4 w-4" />
                                                  {registro.tipo === "FEZ"
                                                    ? "Alterar para Não fez"
                                                    : "Alterar para Fez"}
                                                </DropdownMenuItem>
                                              )}
                                              {registro.tipo === "FEZ" && (
                                                <DropdownMenuItem
                                                  onSelect={() =>
                                                    setBonificacaoInfo({
                                                      tarefa,
                                                      total: totalNaoFez,
                                                      ocorrencia: registro,
                                                    })
                                                  }
                                                >
                                                  <Info className="h-4 w-4" />
                                                  Ver bonificação
                                                </DropdownMenuItem>
                                              )}
                                              {registro.tipo === "NAO_FEZ" &&
                                                !bloqueada &&
                                                revisao?.status !== "PENDENTE" &&
                                                !consequenciaEhPenalidadeCumprida(consequencia) && (
                                                  <DropdownMenuItem
                                                    onSelect={() =>
                                                      abrirNaoFez(
                                                        tarefa,
                                                        totalNaoFez,
                                                        dataSelecionada,
                                                        registro,
                                                      )
                                                    }
                                                  >
                                                    <Pencil className="h-4 w-4" />
                                                    Editar consequência
                                                  </DropdownMenuItem>
                                                )}
                                              {registro.tipo === "NAO_FEZ" &&
                                                !bloqueada &&
                                                consequenciaEhPenalidadePendente(consequencia) && (
                                                  <DropdownMenuItem
                                                    onSelect={() =>
                                                      void runAction(() =>
                                                        marcarPenalidadeCumprida(registro.id),
                                                      )
                                                    }
                                                  >
                                                    <ClipboardCheck className="h-4 w-4" />
                                                    Marcar penalidade como cumprida
                                                  </DropdownMenuItem>
                                                )}
                                              {!bloqueada &&
                                                !consequenciaEhPenalidadeCumprida(consequencia) && (
                                                <DropdownMenuItem
                                                  className="text-destructive focus:text-destructive"
                                                  onSelect={() =>
                                                    setConfirmarExcluirSelecionadas({
                                                      tarefa,
                                                      ids: [registro.id],
                                                    })
                                                  }
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                  Desfazer marcação
                                                </DropdownMenuItem>
                                              )}
                                            </DropdownMenuContent>
                                          </DropdownMenu>
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

      <NaoFezDialog
        open={Boolean(naoFez)}
        value={naoFez}
        busy={busy}
        onChange={(value) =>
          setNaoFez((atual) => (atual ? { ...atual, ...value } : atual))
        }
        onCancel={() => setNaoFez(null)}
        onConfirm={() => void runAction(confirmarNaoFez)}
      />

      <Dialog
        open={Boolean(bonificacaoInfo)}
        onOpenChange={(open) => !open && setBonificacaoInfo(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recompensa extra do “Fez”</DialogTitle>
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
                    Recompensa extra escrita
                  </p>
                  <p className="text-sm font-medium">
                    {bonificacaoInfo.ocorrencia.bonificacao_descricao}
                  </p>
                </div>
              ) : bonificacaoInfo.ocorrencia.bonificacao_tipo === "VALOR" ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Valor da recompensa extra
                  </p>
                  <p className="text-base font-semibold">
                    {reais(Number(bonificacaoInfo.ocorrencia.bonificacao_valor ?? 0))}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma recompensa extra definida.
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
                Editar recompensa extra
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
                ? "Editar recompensa extra"
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
                      {" · "}A recompensa extra é opcional.
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
                    <span className="block">A recompensa extra é opcional.</span>
                  </span>
                );
              })()}
            </DialogDescription>
          </DialogHeader>

          {fez && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Recompensa extra</Label>
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
                  <Label htmlFor="bonus-texto">Recompensa extra escrita</Label>
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
                    Valor da recompensa extra (R$)
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
                    . Ao continuar, o resultado será substituído e todos os efeitos
                    relacionados serão reconciliados automaticamente.
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

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
              onClick={() => {
                if (!troca) return;

                if (troca.direcao === "PARA_FEZ" && troca.fez) {
                  void runAction(() => salvarFez(troca.fez!, troca.ocorrencia));
                  return;
                }

                const atual = troca;
                setTroca(null);
                abrirNaoFez(
                  atual.tarefa,
                  atual.total,
                  dataBrasil(atual.ocorrencia.created_at),
                  atual.ocorrencia,
                );
              }}
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
            <DialogTitle>
              {confirmarExcluirSelecionadas?.ids.length === 1
                ? "Desfazer marcação?"
                : "Desfazer todas as marcações?"}
            </DialogTitle>
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
                        {quantidade} {quantidade === 1 ? "marcação será desfeita" : "marcações serão desfeitas"}.
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
