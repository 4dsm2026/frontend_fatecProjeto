import { vi } from "vitest";

export type Handler = (init: RequestInit) => Response | Promise<Response>;

/** Simula a API pelo fetch global: roteia por "MÉTODO /caminho" e guarda as chamadas. */
export function stubApi(routes: Record<string, Handler>) {
  const calls: { key: string; auth: string | null }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const key = `${(init.method ?? "GET").toUpperCase()} ${new URL(String(input), "http://x").pathname}`;
    calls.push({ key, auth: new Headers(init.headers).get("Authorization") });
    const handler = routes[key];
    if (!handler) throw new Error(`rota não simulada: ${key}`);
    return handler(init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls, keys: () => calls.map((c) => c.key) };
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const entryWith = (links: Record<string, { href: string; method?: string }>) => ({ _links: links });

export const FULL_ENTRY = entryWith({
  self: { href: "/api", method: "GET" },
  "current-user": { href: "/users/me", method: "GET" },
  session: { href: "/sessions/current", method: "DELETE" },
});
