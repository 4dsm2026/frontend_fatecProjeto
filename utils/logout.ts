import { fetchEntry } from "./entry";
import { followLink } from "./hal";
import { clearSession, getAccessToken, getRefreshToken } from "./session";

/** Rede lenta não pode travar o botão "Sair": passado esse tempo, só limpa o estado local. */
const LOGOUT_TIMEOUT_MS = 5000;

/**
 * Sair de verdade: revoga a sessão no servidor (segue o link `session`, um DELETE,
 * do GET /api) e limpa o estado local. Usa o apiFetch, então, se o access token
 * estiver vencido, ele é renovado antes de revogar. Nunca lança: o estado local
 * é sempre limpo, mesmo com a API fora do ar.
 */
export async function logout(): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOGOUT_TIMEOUT_MS);
  try {
    if (getAccessToken() || getRefreshToken()) {
      // Sem cache e com sinal próprio: abortar aqui não pode derrubar outras telas.
      const entry = await fetchEntry({ signal: controller.signal });
      await followLink(entry, "session", { signal: controller.signal });
    }
  } catch {
    // Best-effort. Se a renovação falhou, o apiFetch já limpou e redirecionou
    // (a sessão estava morta); se a rede caiu, não há o que fazer além de limpar.
  } finally {
    clearTimeout(timer);
    clearSession();
  }
}
