/**
 * Centraliza detalhes de URL que mudam entre Web e o futuro app nativo.
 *
 * Hoje o comportamento continua 100% web. Quando o Capacitor for adicionado,
 * este arquivo será o ponto único para tratar deep links / app links sem
 * espalhar condicionais de plataforma pelas telas.
 */
export function getAppOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function getAuthRedirectUrl(path = "/"): string {
  const origin = getAppOrigin();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalizedPath}`;
}
