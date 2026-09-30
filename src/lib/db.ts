import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

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
