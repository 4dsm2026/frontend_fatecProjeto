import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Cookies from "js-cookie";
import { storeSession, getAccessToken, getRefreshToken, clearSession } from "../utils/session";

beforeEach(() => {
  localStorage.clear();
  Cookies.remove("accessToken", { path: "/" });
  Cookies.remove("refreshToken", { path: "/" });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("storeSession", () => {
  it("grava access e refresh no localStorage e nos cookies", () => {
    storeSession({ accessToken: "acc.jwt", refreshToken: "ref-token" });

    expect(localStorage.getItem("accessToken")).toBe("acc.jwt");
    expect(localStorage.getItem("refreshToken")).toBe("ref-token");
    expect(Cookies.get("accessToken")).toBe("acc.jwt");
    expect(Cookies.get("refreshToken")).toBe("ref-token");
  });

  it("sem refreshToken: não toca no refresh existente", () => {
    localStorage.setItem("refreshToken", "antigo");

    storeSession({ accessToken: "acc.jwt" });

    expect(localStorage.getItem("accessToken")).toBe("acc.jwt");
    expect(localStorage.getItem("refreshToken")).toBe("antigo");
  });

  it("cookies com a vida dos tokens: access 15 min e refresh 7 dias, path /, SameSite lax", () => {
    const set = vi.spyOn(Cookies, "set");

    storeSession({ accessToken: "a", refreshToken: "r" });

    expect(set).toHaveBeenCalledWith("accessToken", "a", expect.objectContaining({
      expires: 15 / (24 * 60), path: "/", sameSite: "lax",
    }));
    expect(set).toHaveBeenCalledWith("refreshToken", "r", expect.objectContaining({
      expires: 7, path: "/", sameSite: "lax",
    }));
  });

  it("Secure acompanha o protocolo REAL da página, não o NODE_ENV", () => {
    const set = vi.spyOn(Cookies, "set");

    storeSession({ accessToken: "a" });
    expect(set).toHaveBeenLastCalledWith("accessToken", "a", expect.objectContaining({ secure: false }));

    vi.stubGlobal("location", { protocol: "https:" });
    storeSession({ accessToken: "a" });
    expect(set).toHaveBeenLastCalledWith("accessToken", "a", expect.objectContaining({ secure: true }));
  });
});

describe("getAccessToken / getRefreshToken", () => {
  it("devolve o que está no localStorage", () => {
    localStorage.setItem("accessToken", "a");
    localStorage.setItem("refreshToken", "r");
    expect(getAccessToken()).toBe("a");
    expect(getRefreshToken()).toBe("r");
  });

  it("devolve null quando não há token", () => {
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("devolve null (sem lançar) se o storage estiver indisponível", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(getAccessToken()).toBeNull();
  });
});

describe("clearSession", () => {
  it("apaga tokens, userId e cookies", () => {
    storeSession({ accessToken: "a", refreshToken: "r" });
    localStorage.setItem("userId", "u-1");

    clearSession();

    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(localStorage.getItem("userId")).toBeNull();
    expect(Cookies.get("accessToken")).toBeUndefined();
    expect(Cookies.get("refreshToken")).toBeUndefined();
  });

  it("nunca lança, mesmo se o storage falhar", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => clearSession()).not.toThrow();
  });
});
