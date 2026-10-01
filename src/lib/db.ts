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
  t_vigencia: Pick<Vigencia, "data_inicio" | "data_fim" | "penalidade" | "qtd_ocorrencia"> | null;
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
  "*, t_filho(nome), t_tarefa(nome), t_vigencia(data_inicio, data_fim, penalidade, qtd_ocorrencia)";

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
    | (Pick<Tables<"t_filho_tarefa">, "id_filho" | "id_vigencia"> & {
        t_filho: Pick<Filho, "nome"> | null;
        t_tarefa: Pick<Tarefa, "nome"> | null;
        t_vigencia: Pick<Vigencia, "data_inicio" | "data_fim" | "penalidade"> | null;
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
            "*, t_filho_tarefa(id_filho, id_vigencia, t_filho(nome), t_tarefa(nome), t_vigencia(data_inicio, data_fim, penalidade))",
          )
          .order("created_at", { ascending: false }),
      ),
  });

const ERROS: [RegExp, string][] = [
  [/Filho com Não fez nesta vigência/i, "Este filho já tem registros de ‘Não fez’ nesta vigência. Não é possível editar ou excluir a atribuição"],
  [/Vigência com atribuições não pode ser excluída/i, "Esta vigência tem atribuições e não pode ser excluída"],
  [/Limite menor que o número de Não fez/i, "O limite não pode ser menor que os registros de ‘Não fez’ já acumulados por um filho"],
  [/Há datas de Não fez fora do novo período/i, "Há datas de ‘Não fez’ fora do novo período. Corrija-as em Ocorrências"],
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
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export const fmtVigencia = (v: Pick<Vigencia, "data_inicio" | "data_fim">) =>
  `${fmtData(v.data_inicio)} à ${fmtData(v.data_fim)}`;

export const maskCpf = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

export const maskCelular = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
