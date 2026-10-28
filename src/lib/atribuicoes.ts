import { supabase } from "@/integrations/supabase/client";
import type { FilhoTarefa, Vigencia } from "@/lib/db";
import { situacaoVigencia } from "@/components/VigenciaStatus";
import { obterVigenciaAutomaticaAtiva } from "@/lib/vigencia-automatica";

export type ModoVigenciaAtribuicao = "MANUAL" | "AUTOMATICA";

export type AtribuicaoCandidato = {
  id_vigencia?: number;
  id_filho: number;
  id_tarefa: number;
};

export type AtribuicaoItem = AtribuicaoCandidato & {
  id_vigencia: number;
};

export type PoliticaVigenciaAtribuicao = "ATUAL_OU_FUTURA" | "SOMENTE_ATUAL";

export type ResultadoPreparacaoAtribuicoes =
  | { ok: true; itens: AtribuicaoItem[]; repetidas: number }
  | { ok: false; mensagem: string };

type PrepararArgs = {
  candidatos: AtribuicaoItem[];
  existentes: Array<Pick<FilhoTarefa, "id_vigencia" | "id_filho" | "id_tarefa">>;
  vigencias: Array<Pick<Vigencia, "id" | "data_inicio" | "data_fim">>;
  politica: PoliticaVigenciaAtribuicao;
};

type ResultadoCadastroAtribuicoes =
  | {
      ok: true;
      quantidade: number;
      repetidas: number;
      modo: ModoVigenciaAtribuicao;
      idVigencia?: number;
      vigenciaCriada?: boolean;
    }
  | {
      ok: false;
      mensagem: string;
      erroBanco?: unknown;
    };

type RpcAutomaticaLoteLinha = {
  id_vigencia: number;
  vigencia_criada: boolean;
  quantidade: number;
  repetidas: number;
};

type RpcAutomaticaLoteResult = {
  data: unknown;
  error: unknown;
};

const mesmaAtribuicao = (a: AtribuicaoItem, b: AtribuicaoItem) =>
  a.id_vigencia === b.id_vigencia &&
  a.id_filho === b.id_filho &&
  a.id_tarefa === b.id_tarefa;

export async function obterModoVigenciaAtribuicao(): Promise<ModoVigenciaAtribuicao> {
  return (await obterVigenciaAutomaticaAtiva()) ? "AUTOMATICA" : "MANUAL";
}

export function prepararAtribuicoes({
  candidatos,
  existentes,
  vigencias,
  politica,
}: PrepararArgs): ResultadoPreparacaoAtribuicoes {
  if (candidatos.length === 0) {
    return { ok: false, mensagem: "Adicione ao menos uma atribuição" };
  }

  for (const item of candidatos) {
    const vigencia = vigencias.find((v) => v.id === item.id_vigencia);
    if (!vigencia) {
      return { ok: false, mensagem: "Vigência não encontrada" };
    }

    const situacao = situacaoVigencia(vigencia);

    if (politica === "SOMENTE_ATUAL" && situacao !== "andamento") {
      return { ok: false, mensagem: "A vigência atual não está mais em andamento" };
    }

    if (politica === "ATUAL_OU_FUTURA" && situacao === "finalizada") {
      return { ok: false, mensagem: "Não é possível criar atribuições em uma vigência finalizada" };
    }
  }

  const unicos = candidatos.filter(
    (item, index, todos) => todos.findIndex((outro) => mesmaAtribuicao(outro, item)) === index,
  );

  const itens = unicos.filter(
    (item) => !existentes.some((existente) => mesmaAtribuicao(existente, item)),
  );

  return {
    ok: true,
    itens,
    repetidas: candidatos.length - itens.length,
  };
}

type CadastrarArgs = Omit<PrepararArgs, "candidatos"> & {
  candidatos: AtribuicaoCandidato[];
};

async function cadastrarAtribuicoesAutomaticas(
  candidatos: AtribuicaoCandidato[],
): Promise<ResultadoCadastroAtribuicoes> {
  if (candidatos.length === 0) {
    return { ok: false, mensagem: "Adicione ao menos uma atribuição" };
  }

  const payload = candidatos.map(({ id_filho, id_tarefa }) => ({
    id_filho,
    id_tarefa,
  }));

  const rpc = supabase.rpc as unknown as (
    nome: string,
    args: Record<string, unknown>,
  ) => PromiseLike<RpcAutomaticaLoteResult>;

  const { data, error } = await rpc(
    "atribuir_tarefas_vigencia_automatica_lote",
    { p_atribuicoes: payload },
  );

  if (error) {
    return {
      ok: false,
      mensagem: "Não foi possível cadastrar as atribuições",
      erroBanco: error,
    };
  }

  const linha = (
    Array.isArray(data)
      ? data[0]
      : data
  ) as Partial<RpcAutomaticaLoteLinha> | null | undefined;

  if (!linha || typeof linha.quantidade !== "number") {
    return {
      ok: false,
      mensagem: "Não foi possível confirmar o cadastro das atribuições",
    };
  }

  return {
    ok: true,
    quantidade: linha.quantidade,
    repetidas: typeof linha.repetidas === "number" ? linha.repetidas : 0,
    modo: "AUTOMATICA",
    idVigencia: typeof linha.id_vigencia === "number" ? linha.id_vigencia : undefined,
    vigenciaCriada: linha.vigencia_criada === true,
  };
}

async function cadastrarAtribuicoesManuais(
  args: CadastrarArgs,
): Promise<ResultadoCadastroAtribuicoes> {
  const candidatosManuais: AtribuicaoItem[] = [];

  for (const candidato of args.candidatos) {
    if (typeof candidato.id_vigencia !== "number") {
      return { ok: false, mensagem: "Vigência não encontrada" };
    }

    candidatosManuais.push({
      id_vigencia: candidato.id_vigencia,
      id_filho: candidato.id_filho,
      id_tarefa: candidato.id_tarefa,
    });
  }

  const preparado = prepararAtribuicoes({
    ...args,
    candidatos: candidatosManuais,
  });
  if (!preparado.ok) return preparado;

  if (preparado.itens.length === 0) {
    return { ok: false, mensagem: "As atribuições selecionadas já existem" };
  }

  const { error } = await supabase.from("t_filho_tarefa").insert(preparado.itens);

  if (error) {
    return { ok: false, mensagem: error.message, erroBanco: error };
  }

  return {
    ok: true,
    quantidade: preparado.itens.length,
    repetidas: preparado.repetidas,
    modo: "MANUAL",
  };
}

export async function cadastrarAtribuicoes(
  args: CadastrarArgs,
): Promise<ResultadoCadastroAtribuicoes> {
  let modo: ModoVigenciaAtribuicao;

  try {
    modo = await obterModoVigenciaAtribuicao();
  } catch {
    return {
      ok: false,
      mensagem: "Não foi possível confirmar o modo de vigência. Tente novamente.",
    };
  }

  if (modo === "AUTOMATICA") {
    return cadastrarAtribuicoesAutomaticas(args.candidatos);
  }

  return cadastrarAtribuicoesManuais(args);
}
