import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logout } from "../utils/auth";
import { storeSession } from "../utils/session";

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("logout", () => {
  it("avisa o servidor com o refreshToken e depois limpa o estado local", async () => {
    storeSession({ accessToken: "acc", refreshToken: "ref-123" });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await logout();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/logout$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ refreshToken: "ref-123" });
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
  });

  it("limpa o estado local mesmo se o servidor estiver fora do ar", async () => {
    storeSession({ accessToken: "acc", refreshToken: "ref" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede")));

    await expect(logout()).resolves.toBeUndefined();

    expect(localStorage.getItem("refreshToken")).toBeNull();
  });

  it("sem refreshToken: não chama o servidor, mas limpa o resto", async () => {
    localStorage.setItem("accessToken", "acc");
    localStorage.setItem("userId", "u-1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await logout();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("userId")).toBeNull();
  });

  it("rede pendurada: desiste depois de 5 s e limpa o estado local (o 'Sair' não trava)", async () => {
    vi.useFakeTimers();
    storeSession({ accessToken: "acc", refreshToken: "ref" });
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) =>
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
