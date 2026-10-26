export type CategoriaSugestoesTarefa = {
  categoria: string;
  sugestoes: readonly string[];
};

export const TAREFA_SUGESTOES_CATEGORIAS: readonly CategoriaSugestoesTarefa[] = [
  {
    categoria: "Rotina",
    sugestoes: [
      "Arrumar a cama",
      "Escovar os dentes",
      "Tomar banho",
      "Guardar o pijama",
      "Sair na hora para a escola",
    ],
  },
  {
    categoria: "Estudos",
    sugestoes: [
      "Fazer a lição",
      "Organizar a mochila",
      "Ler por 20 minutos",
      "Estudar para a prova",
      "Assistir à aula de inglês",
    ],
  },
  {
    categoria: "Casa",
    sugestoes: [
      "Organizar o quarto",
      "Guardar os brinquedos",
      "Ajudar a pôr a mesa",
      "Guardar as roupas",
      "Trocar o lixo",
      "Varrer a casa",
      "Lavar a louça",
      "Guardar a louça",
      "Passar pano na casa",
    ],
  },
  {
    categoria: "Responsabilidades",
    sugestoes: [
      "Alimentar o pet",
      "Guardar o material",
      "Preparar a roupa do dia seguinte",
      "Ajudar a tirar a mesa",
      "Levar o pet para passear",
    ],
  },
] as const;

export function normalizarNomeTarefa(valor: string) {
  return valor
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR");
}

export function encontrarTarefaEquivalente<T extends { nome: string }>(
  tarefas: readonly T[],
  nome: string,
  ignorarId?: number,
) {
  const normalizado = normalizarNomeTarefa(nome);

  return tarefas.find((tarefa) => {
    const id = "id" in tarefa && typeof tarefa.id === "number" ? tarefa.id : undefined;
    return id !== ignorarId && normalizarNomeTarefa(tarefa.nome) === normalizado;
  });
}
