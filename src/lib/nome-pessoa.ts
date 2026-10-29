export function nomePessoaMaiusculo(valor: string) {
  return valor.toLocaleUpperCase("pt-BR");
}

export function nomePessoaCanonico(valor: string) {
  return nomePessoaMaiusculo(valor.trim());
}
