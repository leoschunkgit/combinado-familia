import { supabase } from "@/integrations/supabase/client";

export type ConsequenciaNaoFezTipo = "NENHUMA" | "DESCONTO" | "PENALIDADE";
export type DecisaoRevisao = "MANTER_NAO_FEZ" | "ALTERAR_PARA_FEZ";

type ReconciliarBase = {
  idOcorrencia?: number;
  idFilhoTarefa?: number;
  dataIso?: string;
  motivo?: string;
};

type RegistrarFezInput = ReconciliarBase & {
  idRevisao?: number;
};

type RegistrarNaoFezInput = ReconciliarBase & {
  consequenciaTipo: ConsequenciaNaoFezTipo;
  descontoValor?: number | null;
  penalidadeDescricao?: string | null;
  idRevisao?: number;
};

async function reconciliar(params: {
  acao: "SALVAR" | "DESFAZER" | "CUMPRIR_PENALIDADE" | "RESOLVER_REVISAO";
  idOcorrencia?: number;
  idFilhoTarefa?: number;
  dataIso?: string;
  novoTipo?: "FEZ" | "NAO_FEZ";
  consequenciaTipo?: ConsequenciaNaoFezTipo;
  descontoValor?: number | null;
  penalidadeDescricao?: string | null;
  idRevisao?: number;
  motivo?: string;
}) {
  const { data, error } = await supabase.rpc("reconciliar_ocorrencia", {
    p_acao: params.acao,
    p_id_ocorrencia: params.idOcorrencia ?? null,
    p_id_filho_tarefa: params.idFilhoTarefa ?? null,
    p_created_at: params.dataIso ?? null,
    p_novo_tipo: params.novoTipo ?? null,
    p_consequencia_tipo: params.consequenciaTipo ?? null,
    p_desconto_valor: params.descontoValor ?? null,
    p_penalidade_descricao: params.penalidadeDescricao?.trim() || null,
    p_id_revisao: params.idRevisao ?? null,
    p_motivo: params.motivo?.trim() || null,
  });

  if (error) throw error;
  return data;
}

export function registrarFez(input: RegistrarFezInput) {
  return reconciliar({
    acao: input.idRevisao ? "RESOLVER_REVISAO" : "SALVAR",
    idOcorrencia: input.idOcorrencia,
    idFilhoTarefa: input.idFilhoTarefa,
    dataIso: input.dataIso,
    novoTipo: "FEZ",
    idRevisao: input.idRevisao,
    motivo: input.motivo,
  });
}

export function registrarNaoFez(input: RegistrarNaoFezInput) {
  return reconciliar({
    acao: input.idRevisao ? "RESOLVER_REVISAO" : "SALVAR",
    idOcorrencia: input.idOcorrencia,
    idFilhoTarefa: input.idFilhoTarefa,
    dataIso: input.dataIso,
    novoTipo: "NAO_FEZ",
    consequenciaTipo: input.consequenciaTipo,
    descontoValor: input.descontoValor,
    penalidadeDescricao: input.penalidadeDescricao,
    idRevisao: input.idRevisao,
    motivo: input.motivo,
  });
}

export function desfazerOcorrencia(idOcorrencia: number, motivo?: string) {
  return reconciliar({
    acao: "DESFAZER",
    idOcorrencia,
    motivo,
  });
}

export type DesfazerOcorrenciasResultado = {
  ok: boolean;
  quantidade_solicitada: number;
  quantidade_desfeita: number;
  quantidade_preservada: number;
  ids_desfeitos: number[];
  ids_preservados: number[];
};

export async function desfazerOcorrencias(
  ids: number[],
): Promise<DesfazerOcorrenciasResultado> {
  const { data, error } = await supabase.rpc("desfazer_ocorrencias", {
    p_ids: ids,
  });

  if (error) throw error;
  return data as unknown as DesfazerOcorrenciasResultado;
}

export function cumprirPenalidade(idOcorrencia: number) {
  return reconciliar({
    acao: "CUMPRIR_PENALIDADE",
    idOcorrencia,
  });
}

export async function resolverRevisao(
  idRevisao: number,
  decisao: DecisaoRevisao,
) {
  const { data, error } = await supabase.rpc("resolver_revisao_tarefa_filho", {
    p_id_revisao: idRevisao,
    p_decisao: decisao,
  });

  if (error) throw error;
  return data;
}
