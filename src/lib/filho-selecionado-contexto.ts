const CHAVE_FILHO_SELECIONADO = "combinado:filho-selecionado-contexto";

export function obterFilhoSelecionadoCompartilhado(): number | null {
  if (typeof window === "undefined") return null;

  const valor = Number(window.sessionStorage.getItem(CHAVE_FILHO_SELECIONADO));
  return Number.isInteger(valor) && valor > 0 ? valor : null;
}

export function definirFilhoSelecionadoCompartilhado(idFilho: number | null) {
  if (typeof window === "undefined") return;

  if (idFilho === null) {
    window.sessionStorage.removeItem(CHAVE_FILHO_SELECIONADO);
    return;
  }

  window.sessionStorage.setItem(CHAVE_FILHO_SELECIONADO, String(idFilho));
}
