export type IconeSugestaoRecompensa =
  | "UTENSILS"
  | "PIZZA"
  | "FILM"
  | "GAMEPAD"
  | "MOON"
  | "SUN"
  | "MAP_PIN"
  | "GIFT"
  | "SHOPPING_BAG"
  | "MUSIC"
  | "TV"
  | "CROWN"
  | "STAR";

export type SugestaoRecompensa = {
  nome: string;
  icone: IconeSugestaoRecompensa;
};

export type CategoriaSugestoesRecompensa = {
  categoria: string;
  sugestoes: readonly SugestaoRecompensa[];
};

export const RECOMPENSA_SUGESTOES_CATEGORIAS: readonly CategoriaSugestoesRecompensa[] = [
  {
    categoria: "Comidinhas",
    sugestoes: [
      { nome: "Escolhe seu lanche!", icone: "UTENSILS" },
      { nome: "Escolhe a pizza!", icone: "PIZZA" },
      { nome: "Escolhe o jantar!", icone: "UTENSILS" },
      { nome: "Escolhe a sobremesa!", icone: "STAR" },
      { nome: "Partiu comer fora!", icone: "UTENSILS" },
      { nome: "Escolhe um doce!", icone: "STAR" },
      { nome: "Partiu sorvete!", icone: "STAR" },
      { nome: "Escolhe sua bebida favorita!", icone: "STAR" },
    ],
  },
  {
    categoria: "Passeios e diversão",
    sugestoes: [
      { nome: "Partiu cinema!", icone: "FILM" },
      { nome: "Partiu passeio especial!", icone: "MAP_PIN" },
      { nome: "Escolhe o passeio!", icone: "MAP_PIN" },
      { nome: "Dia de videogame!", icone: "GAMEPAD" },
      { nome: "Escolhe o jogo de hoje!", icone: "GAMEPAD" },
    ],
  },
  {
    categoria: "Tempo livre e escolhas",
    sugestoes: [
      { nome: "Escolhe o filme!", icone: "FILM" },
      { nome: "Hoje pode dormir mais tarde!", icone: "MOON" },
      { nome: "Pode acordar mais tarde!", icone: "SUN" },
      { nome: "Escolhe a música no carro!", icone: "MUSIC" },
      { nome: "Escolhe o que vamos assistir!", icone: "TV" },
      { nome: "Hoje você escolhe o programa!", icone: "CROWN" },
    ],
  },
  {
    categoria: "Presentes e brindes",
    sugestoes: [
      { nome: "Escolhe um presente de até R$ 10!", icone: "GIFT" },
      { nome: "Escolhe um presente de até R$ 20!", icone: "GIFT" },
      { nome: "Escolhe um presente de até R$ 30!", icone: "GIFT" },
      { nome: "Escolhe um presente de até R$ 40!", icone: "GIFT" },
      { nome: "Escolhe um presente de até R$ 50!", icone: "GIFT" },
      { nome: "Ganhou um brinde de R$ 10!", icone: "GIFT" },
      { nome: "Ganhou um brinde de R$ 20!", icone: "GIFT" },
      { nome: "Escolhe uma lembrancinha!", icone: "SHOPPING_BAG" },
      { nome: "Dia de recompensa especial!", icone: "CROWN" },
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

export function obterIconeRecompensaPorNome(nome: string): IconeSugestaoRecompensa | null {
  const nomeNormalizado = normalizarNomeRecompensa(nome);

  for (const grupo of RECOMPENSA_SUGESTOES_CATEGORIAS) {
    const sugestao = grupo.sugestoes.find(
      (item) => normalizarNomeRecompensa(item.nome) === nomeNormalizado,
    );
    if (sugestao) return sugestao.icone;
  }

  return null;
}
