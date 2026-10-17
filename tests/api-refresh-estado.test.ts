import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiFetch } from "../utils/api";
import { stubApi, json } from "./helpers-api";

/**
 * Regressão: `refreshPromise` (estado de módulo em utils/api.ts) não pode ficar
 * preso depois de uma tentativa que termina na hora (sem refresh token guardado).
 * Aqui o import é ESTÁTICO de propósito: os dois testes compartilham o módulo.
 */
const replace = vi.fn();

beforeEach(() => {
  localStorage.clear();
  replace.mockReset();
  vi.stubGlobal("location", { protocol: "http:", replace });
});
afterEach(() => vi.unstubAllGlobals());

describe("apiFetch — estado do refresh entre tentativas", () => {
  it("1) sem refresh token: não renova e encerra a sessão", async () => {
    localStorage.setItem("accessToken", "velho");
    const api = stubApi({ "GET /coisa": () => json({}, 401) });

    await expect(apiFetch("/coisa")).rejects.toThrow("Sessão expirada");

    expect(api.keys()).toEqual(["GET /coisa"]);
  });

  it("2) depois dela, um novo 401 COM refresh token ainda consegue renovar", async () => {
    localStorage.setItem("accessToken", "velho");
    localStorage.setItem("refreshToken", "ref-velho");
    let tentativa = 0;
    const api = stubApi({
      "GET /coisa": () => (tentativa++ === 0 ? json({}, 401) : json({ ok: true })),
      "POST /tokens": () => json({ accessToken: "novo", refreshToken: "ref-novo" }, 201),
    });

    const res = await apiFetch("/coisa");

    expect(res.status).toBe(200);
    expect(api.keys()).toEqual(["GET /coisa", "POST /tokens", "GET /coisa"]);
  });
});
