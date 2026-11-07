import Cookies from "js-cookie";

/**
 * Único lugar do front que grava, lê e apaga os tokens da sessão.
 * Antes isso estava copiado em 5 arquivos, com opções de cookie diferentes.
 */

const ACCESS_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";
const USER_ID_KEY = "userId";

/** A vida do cookie acompanha a do token no backend: access 15 min, refresh 7 dias. */
const ACCESS_TTL_DAYS = 15 / (24 * 60);
const REFRESH_TTL_DAYS = 7;

export interface SessionTokens {
  accessToken: string;
  refreshToken?: string;
}

function cookieOptions(days: number): Cookies.CookieAttributes {
  return {
    expires: days,
    path: "/",
    sameSite: "lax",
    // Protocolo real da página: cookie Secure só funciona em HTTPS e
    // NODE_ENV=production não garante HTTPS (ex.: IP direto na AWS).
    secure: window.location.protocol === "https:",
  };
}

/** Grava os tokens (cookie lido pelo middleware + localStorage lido pelo apiFetch). */
export function storeSession(tokens: SessionTokens): void {
  if (typeof window === "undefined") return;

  Cookies.set(ACCESS_KEY, tokens.accessToken, cookieOptions(ACCESS_TTL_DAYS));
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);

  if (tokens.refreshToken) {
    Cookies.set(REFRESH_KEY, tokens.refreshToken, cookieOptions(REFRESH_TTL_DAYS));
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  }
}

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage indisponível (ex.: modo privado restrito)
  }
}

export function getAccessToken(): string | null {
  return readStorage(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return readStorage(REFRESH_KEY);
}

/** Apaga tokens e identificação local. Best-effort: nunca lança. */
export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_ID_KEY);
    Cookies.remove(ACCESS_KEY, { path: "/" });
    Cookies.remove(REFRESH_KEY, { path: "/" });
  } catch {
    // best-effort
  }
}
