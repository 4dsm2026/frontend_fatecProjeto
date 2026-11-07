import { apiFetch, extractApiError, API_BASE } from "./api";
import { getAccessToken } from "./session";
import type { HalResource } from "./hal";

/** Busca o GET /api (links de entrada do usuário logado), sem cache. */
export async function fetchEntry(init: RequestInit = {}): Promise<HalResource> {
  const res = await apiFetch(`${API_BASE}/api`, { ...init, cache: "no-store" });
  if (!res.ok) {
    throw new Error(await extractApiError(res, `Erro ao carregar a API (${res.status})`));
  }
  return (await res.json()) as HalResource;
}

let cached: { token: string | null; promise: Promise<HalResource> } | null = null;

/**
 * Links de entrada, com cache por access token: chamadas seguidas reaproveitam a
 * mesma resposta (e requisições simultâneas viram uma só). Outro token (outro
 * usuário, ou token renovado) invalida o cache. Falha nunca fica em cache.
 */
export function getEntry(): Promise<HalResource> {
  const token = getAccessToken();
  if (cached && cached.token === token) return cached.promise;

  const entry = { token, promise: fetchEntry() };
  cached = entry;
  entry.promise.catch(() => {
    if (cached === entry) cached = null;
  });
  return entry.promise;
}

/** Só para testes. */
export function resetEntryCache(): void {
  cached = null;
}
