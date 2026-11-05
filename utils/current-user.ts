import { extractApiError } from "./api";
import { getEntry } from "./entry";
import { followLink } from "./hal";
import type { Usuario } from "./types";

/**
 * Único lugar do front que carrega o usuário logado. Não conhece a URL: segue o
 * link `current-user` que a API entrega no GET /api (hoje /users/me).
 * Lança Error com mensagem legível se a API recusar.
 */
export async function getCurrentUser<T = Usuario>(): Promise<T> {
  const entry = await getEntry();
  const res = await followLink(entry, "current-user", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(await extractApiError(res, `Erro ao carregar o usuário (${res.status})`));
  }
  return (await res.json()) as T;
}
