import { clearSession, getRefreshToken } from "./session";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/** Rede lenta não pode travar o botão "Sair": passado esse tempo, só limpa o estado local. */
const LOGOUT_TIMEOUT_MS = 5000;

/**
 * Revoga a sessão no backend e limpa o estado local.
 * Não lança exceção — o logout local sempre ocorre mesmo se a API falhar.
 */
export async function logout(): Promise<void> {
  try {
    const refreshToken = getRefreshToken();

    if (refreshToken) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LOGOUT_TIMEOUT_MS);
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
          credentials: "include",
          signal: controller.signal,
        }).catch(() => {});
      } finally {
        clearTimeout(timer);
      }
    }
  } finally {
    clearSession();
  }
}

export function logoutAndRedirect(): void {
  logout().finally(() => {
    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
  });
}
