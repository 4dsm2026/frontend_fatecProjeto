import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logout } from "../utils/logout";
import { storeSession } from "../utils/session";
import { stubApi, json, entryWith, FULL_ENTRY } from "./helpers-api";

const noContent = () => new Response(null, { status: 204 });
const replace = vi.fn();

beforeEach(() => {
  localStorage.clear();
  replace.mockReset();
  vi.stubGlobal("location", { protocol: "http:", replace });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("logout — revoga a sessão seguindo o link `session`", () => {
  it("descobre o link no GET /api, faz o DELETE com Bearer e limpa o estado local", async () => {
    storeSession({ accessToken: "acc", refreshToken: "ref" });
    const api = stubApi({
      "GET /api": () => json(FULL_ENTRY),
      "DELETE /sessions/current": noContent,
    });

    await logout();

    expect(api.keys()).toEqual(["GET /api", "DELETE /sessions/current"]);
    expect(api.calls[1].auth).toBe("Bearer acc");
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
  });

  it("access token vencido: renova primeiro e só então revoga, com o token NOVO", async () => {
    storeSession({ accessToken: "velho", refreshToken: "ref" });
    const api = stubApi({
      "GET /api": (init) =>
        new Headers(init.headers).get("Authorization") === "Bearer velho" ? json({}, 401) : json(FULL_ENTRY),
      "POST /tokens": () => json({ accessToken: "novo", refreshToken: "ref2" }),
      "DELETE /sessions/current": noContent,
    });

    await logout();

    expect(api.keys()).toEqual(["GET /api", "POST /tokens", "GET /api", "DELETE /sessions/current"]);
    expect(api.calls[3].auth).toBe("Bearer novo");
    expect(localStorage.getItem("accessToken")).toBeNull();
  });

  it("renovação falhou (sessão já morta): não entra em laço, redireciona uma vez e limpa tudo", async () => {
    storeSession({ accessToken: "velho", refreshToken: "ref" });
    const api = stubApi({
      "GET /api": () => json({}, 401),
      "POST /tokens": () => json({}, 401),
    });

    await expect(logout()).resolves.toBeUndefined();

    expect(api.fetchMock).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/login");
    expect(localStorage.getItem("refreshToken")).toBeNull();
  });

  it("a API não oferece o link `session`: não chama DELETE, mas limpa o estado", async () => {
    storeSession({ accessToken: "acc", refreshToken: "ref" });
    const api = stubApi({ "GET /api": () => json(entryWith({ self: { href: "/api" } })) });

    await logout();

    expect(api.keys()).toEqual(["GET /api"]);
    expect(localStorage.getItem("accessToken")).toBeNull();
  });

  it("GET /api com erro 500: não lança e limpa o estado local", async () => {
    storeSession({ accessToken: "acc", refreshToken: "ref" });
    stubApi({ "GET /api": () => json({ title: "Erro", status: 500 }, 500) });

    await expect(logout()).resolves.toBeUndefined();

    expect(localStorage.getItem("accessToken")).toBeNull();
  });

  it("rede caiu: não lança e limpa o estado local", async () => {
    storeSession({ accessToken: "acc", refreshToken: "ref" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede")));

    await expect(logout()).resolves.toBeUndefined();

    expect(localStorage.getItem("refreshToken")).toBeNull();
  });

  it("sem nenhum token: não chama a API, mas limpa o resto", async () => {
    localStorage.setItem("userId", "u-1");
    const api = stubApi({});

    await logout();

    expect(api.fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem("userId")).toBeNull();
  });

  it("rede pendurada: desiste depois de 5 s e limpa o estado local (o 'Sair' não trava)", async () => {
    vi.useFakeTimers();
    storeSession({ accessToken: "acc", refreshToken: "ref" });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new Error("abortado")));
          }),
      ),
    );

    const pending = logout();
    await vi.advanceTimersByTimeAsync(5000);
    await pending;

    expect(localStorage.getItem("refreshToken")).toBeNull();
  });
});
