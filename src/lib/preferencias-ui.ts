export function lerPreferenciaLocal<T>(chave: string, padrao: T): T {
  if (typeof window === "undefined") return padrao;

  try {
    const valor = window.localStorage.getItem(chave);
    if (valor === null) return padrao;
    return JSON.parse(valor) as T;
  } catch {
    return padrao;
  }
}

export function salvarPreferenciaLocal<T>(chave: string, valor: T): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Preferência de interface não deve bloquear o uso da aplicação.
  }
}
