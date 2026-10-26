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
    ],
  },
  {
    categoria: "Estudos",
    sugestoes: [
      "Fazer a lição",
      "Organizar a mochila",
      "Ler por 20 minutos",
      "Estudar para a prova",
    ],
  },
  {
    categoria: "Casa",
    sugestoes: [
      "Organizar o quarto",
      "Guardar os brinquedos",
      "Ajudar a pôr a mesa",
      "Guardar as roupas",
    ],
  },
  {
    categoria: "Responsabilidades",
    sugestoes: [
      "Alimentar o pet",
      "Guardar o material",
      "Preparar a roupa do dia seguinte",
      "Ajudar a tirar a mesa",
    ],
  },
] as const;

export function normalizarNomeTarefa(valor: string) {
  return valor
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}
