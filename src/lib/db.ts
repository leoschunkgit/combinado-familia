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

export type Filho = Tables<"t_filho">;
export type Vigencia = Tables<"t_vigencia">;
export type Tarefa = Tables<"t_tarefa">;
export type FilhoTarefa = Tables<"t_filho_tarefa"> & {
  t_filho: Pick<Filho, "nome"> | null;
  t_tarefa: Pick<Tarefa, "nome"> | null;
  t_vigencia: Pick<Vigencia, "data_inicio" | "data_fim" | "penalidade" | "qtd_ocorrencia" | "tipo_penalidade" | "valor_debito"> | null;
};

async function unwrap<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

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
    queryFn: () => unwrap<Tarefa[]>(supabase.from("t_tarefa").select("*").order("nome")),
  });

export const FT_SELECT =
  "*, t_filho:t_filho!t_filho_tarefa_id_filho_fkey(nome), t_tarefa:t_tarefa!t_filho_tarefa_id_tarefa_fkey(nome), t_vigencia:t_vigencia!t_filho_tarefa_id_vigencia_fkey(data_inicio, data_fim, penalidade, qtd_ocorrencia, tipo_penalidade, valor_debito)";

export const useFilhoTarefas = () =>
  useQuery({
    queryKey: ["filho_tarefas"],
    queryFn: () =>
      unwrap<FilhoTarefa[]>(
        supabase.from("t_filho_tarefa").select(FT_SELECT).order("created_at", { ascending: false }),
      ),
  });

export type Ocorrencia = Tables<"t_ocorrencia"> & {
  t_filho_tarefa:
    | (Pick<Tables<"t_filho_tarefa">, "id_filho" | "id_vigencia" | "id_tarefa"> & {
        t_filho: Pick<Filho, "nome"> | null;
        t_tarefa: Pick<Tarefa, "nome"> | null;
        t_vigencia: Pick<Vigencia, "data_inicio" | "data_fim" | "penalidade" | "tipo_penalidade" | "valor_debito"> | null;
      })
    | null;
};

export const useOcorrencias = () =>
  useQuery({
    queryKey: ["ocorrencias"],
    queryFn: () =>
      unwrap<Ocorrencia[]>(
        supabase
          .from("t_ocorrencia")
          .select(
             "*, t_filho_tarefa:t_filho_tarefa!t_ocorrencia_id_filho_tarefa_fkey(id_filho, id_vigencia, id_tarefa, t_filho:t_filho!t_filho_tarefa_id_filho_fkey(nome), t_tarefa:t_tarefa!t_filho_tarefa_id_tarefa_fkey(nome), t_vigencia:t_vigencia!t_filho_tarefa_id_vigencia_fkey(data_inicio, data_fim, penalidade, tipo_penalidade, valor_debito))",
          )
          .order("created_at", { ascending: false }),
      ),
  });

const ERROS: [RegExp, string][] = [
  [/Atribuicao com Fez\/Nao fez nao pode ser excluida diretamente|Atribuição com Fez\/Não fez não pode ser excluída diretamente/i, "Esta atribuição já tem registros de Fez/Não fez e não pode ser excluída"],
  [/Atribuicao com Fez\/Nao fez nao pode ser editada|Atribuição com Fez\/Não fez não pode ser editada/i, "Esta atribuição já tem registros de Fez/Não fez e não pode ser alterada"],
  [/Vigência com atribuições não pode ser excluída|Vigencia com atribuicoes nao pode ser excluida/i, "Esta vigência tem atribuições e não pode ser excluída"],
  [/Há registros de Fez\/Não fez fora do novo período da vigência|Ha registros de Fez\/Nao fez fora do novo periodo da vigencia/i, "Há registros de Fez/Não fez fora do novo período. Corrija-os antes de salvar"],
  [/Já existe uma vigência nesse período|Ja existe uma vigencia nesse periodo/i, "Já existe uma vigência nesse período. As vigências não podem se sobrepor"],
  [/Fez\/Não fez só pode ser alterado em vigência em andamento|Fez\/Nao fez so pode ser alterado em vigencia em andamento/i, "Fez/Não fez só pode ser alterado em vigência em andamento"],
  [/A data do Fez\/Não fez deve estar dentro da vigência|A data do Fez\/Nao fez deve estar dentro da vigencia/i, "A data do Fez/Não fez deve estar dentro da vigência"],
  [/Não é permitido registrar Fez\/Não fez em data futura|Nao e permitido registrar Fez\/Nao fez em data futura/i, "Não é permitido registrar Fez/Não fez em data futura"],
  [/invalid login credentials/i, "Email ou senha incorretos"],
  [/email not confirmed/i, "Confirme seu email antes de entrar"],
  [/user already registered|already been registered/i, "Este email já está cadastrado"],
  [/password should be at least/i, "A senha deve ter pelo menos 6 caracteres"],
  [/weak password|password.*(breach|known|compromised)/i, "Senha muito fraca. Escolha outra"],
  [/unable to validate email|invalid email|email.*invalid/i, "Email inválido"],
  [/duplicate key|already exists|unique constraint/i, "Este registro já existe"],
  [/violates foreign key|foreign key/i, "Este registro está em uso e não pode ser removido"],
  [/row-level security|permission denied|not authorized|unauthorized/i, "Você não tem permissão para esta ação"],
  [/violates not-null|null value/i, "Preencha todos os campos obrigatórios"],
  [/violates check|check constraint/i, "Valor inválido para um dos campos"],
  [/invalid input syntax/i, "Valor em formato inválido"],
  [/value too long/i, "Um dos campos ultrapassou o tamanho máximo"],
  [/out of range/i, "Valor fora do intervalo permitido"],
  [/does not exist|not found/i, "Registro não encontrado"],
  [/failed to fetch|network|fetch failed|load failed|econnrefused|timeout/i, "Sem conexão. Verifique sua internet"],
  [/jwt|token|session/i, "Sua sessão expirou. Entre novamente"],
  [/rate limit|too many requests|over_email_send_rate/i, "Muitas tentativas. Aguarde um instante"],
  [/signup.*(disabled|not allowed)|signups/i, "Cadastro temporariamente indisponível"],
];

export function msgErro(error: { message?: string } | null): string {
  const m = error?.message ?? "";
  for (const [re, msg] of ERROS) if (re.test(m)) return msg;
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
