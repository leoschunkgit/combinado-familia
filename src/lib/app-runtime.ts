/**
 * Centraliza detalhes de URL que mudam entre Web e o futuro app nativo.
 *
 * A URL pública é deliberadamente separada da origem interna do WebView:
 * links compartilháveis precisam continuar apontando para o domínio oficial
 * para funcionarem no navegador e, futuramente, como Android App Links /
 * iOS Universal Links.
 */
const DEFAULT_PUBLIC_WEB_ORIGIN = "https://www.combinadofamilia.app";

function normalizeOrigin(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getAppOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function getPublicWebOrigin(): string {
  const configured =
    typeof import.meta !== "undefined"
      ? import.meta.env["VITE_PUBLIC_APP_URL"]
      : undefined;

  return normalizeOrigin(configured || DEFAULT_PUBLIC_WEB_ORIGIN);
}

export function getAuthRedirectUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getPublicWebOrigin()}${normalizedPath}`;
}

export function getChildTrackingUrl(token: string): string {
  return `${getPublicWebOrigin()}/acompanhar/${encodeURIComponent(token)}`;
}
