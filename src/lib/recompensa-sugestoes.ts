export type CategoriaSugestoesRecompensa = {
  categoria: string;
  sugestoes: readonly string[];
};

export const RECOMPENSA_SUGESTOES_CATEGORIAS: readonly CategoriaSugestoesRecompensa[] = [
  {
    categoria: "Passeios e experiências",
    sugestoes: [
      "Ir ao cinema",
      "Passeio especial",
    ],
  },
  {
    categoria: "Escolhas",
    sugestoes: [
      "Escolher o jantar",
      "Escolher o filme",
      "Escolher uma sobremesa",
    ],
  },
  {
    categoria: "Tempo livre",
    sugestoes: [
      "Dormir mais tarde",
      "Dia de videogame",
    ],
  },
  {
    categoria: "Presentes",
    sugestoes: [
      "Ganhar um brinquedo",
    ],
  },
] as const;

export function normalizarNomeRecompensa(valor: string) {
  return valor
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR");
}
