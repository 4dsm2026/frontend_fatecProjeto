import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { storeSession } from "../utils/session";
import { stubApi, json } from "./helpers-api";

const replace = vi.fn();

// api.ts guarda estado de módulo (refreshPromise): cada teste carrega uma cópia nova.
async function loadApi() {
  vi.resetModules();
  return import("../utils/api");
}

beforeEach(() => {
  localStorage.clear();
  replace.mockReset();
  vi.stubGlobal("location", { protocol: "http:", replace });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch — renova o acesso em POST /tokens", () => {
  it("401 → POST /tokens com o refresh token → repete o pedido com o token NOVO", async () => {
    const { apiFetch } = await loadApi();
    storeSession({ accessToken: "velho", refreshToken: "ref-velho" });
    let tentativa = 0;
    const api = stubApi({
      "GET /coisa": () => (tentativa++ === 0 ? json({}, 401) : json({ ok: true })),
      "POST /tokens": () => json({ accessToken: "novo", refreshToken: "ref-novo" }, 201),
    });

    const res = await apiFetch("/coisa");

    expect(res.status).toBe(200);
    expect(api.keys()).toEqual(["GET /coisa", "POST /tokens", "GET /coisa"]);
    expect(api.calls[0].auth).toBe("Bearer velho");
    expect(api.calls[2].auth).toBe("Bearer novo");
    const refreshCall = api.fetchMock.mock.calls[1];
    expect(JSON.parse(String(refreshCall[1]?.body))).toEqual({ refreshToken: "ref-velho" });
  });

  it("aceita o 201 do POST /tokens e guarda o par rotacionado em localStorage e cookie", async () => {
    const { apiFetch } = await loadApi();
    storeSession({ accessToken: "velho", refreshToken: "ref-velho" });
    let tentativa = 0;
    stubApi({
      "GET /coisa": () => (tentativa++ === 0 ? json({}, 401) : json({})),
      "POST /tokens": () => json({ accessToken: "novo", refreshToken: "ref-novo" }, 201),
    });

    await apiFetch("/coisa");

    expect(localStorage.getItem("accessToken")).toBe("novo");
    expect(localStorage.getItem("refreshToken")).toBe("ref-novo");
    expect(document.cookie).toContain("accessToken=novo");
    expect(document.cookie).toContain("refreshToken=ref-novo");
  });

  it("dois 401 simultâneos compartilham UM só POST /tokens", async () => {
    const { apiFetch } = await loadApi();
    storeSession({ accessToken: "velho", refreshToken: "ref-velho" });
    const api = stubApi({
      "GET /a": (init) =>
        new Headers(init.headers).get("Authorization") === "Bearer velho" ? json({}, 401) : json({}),
      "GET /b": (init) =>
        new Headers(init.headers).get("Authorization") === "Bearer velho" ? json({}, 401) : json({}),
      "POST /tokens": () => json({ accessToken: "novo", refreshToken: "ref-novo" }, 201),
    });

    await Promise.all([apiFetch("/a"), apiFetch("/b")]);

    expect(api.keys().filter((k) => k === "POST /tokens")).toHaveLength(1);
  });

  it("POST /tokens recusado (401): encerra a sessão local, vai para /login e não repete o pedido", async () => {
    const { apiFetch } = await loadApi();
    storeSession({ accessToken: "velho", refreshToken: "ref-velho" });
    const api = stubApi({
      "GET /coisa": () => json({}, 401),
      "POST /tokens": () =>
        json({ type: "/errors/unauthorized", title: "Refresh token inválido", status: 401 }, 401),
    });

    await expect(apiFetch("/coisa")).rejects.toThrow("Sessão expirada");

    expect(api.keys()).toEqual(["GET /coisa", "POST /tokens"]);
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("sem refresh token guardado: nem chama POST /tokens", async () => {
    const { apiFetch } = await loadApi();
    localStorage.setItem("accessToken", "velho");
    const api = stubApi({ "GET /coisa": () => json({}, 401) });

    await expect(apiFetch("/coisa")).rejects.toThrow("Sessão expirada");

    expect(api.keys()).toEqual(["GET /coisa"]);
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("renovou mas o pedido repetido ainda dá 401: encerra a sessão", async () => {
    const { apiFetch } = await loadApi();
    storeSession({ accessToken: "velho", refreshToken: "ref-velho" });
    stubApi({
      "GET /coisa": () => json({}, 401),
      "POST /tokens": () => json({ accessToken: "novo", refreshToken: "ref-novo" }, 201),
    });

    await expect(apiFetch("/coisa")).rejects.toThrow("Não autorizado");

    expect(replace).toHaveBeenCalledWith("/login");
  });
});
