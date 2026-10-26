import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

// Mensagens de validação sempre em português
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case "too_small":
      return {
        message:
          issue.type === "string"
            ? `Informe pelo menos ${issue.minimum} caracteres`
            : issue.type === "number"
              ? `O valor mínimo é ${issue.minimum}`
              : "Valor muito curto",
      };
    case "too_big":
      return {
        message:
          issue.type === "string"
            ? `Informe no máximo ${issue.maximum} caracteres`
            : issue.type === "number"
              ? `O valor máximo é ${issue.maximum}`
              : "Valor muito longo",
      };
    case "invalid_type":
      return { message: "Valor inválido" };
    case "invalid_string":
      return { message: issue.validation === "email" ? "Email inválido" : "Formato inválido" };
    default:
      return { message: ctx.defaultError };
  }
});

export type UsuarioPai = Tables<"t_usuario_pai">;
export type Filho = Tables<"t_filho">;
export type Vigencia = Tables<"t_vigencia">;
export type Tarefa = Tables<"t_tarefa">;
export type FilhoVigenciaMesada = Tables<"t_filho_vigencia_mesada">;
export type FilhoTarefa = Tables<"t_filho_tarefa"> & {
  t_filho: Pick<Filho, "nome"> | null;
  t_tarefa: Pick<Tarefa, "nome"> | null;
  t_vigencia: Pick<Vigencia, "data_inicio" | "data_fim"> | null;
};

async function unwrap<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

export const useUsuarioPai = () =>
  useQuery({
    queryKey: ["usuario_pai"],
    queryFn: () =>
      unwrap<UsuarioPai>(
        supabase.from("t_usuario_pai").select("*").single(),
      ),
  });

export const useFilhos = () =>
  useQuery({
    queryKey: ["filhos"],
    queryFn: () => unwrap<Filho[]>(supabase.from("t_filho").select("*").order("nome")),
  });

export const useVigencias = () =>
  useQuery({
    queryKey: ["vigencias"],
    queryFn: () =>
      unwrap<Vigencia[]>(supabase.from("t_vigencia").select("*").order("data_inicio", { ascending: false })),
  });

export const useTarefas = () =>
  useQuery({
    queryKey: ["tarefas"],
    queryFn: () => unwrap<Tarefa[]>(supabase.from("t_tarefa").select("*").eq("ativo", true).order("nome")),
  });

export const useFilhoVigenciaMesadas = () =>
  useQuery({
    queryKey: ["filho_vigencia_mesadas"],
    queryFn: () =>
      unwrap<FilhoVigenciaMesada[]>(
        supabase.from("t_filho_vigencia_mesada").select("*"),
      ),
  });

export const FT_SELECT =
  "*, t_filho:t_filho!t_filho_tarefa_id_filho_fkey(nome), t_tarefa:t_tarefa!t_filho_tarefa_id_tarefa_fkey(nome), t_vigencia:t_vigencia!t_filho_tarefa_id_vigencia_fkey(data_inicio, data_fim)";

export const useFilhoTarefas = () =>
  useQuery({
    queryKey: ["filho_tarefas"],
    queryFn: () =>
      unwrap<FilhoTarefa[]>(
        supabase.from("t_filho_tarefa").select(FT_SELECT).order("created_at", { ascending: false }),
      ),
  });

export type SolicitacaoTarefaFilho = Tables<"t_solicitacao_tarefa_filho">;

export const useSolicitacoesTarefaFilho = () =>
  useQuery({
    queryKey: ["solicitacoes_tarefa_filho"],
    queryFn: () =>
      unwrap<SolicitacaoTarefaFilho[]>(
        supabase
          .from("t_solicitacao_tarefa_filho")
          .select("*")
          .order("created_at", { ascending: false }),
      ),
    refetchInterval: 5_000,
  });

export type OcorrenciaConsequencia = Tables<"t_ocorrencia_consequencia">;

export type Ocorrencia = Tables<"t_ocorrencia"> & {
  t_filho_tarefa:
    | (Pick<Tables<"t_filho_tarefa">, "id_filho" | "id_vigencia" | "id_tarefa"> & {
        t_filho: Pick<Filho, "nome"> | null;
        t_tarefa: Pick<Tarefa, "nome"> | null;
        t_vigencia: Pick<Vigencia, "data_inicio" | "data_fim"> | null;
      })
    | null;
  t_ocorrencia_consequencia: OcorrenciaConsequencia | null;
};

export const useOcorrencias = () =>
  useQuery({
    queryKey: ["ocorrencias"],
    queryFn: () =>
      unwrap<Ocorrencia[]>(
        supabase
          .from("t_ocorrencia")
          .select(
            "*, t_ocorrencia_consequencia:t_ocorrencia_consequencia!t_ocorrencia_consequencia_id_ocorrencia_fkey(*), t_filho_tarefa:t_filho_tarefa!t_ocorrencia_id_filho_tarefa_fkey(id_filho, id_vigencia, id_tarefa, t_filho:t_filho!t_filho_tarefa_id_filho_fkey(nome), t_tarefa:t_tarefa!t_filho_tarefa_id_tarefa_fkey(nome), t_vigencia:t_vigencia!t_filho_tarefa_id_vigencia_fkey(data_inicio, data_fim))",
          )
          .order("created_at", { ascending: false }),
      ),
  });

type ErroAplicacao = {
  message?: string;
  code?: string;
};

const MENSAGENS_POR_CODIGO: Record<string, string> = {
  "42501": "Você não tem permissão para esta ação",
  "23505": "Este registro já existe",
  "23503": "Este registro está em uso e não pode ser removido",
  "23502": "Preencha todos os campos obrigatórios",
  "23514": "Valor inválido para um dos campos",
  "22P02": "Valor em formato inválido",
  "22001": "Um dos campos ultrapassou o tamanho máximo",
  "22003": "Valor fora do intervalo permitido",
};

const ERROS_TECNICOS: [RegExp, string][] = [
  [/invalid login credentials/i, "Email ou senha incorretos"],
  [/email not confirmed/i, "Confirme seu email antes de entrar"],
  [/user already registered|already been registered/i, "Este email já está cadastrado"],
  [/password should be at least/i, "A senha deve ter pelo menos 6 caracteres"],
  [/weak password|password.*(breach|known|compromised)/i, "Senha muito fraca. Escolha outra"],
  [/unable to validate email|invalid email|email.*invalid/i, "Email inválido"],
  [/row-level security|permission denied|not authorized|unauthorized/i, "Você não tem permissão para esta ação"],
  [/does not exist|not found/i, "Registro não encontrado"],
  [/failed to fetch|network|fetch failed|load failed|econnrefused|timeout/i, "Sem conexão. Verifique sua internet"],
  [/jwt|token|session/i, "Sua sessão expirou. Entre novamente"],
  [/rate limit|too many requests|over_email_send_rate/i, "Muitas tentativas. Aguarde um instante"],
  [/signup.*(disabled|not allowed)|signups/i, "Cadastro temporariamente indisponível"],
];

export function msgErro(error: ErroAplicacao | null): string {
  const mensagem = error?.message?.trim() ?? "";
  const codigo = error?.code?.trim() ?? "";

  // Regra de negócio centralizada no PostgreSQL.
  // RAISE EXCEPTION sem ERRCODE explícito retorna P0001 no PostgREST/Supabase.
  // A mensagem deliberadamente definida no banco é a fonte de verdade.
  if (codigo === "P0001" && mensagem) {
    return mensagem;
  }

  const mensagemPorCodigo = MENSAGENS_POR_CODIGO[codigo];
  if (mensagemPorCodigo) {
    return mensagemPorCodigo;
  }

  for (const [padrao, texto] of ERROS_TECNICOS) {
    if (padrao.test(mensagem)) return texto;
  }

  return "Não foi possível concluir a operação. Tente novamente.";
}

export const fmtData = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

export const fmtDataHora = (d: string) =>
  new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Sao_Paulo" });

export const fmtVigencia = (v: Pick<Vigencia, "data_inicio" | "data_fim">) =>
  `${fmtDataHora(v.data_inicio)} à ${fmtDataHora(v.data_fim)}`;

export const paraCampoDataHoraBrasil = (d: string) => {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(d));
  const partesMap = Object.fromEntries(partes.map((item) => [item.type, item.value]));
  return partesMap["year"] + "-" + partesMap["month"] + "-" + partesMap["day"] + "T" + partesMap["hour"] + ":" + partesMap["minute"];
};

export const paraIsoDataHoraBrasil = (valor: string) =>
  new Date(valor + ":00-03:00").toISOString();

export const maskCelular = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
