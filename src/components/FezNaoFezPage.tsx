import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BellRing,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  EllipsisVertical,
  Minus,
  Pencil,
  Star,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { CollapseChevron } from "@/components/CollapseChevron";
import { FilhoAvatar } from "@/components/FilhoAvatar";
import { ResponsiveFilters } from "@/components/ResponsiveFilters";
import { Pick } from "@/components/Pick";
import { Hint } from "@/components/Hint";
import { TarefaIcone } from "@/components/TarefaIcone";
import {
  fmtVigencia,
  msgErro,
  useFilhos,
  useFilhoTarefas,
  useFilhoVigenciaMesadas,
  useOcorrencias,
  useSolicitacoesTarefaFilho,
  useVigencias,
  useTarefas,
  type FilhoTarefa,
  type Ocorrencia,
  type Vigencia,
} from "@/lib/db";
import { reais, resolverMesadaVigencia } from "@/lib/mesada";
import {
  consequenciaEhDescontoAplicado,
  consequenciaEhPenalidadeCumprida,
  consequenciaEhPenalidadePendente,
} from "@/lib/ocorrencia-model";
import {
  cumprirPenalidade,
  registrarFez,
  registrarNaoFez,
  registrarNaoPrecisou,
  type ConsequenciaNaoFezTipo,
} from "@/lib/ocorrencia-service";
import {
  botaoFezClass,
  botaoNaoFezClass,
  botaoNaoPrecisouClass,
} from "@/lib/action-button-styles";
import { useActionLoading } from "@/components/ActionLoading";
import {
  compararVigencias,
  situacaoVigencia,
  vigenciaEmAndamento,
} from "@/components/VigenciaStatus";
import { uiTypography } from "@/lib/ui-typography";
import { NaoFezDialog, type NaoFezDraft } from "@/components/NaoFezDialog";
import { ConsequenciaOcorrenciaResumo } from "@/components/ConsequenciaOcorrenciaResumo";
import {
  dataBrasil,
  dataPertenceAVigenciaAteHoje,
  datasDaVigenciaAteHoje,
  useDataBrasilAtual,
} from "@/lib/notificacoes";
import { notificarRespostaFilho } from "@/lib/child-response-notifications";
import {
  rotuloResultado,
  type ResultadoOcorrencia,
} from "@/lib/resultado-ocorrencia";

type ModoPagina = "todos" | "pendentes";

type FezDraft = {
  tarefa: FilhoTarefa;
  total: number;
  data: string;
};


type Troca = {
  alvo: ResultadoOcorrencia;
  tarefa: FilhoTarefa;
  total: number;
  data: string;
  ocorrencia: Ocorrencia;
};


function classeResultadoTexto(tipo: string) {
  if (tipo === "FEZ") return "text-green-700 dark:text-green-300";
  if (tipo === "NAO_FEZ") return "text-red-700 dark:text-red-300";
  return "text-muted-foreground";
}


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
};

type FezNaoFezPageProps = {
  modo: ModoPagina;
  focoSolicitacao?: FocoSolicitacaoTarefa;
};

function formatarData(data: string) {
  return data.split("-").reverse().join("/");
}

function formatarDiaSemana(data: string) {
  const dia = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    timeZone: "America/Sao_Paulo",
  })
    .format(new Date(`${data}T12:00:00-03:00`))
    .replace(/-feira$/i, "");

  return dia.charAt(0).toLocaleUpperCase("pt-BR") + dia.slice(1);
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

function valorMonetarioNumero(valor: string) {
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
  const { data: mesadasVigencia = [] } = useFilhoVigenciaMesadas();
  const { data: tarefas = [] } = useTarefas();
  const { data: ocorrencias = [] } = useOcorrencias();
  const { data: solicitacoesTarefaFilho = [] } = useSolicitacoesTarefaFilho();
  const hoje = useDataBrasilAtual();
  const agoraBrasil = new Date(hoje + "T12:00:00-03:00");

  const filhoDaTarefa = (tarefa?: FilhoTarefa | null) =>
    tarefa ? filhos.find((filho) => filho.id === tarefa.id_filho) : undefined;

  const tarefaEstaAtiva = (tarefa: FilhoTarefa) =>
    tarefa.t_tarefa?.ativo === true;

  function garantirTarefaAtiva(tarefa: FilhoTarefa) {
    if (tarefaEstaAtiva(tarefa)) return true;
    toast.error("Esta tarefa foi excluída e está disponível somente como histórico");
    return false;
  }
  const filhosScrollRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [diasSelecionados, setDiasSelecionados] = useState<Record<number, string>>({});
  const [filhosSelecionados, setFilhosSelecionados] = useState<Record<number, number>>({});
  const [f, setF] = useState({ filho: "all", tarefa: "all", resultado: "all" });
  const [filtro, setFiltro] = useState(f);
  const [busy, setBusy] = useState(false);
  const [troca, setTroca] = useState<Troca | null>(null);
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
  const vigenciasOperacionais = vigenciasEmAndamento;
  useEffect(() => {
    setDiasSelecionados((atual) => {
      const proximo = { ...atual };
      const idsOperacionais = new Set(
        vigenciasOperacionais.map((vigencia) => vigencia.id),
      );
      let mudou = false;

      for (const id of Object.keys(proximo)) {
        if (!idsOperacionais.has(Number(id))) {
          delete proximo[Number(id)];
          mudou = true;
        }
      }

      for (const vigencia of vigenciasOperacionais) {
        if (!(vigencia.id in proximo)) {
          proximo[vigencia.id] = hoje;
          mudou = true;
        }
      }

      return mudou ? proximo : atual;
    });
  }, [hoje, vigenciasOperacionais]);

  function datasSelecionaveisDaVigencia(vigencia: Vigencia) {
    return datasDaVigenciaAteHoje(vigencia, agoraBrasil);
  }

  function navegarDia(vigencia: Vigencia, direcao: -1 | 1) {
    const datas = datasSelecionaveisDaVigencia(vigencia);
    const selecionada = diasSelecionados[vigencia.id] ?? hoje;
    const indiceAtual = datas.indexOf(selecionada);
    if (indiceAtual < 0) return;

    const destino = datas[indiceAtual + direcao];
    if (!destino) return;

    setDiasSelecionados((atual) => ({
      ...atual,
      [vigencia.id]: destino,
    }));
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

  const diaTemPendencia = (vigenciaId: number, data: string) => {
    if (data > hoje) return false;

    const atribuicoesDaVigencia = atribuicoes.filter(
      (tarefa) =>
        tarefa.id_vigencia === vigenciaId &&
        tarefaEstaAtiva(tarefa),
    );

    return atribuicoesDaVigencia.some(
      (tarefa) => !registroNaData(tarefa, data),
    );
  };

  const datasDaTarefa = (tarefa: FilhoTarefa, vigencia: Vigencia) => {
    if (modo === "pendentes" && !vigenciaEmAndamento(vigencia)) return [];

    const dataSelecionada = diasSelecionados[vigencia.id] ?? hoje;

    if (!tarefaEstaAtiva(tarefa)) {
      const registroHistorico = registroNaData(tarefa, dataSelecionada);
      if (!registroHistorico || modo === "pendentes") return [];

      if (filtro.resultado === "FEZ" && registroHistorico.tipo !== "FEZ") return [];
      if (filtro.resultado === "NAO_FEZ" && registroHistorico.tipo !== "NAO_FEZ") return [];
      if (
        filtro.resultado === "NAO_PRECISOU" &&
        registroHistorico.tipo !== "NAO_PRECISOU"
      ) return [];

      return [dataSelecionada];
    }

    const datasGeradas = datasDaVigenciaAteHoje(vigencia, agoraBrasil);
    const datasComRegistro = ocorrenciasDaTarefa(tarefa).map((o) =>
      dataBrasil(o.created_at),
    );
    const datas = [...new Set([...datasGeradas, ...datasComRegistro])].sort(
      (a, b) => a.localeCompare(b),
    );
    const datasFiltradas = datas.filter((data) => data === dataSelecionada);

    if (modo === "pendentes") {
      return datasFiltradas.filter((data) => !registroNaData(tarefa, data));
    }

    if (filtro.resultado === "FEZ") {
      return datasFiltradas.filter((data) => registroNaData(tarefa, data)?.tipo === "FEZ");
    }

    if (filtro.resultado === "NAO_FEZ") {
      return datasFiltradas.filter(
        (data) => registroNaData(tarefa, data)?.tipo === "NAO_FEZ",
      );
    }

    if (filtro.resultado === "NAO_PRECISOU") {
      return datasFiltradas.filter(
        (data) => registroNaData(tarefa, data)?.tipo === "NAO_PRECISOU",
      );
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
    ].join(":");

    if (ultimoFocoAplicado.current === chaveFoco) return;

    const atribuicao = atribuicoes.find(
      (item) => item.id === focoSolicitacao.idFilhoTarefa,
    );
    if (!atribuicao) return;

    const vigencia = vigencias.find((item) => item.id === atribuicao.id_vigencia);
    if (!vigencia) return;

    if (!vigenciaEmAndamento(vigencia)) return;
    const dataPreferida = focoSolicitacao.data;
    const dataFoco =
      dataPreferida &&
      dataPertenceAVigenciaAteHoje(vigencia, dataPreferida, hoje)
        ? dataPreferida
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
  }, [
    atribuicoes,
    focoSolicitacao,
    hoje,
    isLoading,
    vigencias,
  ]);

  const idsVigenciasRascunho = new Set(
    vigenciasOperacionais.map((vigencia) => vigencia.id),
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
      if (!tarefaEstaAtiva(tarefa) && datasDaTarefa(tarefa, vigencia).length === 0) {
        return false;
      }

      return (
        filtro.tarefa === "all" ||
        tarefa.id_tarefa === Number(filtro.tarefa)
      );
    });

  const vigenciasParaExibir = vigenciasOperacionais
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
      for (const vigencia of vigenciasOperacionais) {
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
  }, [filhosSelecionados, vigenciasOperacionais]);

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
    if (!garantirTarefaAtiva(tarefa)) return;

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
    const snapshotMesada = mesadasVigencia.find(
      (snapshot) =>
        snapshot.id_filho === filho.id &&
        snapshot.id_vigencia === tarefa.id_vigencia,
    );
    const { temMesada } = resolverMesadaVigencia(filho, snapshotMesada);
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
      quantidadeNaoFezAtual: total,
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
    if (!garantirTarefaAtiva(tarefa)) return;

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
        ? valorMonetarioNumero(draft.descontoValor)
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
        motivo:
          existente?.tipo === "FEZ"
            ? "Alteração de Fez para Não fez"
            : existente?.tipo === "NAO_PRECISOU"
              ? "Alteração de Não precisou para Não fez"
              : "Registro de Não fez",
      });

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ocorrencias"] }),
        qc.invalidateQueries({ queryKey: ["vigencias"] }),
        qc.invalidateQueries({ queryKey: ["filho_tarefas"] }),
        qc.invalidateQueries({ queryKey: ["solicitacoes_tarefa_filho"] }),
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
        msgErro(error),
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
    if (existente && existente.tipo !== "NAO_FEZ") {
      abrirTrocaMarcacao(tarefa, total, data, existente, "NAO_FEZ");
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
    if (!garantirTarefaAtiva(tarefa)) return;

    if (existente && existente.tipo !== "FEZ") {
      abrirTrocaMarcacao(tarefa, total, data, existente, "FEZ");
      return;
    }
    if (existente) return;

    const draft: FezDraft = { tarefa, total, data };
    void runAction(() => salvarFez(draft));
  }

  function abrirTrocaMarcacao(
    tarefa: FilhoTarefa,
    total: number,
    data: string,
    registro: Ocorrencia,
    alvo: ResultadoOcorrencia,
  ) {
    if (!garantirTarefaAtiva(tarefa)) return;
    if (registro.tipo === alvo) return;

    if (
      consequenciaEhPenalidadeCumprida(
        registro.t_ocorrencia_consequencia,
      )
    ) {
      toast.error(
        "Não é possível alterar este resultado porque a penalidade já foi cumprida",
      );
      return;
    }


    if (
      !tarefa.t_vigencia ||
      (!vigenciaEmAndamento(tarefa.t_vigencia))
    ) {
      toast.error("Ações só podem ser feitas em uma vigência em andamento");
      return;
    }

    setTroca({ alvo, tarefa, total, data, ocorrencia: registro });
  }

  async function salvarFez(draft: FezDraft, existente?: Ocorrencia) {
    const tarefa = draft.tarefa;
    if (!garantirTarefaAtiva(tarefa)) return;

    const vigencia = tarefa.t_vigencia;

    if (!vigencia || (!vigenciaEmAndamento(vigencia))) {
      toast.error("Ações só podem ser feitas em uma vigência em andamento");
      return;
    }
    if (!dataValida(tarefa, draft.data)) {
      toast.error(
        "A data do “Fez” deve estar entre o início da vigência e hoje, sem ultrapassar o fim da vigência",
      );
      return;
    }
    const gerouEstrela = !existente || existente.tipo !== "FEZ";
    const solicitacaoPendente = solicitacaoNaData(tarefa, draft.data);
    const interacaoPendente =
      solicitacaoPendente
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
        motivo:
          existente?.tipo === "NAO_FEZ"
            ? "Alteração de Não fez para Fez"
            : existente?.tipo === "NAO_PRECISOU"
              ? "Alteração de Não precisou para Fez"
              : "Registro de Fez",
      });

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ocorrencias"] }),
        qc.invalidateQueries({ queryKey: ["vigencias"] }),
        qc.invalidateQueries({ queryKey: ["filho_tarefas"] }),
        qc.invalidateQueries({ queryKey: ["solicitacoes_tarefa_filho"] }),
        interacaoPendente
          ? notificarRespostaFilho(interacaoPendente.tipo, interacaoPendente.id)
          : Promise.resolve(null),
      ]);
      setTroca(null);
      toast.success(
        gerouEstrela
          ? "“Fez” registrado · +1 estrela"
          : "“Fez” atualizado",
      );
    } catch (error) {
      toast.error(
        msgErro(error),
      );
    } finally {
      setBusy(false);
    }
  }

  async function salvarNaoPrecisou(
    tarefa: FilhoTarefa,
    data: string,
    existente?: Ocorrencia,
  ) {
    if (!garantirTarefaAtiva(tarefa)) return;

    const vigencia = tarefa.t_vigencia;

    if (!vigencia || (!vigenciaEmAndamento(vigencia))) {
      toast.error("Ações só podem ser feitas em uma vigência em andamento");
      return;
    }
    if (!dataValida(tarefa, data)) {
      toast.error(
        "A data do “Não precisou” deve estar entre o início da vigência e hoje, sem ultrapassar o fim da vigência",
      );
      return;
    }

    const solicitacaoPendente = solicitacaoNaData(tarefa, data);
    const interacaoPendente =
      solicitacaoPendente
          ? { tipo: "SOLICITACAO" as const, id: solicitacaoPendente.id }
          : null;

    setBusy(true);
    try {
      await registrarNaoPrecisou({
        idOcorrencia: existente?.id,
        idFilhoTarefa: existente ? undefined : tarefa.id,
        dataIso: existente
          ? undefined
          : new Date(data + "T12:00:00-03:00").toISOString(),
        motivo:
          existente?.tipo === "FEZ"
            ? "Alteração de Fez para Não precisou"
            : existente?.tipo === "NAO_FEZ"
              ? "Alteração de Não fez para Não precisou"
              : "Registro de Não precisou",
      });

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ocorrencias"] }),
        qc.invalidateQueries({ queryKey: ["vigencias"] }),
        qc.invalidateQueries({ queryKey: ["filho_tarefas"] }),
        qc.invalidateQueries({ queryKey: ["solicitacoes_tarefa_filho"] }),
        interacaoPendente
          ? notificarRespostaFilho(interacaoPendente.tipo, interacaoPendente.id)
          : Promise.resolve(null),
      ]);

      setTroca(null);
      toast.success("“Não precisou” registrado");
    } catch (error) {
      toast.error(
        msgErro(error),
      );
    } finally {
      setBusy(false);
    }
  }

  function solicitarNaoPrecisou(
    tarefa: FilhoTarefa,
    total: number,
    data: string,
    existente?: Ocorrencia,
  ) {
    if (existente && existente.tipo !== "NAO_PRECISOU") {
      abrirTrocaMarcacao(tarefa, total, data, existente, "NAO_PRECISOU");
      return;
    }
    if (existente) return;

    void runAction(() => salvarNaoPrecisou(tarefa, data));
  }

  async function marcarPenalidadeCumprida(idOcorrencia: number) {
    setBusy(true);
    try {
      await cumprirPenalidade(idOcorrencia);
      await qc.invalidateQueries({ queryKey: ["ocorrencias"] });
      toast.success("Penalidade marcada como cumprida");
    } catch (error) {
      toast.error(
        msgErro(error),
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
        description="Marque “Fez”, “Não fez” ou “Não precisou”"
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
                label="Resultado"
                resultIcons
                value={f.resultado}
                onChange={(resultado) => setF({ ...f, resultado })}
                allLabel="Todos"
                options={[
                  { value: "FEZ", label: "Fez" },
                  { value: "NAO_FEZ", label: "Não fez" },
                  { value: "NAO_PRECISOU", label: "Não precisou" },
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
          const dataSelecionada = diasSelecionados[vigencia.id] ?? hoje;
          const datasSelecionaveis = datasSelecionaveisDaVigencia(vigencia);
          const indiceDataSelecionada = datasSelecionaveis.indexOf(dataSelecionada);
          const podeVoltarData = indiceDataSelecionada > 0;
          const podeAvancarData =
            indiceDataSelecionada >= 0 &&
            indiceDataSelecionada < datasSelecionaveis.length - 1;
          return (
            <section key={vigencia.id} className="space-y-3">
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
                    const snapshotMesada = mesadasVigencia.find(
                      (snapshot) =>
                        snapshot.id_filho === filho.id &&
                        snapshot.id_vigencia === vigencia.id,
                    );
                    const { temMesada, valorMesada } =
                      resolverMesadaVigencia(filho, snapshotMesada);
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
                      (valorMesada ?? 0) - totalDescontado,
                    );
                    const penalidadesPendentes = ocorrenciasFilhoVigencia.filter(
                      (ocorrencia) =>
                        ocorrencia.tipo === "NAO_FEZ" &&
                        consequenciaEhPenalidadePendente(
                          ocorrencia.t_ocorrencia_consequencia,
                        ),
                    ).length;
                    const bloqueada = !vigenciaEmAndamento(vigencia);
                    return (
                      <div key={filho.id} className="space-y-2">
                        <div className="bg-muted/15 px-2 py-2 sm:hidden">
                          <div className="grid grid-cols-2 items-center gap-2 text-xs font-semibold">
                            <span
                              className="inline-flex items-center gap-1 tabular-nums text-muted-foreground"
                              aria-label={`${totaisEstrelas[filho.id] ?? 0} estrelas conquistadas`}
                            >
                              <Star className="animate-notification-bell h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden="true" />
                              <span>{totaisEstrelas[filho.id] ?? 0} estrelas</span>
                            </span>
                            <span className="inline-flex items-center justify-end gap-1 tabular-nums text-muted-foreground">
                              <ThumbsDown className="animate-notification-bell h-3.5 w-3.5 text-red-600 dark:text-red-400" aria-hidden="true" />
                              <span>Não fez: {totalNaoFez}</span>
                            </span>
                          </div>

                          {temMesada && (
                            <div className="mt-1.5 grid grid-cols-3 divide-x overflow-hidden rounded-md border bg-background text-center tabular-nums">
                              <div className="min-w-0 px-1.5 py-1.5">
                                <p className="text-[9px] leading-none text-muted-foreground">Mesada</p>
                                <p className="mt-1 truncate text-[11px] font-semibold">{reais(valorMesada ?? 0)}</p>
                              </div>
                              <div className="min-w-0 px-1.5 py-1.5">
                                <p className="text-[9px] leading-none text-muted-foreground">Descontos</p>
                                <p className="mt-1 truncate text-[11px] font-semibold text-destructive">-{reais(totalDescontado)}</p>
                              </div>
                              <div className="min-w-0 px-1.5 py-1.5">
                                <p className="text-[9px] leading-none text-muted-foreground">Saldo</p>
                                <p className="mt-1 truncate text-[11px] font-semibold text-primary">{reais(saldoMesada)}</p>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="hidden rounded-lg border bg-muted/20 px-2.5 py-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3 sm:gap-y-2">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
                            <span
                              className="inline-flex items-center gap-1 tabular-nums text-muted-foreground"
                              aria-label={`${totaisEstrelas[filho.id] ?? 0} estrelas conquistadas`}
                            >
                              <Star className="animate-notification-bell h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden="true" />
                              <span>{totaisEstrelas[filho.id] ?? 0} estrelas</span>
                            </span>
                            <span className="inline-flex items-center gap-1 tabular-nums text-muted-foreground">
                              <ThumbsDown className="animate-notification-bell h-3.5 w-3.5 text-red-600 dark:text-red-400" aria-hidden="true" />
                              <span>Não fez na vigência: {totalNaoFez}</span>
                            </span>
                          </div>

                          {temMesada && (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tabular-nums">
                              <span className="whitespace-nowrap">
                                <span className="text-muted-foreground">Mesada</span>{" "}
                                <strong className="font-semibold">{reais(valorMesada ?? 0)}</strong>
                              </span>
                              <span className="whitespace-nowrap">
                                <span className="text-muted-foreground">Descontos</span>{" "}
                                <strong className="font-semibold text-destructive">-{reais(totalDescontado)}</strong>
                              </span>
                              <span className="whitespace-nowrap">
                                <span className="text-muted-foreground">Saldo</span>{" "}
                                <strong className="font-semibold text-primary">{reais(saldoMesada)}</strong>
                              </span>
                            </div>
                          )}
                        </div>

                        <article
                          className="overflow-hidden rounded-xl border bg-background"
                        >
                        <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 bg-white px-3 py-2.5 dark:bg-background sm:px-4 sm:py-3">
                          <button
                            type="button"
                            onClick={() =>
                              setFilhosAbertos((atual) => ({
                                ...atual,
                                [chave]: !filhoAberto,
                              }))
                            }
                            className="flex h-9 w-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            aria-label={filhoAberto ? "Recolher tarefas" : "Expandir tarefas"}
                            aria-expanded={filhoAberto}
                          >
                            <CollapseChevron open={filhoAberto} />
                          </button>

                          <div className="flex min-w-0 items-center justify-center gap-1 sm:gap-2">
                            <button
                              type="button"
                              onClick={() => navegarDia(vigencia, -1)}
                              disabled={!podeVoltarData}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-border disabled:hover:bg-background disabled:hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                              aria-label="Ir para o dia anterior"
                            >
                              <ChevronLeft className="h-5 w-5" strokeWidth={3} />
                            </button>

                            <h3
                              className={`min-w-0 truncate whitespace-nowrap text-center tabular-nums ${uiTypography.secondaryTitleStrong}`}
                            >
                              <span>{formatarDataCurta(dataSelecionada)} </span>
                              <span className="font-extrabold">{formatarDiaSemana(dataSelecionada)}</span>
                              {diaTemPendencia(vigencia.id, dataSelecionada) && (
                                <span
                                  className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle"
                                  aria-label="Há pendências nesta data"
                                />
                              )}
                            </h3>

                            <button
                              type="button"
                              onClick={() => navegarDia(vigencia, 1)}
                              disabled={!podeAvancarData}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-border disabled:hover:bg-background disabled:hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                              aria-label="Ir para o próximo dia"
                            >
                              <ChevronRight className="h-5 w-5" strokeWidth={3} />
                            </button>
                          </div>

                          {modo === "pendentes" ? (
                            <div className="flex shrink-0 flex-col items-end justify-center gap-1 text-sm">
                              <span className="font-semibold text-primary tabular-nums">
                                {totalPendencias}{" "}
                                {totalPendencias === 1
                                  ? "pendência"
                                  : "pendências"}
                              </span>
                            </div>
                          ) : (
                            <span className="h-9 w-9" aria-hidden="true" />
                          )}
                        </div>

                        {filhoAberto && (
                          <div className="border-t bg-white p-3 dark:bg-background sm:p-4">
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

                                </div>
                              </div>

                              <div className="divide-y divide-border/60">
                                {tarefasDoFilho.map((tarefa) => {
                                  const registro = registroNaData(tarefa, dataSelecionada);
                                  const solicitacao = solicitacaoNaData(tarefa, dataSelecionada);
                                  const filho = filhos.find((item) => item.id === tarefa.id_filho);
                                  const consequencia = registro?.t_ocorrencia_consequencia;
                                  return (
                                    <div
                                      key={tarefa.id}
                                      className="grid min-h-14 grid-cols-[minmax(0,1fr)_10.5rem] items-center gap-1 px-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-3"
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
                                                  ? classeResultadoTexto(registro.tipo)
                                                  : ""
                                              }`}
                                            />
                                            <p
                                              className={`min-w-0 break-words text-sm font-medium leading-tight ${
                                                registro
                                                  ? classeResultadoTexto(registro.tipo)
                                                  : ""
                                              }`}
                                            >
                                              {tarefa.t_tarefa?.nome}
                                            </p>
                                            {!tarefaEstaAtiva(tarefa) && (
                                              <span className="shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                Histórico
                                              </span>
                                            )}
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

                                          {registro?.tipo === "NAO_FEZ" && (
                                            <ConsequenciaOcorrenciaResumo
                                              consequencia={consequencia}
                                              formatarMoeda={reais}
                                              className="ml-6 mt-1.5 text-[11px] leading-snug text-muted-foreground"
                                            />
                                          )}
                                        </div>
                                      </div>

                                      <div className="-mr-1 flex w-full min-w-0 items-center justify-end gap-1 sm:mr-0 sm:w-auto sm:shrink-0 sm:gap-3">
                                        {registro && (
                                          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
                                            {registro.tipo === "FEZ" && (
                                              <Hint content="+1 estrela">
                                                <span className="mr-1.5 inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-600">
                                                  <Star className="h-3.5 w-3.5" />
                                                  +1
                                                </span>
                                              </Hint>
                                            )}

                                            <Hint content={rotuloResultado(registro.tipo)}>
                                              <span
                                                className={
                                                  registro.tipo === "FEZ"
                                                    ? "inline-flex h-5 w-5 items-center justify-center text-green-600 dark:text-green-400"
                                                    : registro.tipo === "NAO_FEZ"
                                                      ? "inline-flex h-5 w-5 items-center justify-center text-red-600 dark:text-red-400"
                                                      : "inline-flex h-5 w-5 items-center justify-center text-muted-foreground"
                                                }
                                              >
                                                {registro.tipo === "FEZ" ? (
                                                  <ThumbsUp className="h-4 w-4" />
                                                ) : registro.tipo === "NAO_FEZ" ? (
                                                  <ThumbsDown className="h-4 w-4" />
                                                ) : (
                                                  <Minus className="h-4 w-4" />
                                                )}
                                                <span className="sr-only">
                                                  {rotuloResultado(registro.tipo)}
                                                </span>
                                              </span>
                                            </Hint>

                                          </div>
                                        )}
                                        {!registro && !bloqueada && tarefaEstaAtiva(tarefa) && (
                                          <>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className={`min-w-0 px-1.5 text-xs sm:min-w-24 sm:px-3 sm:text-sm ${botaoFezClass}`}
                                              disabled={busy}
                                              onClick={() =>
                                                abrirFez(
                                                  tarefa,
                                                  totalNaoFez,
                                                  dataSelecionada,
                                                )
                                              }
                                            >
                                              Fez
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className={`min-w-0 px-1.5 text-xs sm:min-w-24 sm:px-3 sm:text-sm ${botaoNaoFezClass}`}
                                              disabled={busy}
                                              onClick={() =>
                                                solicitarNaoFez(
                                                  tarefa,
                                                  totalNaoFez,
                                                  dataSelecionada,
                                                )
                                              }
                                            >
                                              Não fez
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className={`min-w-0 px-1.5 text-xs sm:min-w-24 sm:px-3 sm:text-sm ${botaoNaoPrecisouClass}`}
                                              disabled={busy}
                                              onClick={() =>
                                                solicitarNaoPrecisou(
                                                  tarefa,
                                                  totalNaoFez,
                                                  dataSelecionada,
                                                )
                                              }
                                            >
                                              Dispensar
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
                                                className="h-8 w-8 shrink-0 rounded-full disabled:cursor-default disabled:opacity-35"
                                                disabled={
                                                  busy ||
                                                  !tarefaEstaAtiva(tarefa) ||
                                                  consequenciaEhPenalidadeCumprida(consequencia)
                                                }
                                                aria-label={
                                                  consequenciaEhPenalidadeCumprida(consequencia)
                                                    ? `Mais ações indisponíveis para ${tarefa.t_tarefa?.nome ?? "tarefa"}: penalidade cumprida`
                                                    : `Mais ações para ${tarefa.t_tarefa?.nome ?? "tarefa"}`
                                                }
                                              >
                                                <EllipsisVertical className="h-4 w-4" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                              {!bloqueada &&
                                                tarefaEstaAtiva(tarefa) &&
                                                !consequenciaEhPenalidadeCumprida(consequencia) &&
                                                registro.tipo !== "FEZ" && (
                                                <DropdownMenuItem
                                                  onSelect={() =>
                                                    abrirTrocaMarcacao(tarefa, totalNaoFez, dataSelecionada, registro, "FEZ")
                                                  }
                                                >
                                                  <Pencil className="h-4 w-4" />
                                                  Alterar para Fez
                                                </DropdownMenuItem>
                                              )}
                                              {!bloqueada &&
                                                tarefaEstaAtiva(tarefa) &&
                                                !consequenciaEhPenalidadeCumprida(consequencia) &&
                                                registro.tipo !== "NAO_FEZ" && (
                                                <DropdownMenuItem
                                                  onSelect={() =>
                                                    abrirTrocaMarcacao(tarefa, totalNaoFez, dataSelecionada, registro, "NAO_FEZ")
                                                  }
                                                >
                                                  <Pencil className="h-4 w-4" />
                                                  Alterar para Não fez
                                                </DropdownMenuItem>
                                              )}
                                              {!bloqueada &&
                                                tarefaEstaAtiva(tarefa) &&
                                                !consequenciaEhPenalidadeCumprida(consequencia) &&
                                                registro.tipo !== "NAO_PRECISOU" && (
                                                <DropdownMenuItem
                                                  onSelect={() =>
                                                    abrirTrocaMarcacao(tarefa, totalNaoFez, dataSelecionada, registro, "NAO_PRECISOU")
                                                  }
                                                >
                                                  <Minus className="h-4 w-4" />
                                                  Alterar para Não precisou
                                                </DropdownMenuItem>
                                              )}
                                              {registro.tipo === "NAO_FEZ" &&
                                                !bloqueada &&
                                                tarefaEstaAtiva(tarefa) &&
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
                                                tarefaEstaAtiva(tarefa) &&
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
                      </div>
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
        open={Boolean(troca)}
        onOpenChange={(open) => !open && !busy && setTroca(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="space-y-3">
            <DialogTitle>
              {troca ? `Alterar para “${rotuloResultado(troca.alvo)}”?` : "Alterar resultado?"}
            </DialogTitle>
            <DialogDescription className="space-y-3">
              {troca && (
                <>
                  {(() => {
                    const filho = filhoDaTarefa(troca.tarefa);
                    return (
                      <span className="grid min-w-0 grid-cols-[0.9fr_1.5fr_auto] divide-x overflow-hidden rounded-lg border">
                        <span className="flex min-w-0 items-center gap-1.5 px-2.5 py-2">
                          {filho && (
                            <FilhoAvatar
                              nome={filho.nome}
                              cor={filho.cor}
                              avatar={filho.avatar === "menino" || filho.avatar === "menina" ? filho.avatar : null}
                              className="h-4 w-4"
                            />
                          )}
                          <span className="min-w-0">
                            <span className="block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Filho
                            </span>
                            <span className="block truncate text-xs font-medium text-foreground">
                              {filho?.nome ?? "Filho"}
                            </span>
                          </span>
                        </span>
                        <span className="min-w-0 px-2.5 py-2">
                          <span className="block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Tarefa
                          </span>
                          <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
                            <TarefaIcone nome={troca.tarefa.t_tarefa?.nome ?? "Tarefa"} className="h-3.5 w-3.5 shrink-0" />
                            <span className="min-w-0 truncate text-xs font-medium text-foreground">
                              {troca.tarefa.t_tarefa?.nome}
                            </span>
                          </span>
                        </span>
                        <span className="px-2.5 py-2">
                          <span className="block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Data
                          </span>
                          <span className="mt-0.5 block whitespace-nowrap text-xs font-medium text-foreground">
                            {formatarData(dataBrasil(troca.ocorrencia.created_at))}
                          </span>
                        </span>
                      </span>
                    );
                  })()}

                  <span className="block rounded-lg bg-muted/15 px-3 py-2.5 leading-relaxed">
                    Esta tarefa está marcada como{" "}
                    <span className="font-medium text-foreground">
                      “{rotuloResultado(troca.ocorrencia.tipo)}”
                    </span>. Ao confirmar, ela será alterada para{" "}
                    <span className="font-medium text-foreground">
                      “{rotuloResultado(troca.alvo)}”
                    </span>.
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

                if (troca.alvo === "FEZ") {
                  void runAction(() =>
                    salvarFez(
                      { tarefa: troca.tarefa, total: troca.total, data: troca.data },
                      troca.ocorrencia,
                    ),
                  );
                  return;
                }

                if (troca.alvo === "NAO_PRECISOU") {
                  void runAction(() =>
                    salvarNaoPrecisou(troca.tarefa, troca.data, troca.ocorrencia),
                  );
                  return;
                }

                const atual = troca;
                setTroca(null);
                abrirNaoFez(atual.tarefa, atual.total, atual.data, atual.ocorrencia);
              }}
            >
              Confirmar alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
