import { apiFetch, extractApiError } from "./api";
import type { Usuario } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

/**
 * Único lugar do front que sabe onde está o usuário logado.
 * Hoje é GET /auth/me; na conversão HATEOAS passa a ser o link `user` do GET /api
 * (e a rota vira /users/me). Quem precisa do usuário chama getCurrentUser() e
 * não monta a URL.
 */
const CURRENT_USER_PATH = "/auth/me";

/** Carrega o usuário logado. Lança Error com mensagem legível se a API recusar. */
export async function getCurrentUser<T = Usuario>(): Promise<T> {
  const res = await apiFetch(`${API_BASE}${CURRENT_USER_PATH}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(await extractApiError(res, `Erro ao carregar o usuário (${res.status})`));
  }
  return (await res.json()) as T;
}
