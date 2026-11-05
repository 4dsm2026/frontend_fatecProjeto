import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logoutAndRedirect } from "../utils/auth";
import { storeSession } from "../utils/session";

const replace = vi.fn();
beforeEach(() => {
  localStorage.clear();
  replace.mockReset();
  vi.stubGlobal("location", { protocol: "http:", replace });
});
afterEach(() => vi.unstubAllGlobals());

describe("logoutAndRedirect (só navegador, sem rede)", () => {
  it("limpa o estado local e vai para /login", () => {
    storeSession({ accessToken: "a", refreshToken: "r" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    logoutAndRedirect();

    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(replace).toHaveBeenCalledWith("/login");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
