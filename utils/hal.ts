import { API_BASE, apiFetch } from "./api";

export type HalMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HalLink {
  href: string;
  method?: HalMethod;
  title?: string;
  /** Distingue vários links do mesmo `rel` (ex.: o status de destino de uma transição). */
  name?: string;
}

export type HalLinks = Record<string, HalLink | HalLink[]>;

export interface HalResource {
  _links?: HalLinks;
}

export interface HalPage {
  size: number;
  number: number;
  totalElements: number;
  totalPages: number;
}

export interface HalCollection<T = unknown> extends HalResource {
  _embedded?: Record<string, T[]>;
  page?: HalPage;
}

export class HalLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HalLinkError";
  }
}

type MaybeResource = HalResource | null | undefined;

/** Todos os links de um `rel`, sempre como lista (o `rel` pode ter um link ou vários). */
export function getLinks(resource: MaybeResource, rel: string): HalLink[] {
  const entry = resource?._links?.[rel];
  if (!entry) return [];
  return Array.isArray(entry) ? entry : [entry];
}

/** O link do `rel`; com `name`, o link daquele `name`. */
export function getLink(resource: MaybeResource, rel: string, name?: string): HalLink | undefined {
  const links = getLinks(resource, rel);
  return name === undefined ? links[0] : links.find((l) => l.name === name);
}

/** "Tem o link? Mostra o botão." */
export function hasLink(resource: MaybeResource, rel: string, name?: string): boolean {
  return getLink(resource, rel, name) !== undefined;
}

/** Os itens de `_embedded[rel]` de uma coleção (lista vazia se não houver). */
export function embedded<T>(collection: HalCollection<T> | null | undefined, rel: string): T[] {
  return collection?._embedded?.[rel] ?? [];
}

export interface FollowOptions extends RequestInit {
  /** Escolhe, entre os links do `rel`, o que tem este `name`. */
  name?: string;
}

/** Só caminhos da própria API: começam com "/" e não com "//" (que seria outro servidor). */
function isSafeHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

/**
 * Segue um link do recurso usando o `href` e o `method` dele, pelo `apiFetch`
 * (token, renovação de sessão e cookies). O método do link vale sobre `init.method`.
 */
export async function followLink(resource: MaybeResource, rel: string, options: FollowOptions = {}): Promise<Response> {
  const { name, ...init } = options;
  const target = getLink(resource, rel, name);
  if (!target) {
    throw new HalLinkError(`Link "${rel}"${name ? ` (${name})` : ""} não está disponível neste recurso`);
  }
  if (!isSafeHref(target.href)) {
    throw new HalLinkError(`Link "${rel}" recusado: o href não é um caminho da API`);
  }
  return apiFetch(`${API_BASE}${target.href}`, { ...init, method: target.method ?? "GET" });
}