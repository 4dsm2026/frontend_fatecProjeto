import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getCurrentUser } from "../utils/current-user";
import { resetEntryCache } from "../utils/entry";
import { storeSession } from "../utils/session";
import { stubApi, json, entryWith, FULL_ENTRY } from "./helpers-api";

beforeEach(() => {
  localStorage.clear();
  resetEntryCache();
  storeSession({ accessToken: "tok" });
});
afterEach(() => vi.unstubAllGlobals());

describe("getCurrentUser — segue o link `current-user` do GET /api", () => {
  it("descobre a URL pelo link (não a conhece) e devolve o usuário", async () => {
    const api = stubApi({
      "GET /api": () => json(FULL_ENTRY),
      "GET /users/me": () => json({ id: "u-1", nome: "João" }),
    });

    await expect(getCurrentUser()).resolves.toEqual({ id: "u-1", nome: "João" });

    expect(api.keys()).toEqual(["GET /api", "GET /users/me"]);
  });

  it("se a API mudar o href do link, o front acompanha sem alteração", async () => {
    const api = stubApi({
      "GET /api": () => json(entryWith({ "current-user": { href: "/v2/people/me", method: "GET" } })),
      "GET /v2/people/me": () => json({ id: "u-9" }),
    });

    await expect(getCurrentUser()).resolves.toEqual({ id: "u-9" });
    expect(api.keys()).toContain("GET /v2/people/me");
  });

  it("chamadas seguidas fazem UM GET /api (cache) e dois GET do usuário", async () => {
    const api = stubApi({
      "GET /api": () => json(FULL_ENTRY),
      "GET /users/me": () => json({ id: "u-1" }),
    });

    await getCurrentUser();
    await getCurrentUser();

    expect(api.keys().filter((k) => k === "GET /api")).toHaveLength(1);
    expect(api.keys().filter((k) => k === "GET /users/me")).toHaveLength(2);
  });

  it("API sem o link `current-user`: erro claro, sem chutar a URL", async () => {
    const api = stubApi({ "GET /api": () => json(entryWith({ self: { href: "/api" } })) });

    await expect(getCurrentUser()).rejects.toThrow('Link "current-user" não está disponível');
    expect(api.keys()).toEqual(["GET /api"]);
  });

  it("recusa de href fora da API (//outro-site) é barrada pelo followLink", async () => {
    stubApi({ "GET /api": () => json(entryWith({ "current-user": { href: "//evil.com/x", method: "GET" } })) });

    await expect(getCurrentUser()).rejects.toThrow("não é um caminho da API");
  });

  it("erro da API vira Error com a mensagem do backend (e não dados em branco)", async () => {
    stubApi({
      "GET /api": () => json(FULL_ENTRY),
      "GET /users/me": () => json({ type: "/errors/not-found", title: "Usuário não encontrado", status: 404 }, 404),
    });

    await expect(getCurrentUser()).rejects.toThrow("Usuário não encontrado");
  });
});
