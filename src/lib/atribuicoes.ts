import { supabase } from "@/integrations/supabase/client";
import type { FilhoTarefa, Vigencia } from "@/lib/db";
import { situacaoVigencia } from "@/components/VigenciaStatus";

export type AtribuicaoItem = {
  id_vigencia: number;
  id_filho: number;
  id_tarefa: number;
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

const mesmaAtribuicao = (a: AtribuicaoItem, b: AtribuicaoItem) =>
  a.id_vigencia === b.id_vigencia &&
  a.id_filho === b.id_filho &&
  a.id_tarefa === b.id_tarefa;

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

type CadastrarArgs = PrepararArgs;

export async function cadastrarAtribuicoes(args: CadastrarArgs) {
  const preparado = prepararAtribuicoes(args);
  if (!preparado.ok) return preparado;

  if (preparado.itens.length === 0) {
    return { ok: false as const, mensagem: "As atribuições selecionadas já existem" };
  }

  const { error } = await supabase.from("t_filho_tarefa").insert(preparado.itens);

  if (error) {
    return { ok: false as const, mensagem: error.message, erroBanco: error };
  }

  return {
    ok: true as const,
    quantidade: preparado.itens.length,
    repetidas: preparado.repetidas,
  };
}
