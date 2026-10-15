/**
 * Centraliza detalhes de URL que mudam entre Web e o futuro app nativo.
 *
 * A URL pública é deliberadamente separada da origem interna do WebView:
 * links compartilháveis precisam continuar apontando para o domínio oficial
 * para funcionarem no navegador e, futuramente, como Android App Links /
 * iOS Universal Links.
 */
const DEFAULT_PUBLIC_WEB_ORIGIN = "https://www.combinadofamilia.app.br";
const DEV_PUBLIC_WEB_ORIGIN = "https://combinado-familia-dev.netlify.app";
const DEV_SUPABASE_PROJECT_ID = "ewljvqwuxwhhxdxqezhn";
const PUBLIC_APP_HOSTS = new Set([
  "combinadofamilia.app.br",
  "www.combinadofamilia.app.br",
  "combinado-familia-dev.netlify.app",
]);

function normalizeOrigin(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getAppOrigin(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function getAppEnvironment(): "DEV" | "PRD" {
  const projectId =
    typeof import.meta !== "undefined"
      ? import.meta.env["VITE_SUPABASE_PROJECT_ID"]
      : undefined;

  return projectId === DEV_SUPABASE_PROJECT_ID ? "DEV" : "PRD";
}

export function getPublicWebOrigin(): string {
  const configured =
    typeof import.meta !== "undefined"
      ? import.meta.env["VITE_PUBLIC_APP_URL"]
      : undefined;

  if (configured) return normalizeOrigin(configured);

  return getAppEnvironment() === "DEV"
    ? DEV_PUBLIC_WEB_ORIGIN
    : DEFAULT_PUBLIC_WEB_ORIGIN;
}

export function getAuthRedirectUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getPublicWebOrigin()}${normalizedPath}`;
}

export function getChildTrackingUrl(token: string): string {
  return `${getPublicWebOrigin()}/acompanhar/${encodeURIComponent(token)}`;
}

export function getPublicRouteFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (!PUBLIC_APP_HOSTS.has(url.hostname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
