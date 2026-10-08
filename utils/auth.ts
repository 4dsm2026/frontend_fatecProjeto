import { clearSession, getRefreshToken } from "./session";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/**
 * Revoga a sessão no backend e limpa o estado local.
 * Não lança exceção — o logout local sempre ocorre mesmo se a API falhar.
 */
export async function logout(): Promise<void> {
  try {
    const refreshToken = getRefreshToken();

    if (refreshToken) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        credentials: "include",
      }).catch(() => {});
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
