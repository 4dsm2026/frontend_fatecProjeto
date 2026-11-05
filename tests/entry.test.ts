import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getEntry, fetchEntry, resetEntryCache } from "../utils/entry";
import { storeSession } from "../utils/session";
import { stubApi, json, FULL_ENTRY } from "./helpers-api";

beforeEach(() => {
  localStorage.clear();
  resetEntryCache();
  storeSession({ accessToken: "tok-A" });
});
afterEach(() => vi.unstubAllGlobals());

describe("getEntry", () => {
  it("devolve os links de GET /api", async () => {
    stubApi({ "GET /api": () => json(FULL_ENTRY) });
    await expect(getEntry()).resolves.toEqual(FULL_ENTRY);
  });

  it("reaproveita a resposta para o mesmo token e junta chamadas simultâneas", async () => {
    const api = stubApi({ "GET /api": () => json(FULL_ENTRY) });

    await Promise.all([getEntry(), getEntry()]);
    await getEntry();

    expect(api.fetchMock).toHaveBeenCalledTimes(1);
  });

  it("outro token (outro usuário ou token renovado) NÃO reaproveita o cache", async () => {
    const api = stubApi({ "GET /api": () => json(FULL_ENTRY) });

    await getEntry();
    storeSession({ accessToken: "tok-B" });
    await getEntry();

    expect(api.fetchMock).toHaveBeenCalledTimes(2);
    expect(api.calls[1].auth).toBe("Bearer tok-B");
  });

  it("falha não fica em cache: a próxima chamada tenta de novo", async () => {
    let n = 0;
    const api = stubApi({ "GET /api": () => (++n === 1 ? json({ title: "x", status: 500 }, 500) : json(FULL_ENTRY)) });

    await expect(getEntry()).rejects.toThrow();
    await expect(getEntry()).resolves.toEqual(FULL_ENTRY);

    expect(api.fetchMock).toHaveBeenCalledTimes(2);
  });

  it("erro vira mensagem legível (problem+json)", async () => {
    stubApi({ "GET /api": () => json({ type: "/errors/internal", title: "Erro interno", status: 500, detail: "Tente depois" }, 500) });
    await expect(getEntry()).rejects.toThrow("Tente depois");
  });
});

describe("fetchEntry", () => {
  it("nunca usa cache", async () => {
    const api = stubApi({ "GET /api": () => json(FULL_ENTRY) });
    await fetchEntry();
    await fetchEntry();
    expect(api.fetchMock).toHaveBeenCalledTimes(2);
  });
});
