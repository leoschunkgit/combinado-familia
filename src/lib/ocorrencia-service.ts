import { supabase } from "@/integrations/supabase/client";

export type ConsequenciaNaoFezTipo = "NENHUMA" | "DESCONTO" | "PENALIDADE";

type ReconciliarBase = {
  idOcorrencia?: number;
  idFilhoTarefa?: number;
  dataIso?: string;
  motivo?: string;
};

type RegistrarFezInput = ReconciliarBase;

type RegistrarNaoFezInput = ReconciliarBase & {
  consequenciaTipo: ConsequenciaNaoFezTipo;
  descontoValor?: number | null;
  penalidadeDescricao?: string | null;
};

async function reconciliar(params: {
  acao: "SALVAR" | "CUMPRIR_PENALIDADE";
  idOcorrencia?: number;
  idFilhoTarefa?: number;
  dataIso?: string;
  novoTipo?: "FEZ" | "NAO_FEZ" | "NAO_PRECISOU";
  consequenciaTipo?: ConsequenciaNaoFezTipo;
  descontoValor?: number | null;
  penalidadeDescricao?: string | null;
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
    p_motivo: params.motivo?.trim() || null,
  });

  if (error) throw error;
  return data;
}

export function registrarFez(input: RegistrarFezInput) {
  return reconciliar({
    acao: "SALVAR",
    idOcorrencia: input.idOcorrencia,
    idFilhoTarefa: input.idFilhoTarefa,
    dataIso: input.dataIso,
    novoTipo: "FEZ",
    motivo: input.motivo,
  });
}

export function registrarNaoPrecisou(input: RegistrarFezInput) {
  return reconciliar({
    acao: "SALVAR",
    idOcorrencia: input.idOcorrencia,
    idFilhoTarefa: input.idFilhoTarefa,
    dataIso: input.dataIso,
    novoTipo: "NAO_PRECISOU",
    motivo: input.motivo,
  });
}

export function registrarNaoFez(input: RegistrarNaoFezInput) {
  return reconciliar({
    acao: "SALVAR",
    idOcorrencia: input.idOcorrencia,
    idFilhoTarefa: input.idFilhoTarefa,
    dataIso: input.dataIso,
    novoTipo: "NAO_FEZ",
    consequenciaTipo: input.consequenciaTipo,
    descontoValor: input.descontoValor,
    penalidadeDescricao: input.penalidadeDescricao,
    motivo: input.motivo,
  });
}


export function cumprirPenalidade(idOcorrencia: number) {
  return reconciliar({
    acao: "CUMPRIR_PENALIDADE",
    idOcorrencia,
  });
}
