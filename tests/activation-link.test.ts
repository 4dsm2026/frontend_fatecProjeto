import { describe, expect, it } from "vitest";
import {
  activationTokenFromProblem,
  EMAIL_IN_USE_TYPE,
  isEmailInUse,
  isPasswordChangeRequired,
  PASSWORD_CHANGE_REQUIRED_TYPE,
} from "../utils/activation-link";

describe("activationTokenFromProblem", () => {
  it("extrai token de link activate válido", () => {
    expect(
      activationTokenFromProblem({
        _links: { activate: { href: "/account-activations/abc123", method: "PUT" } },
      }),
    ).toBe("abc123");
  });

  it("decodifica caracteres percent-encoded permitidos", () => {
    expect(
      activationTokenFromProblem({
        _links: { activate: { href: "/account-activations/a%2Db", method: "PUT" } },
      }),
    ).toBe("a-b");
  });

  it("rejeita barra codificada no token", () => {
    expect(
      activationTokenFromProblem({
        _links: { activate: { href: "/account-activations/a%2Fb", method: "PUT" } },
      }),
    ).toBeNull();
  });

  it("retorna null para percent-encoding malformado sem lançar", () => {
    expect(() =>
      activationTokenFromProblem({
        _links: { activate: { href: "/account-activations/%E0%A4%A", method: "PUT" } },
      }),
    ).not.toThrow();
    expect(
      activationTokenFromProblem({
        _links: { activate: { href: "/account-activations/%E0%A4%A", method: "PUT" } },
      }),
    ).toBeNull();
  });

  it("rejeita prefixo diferente", () => {
    expect(
      activationTokenFromProblem({
        _links: { activate: { href: "/other/abc", method: "PUT" } },
      }),
    ).toBeNull();
  });

  it("rejeita href com prefixo antes de /account-activations/", () => {
    expect(
      activationTokenFromProblem({
        _links: { activate: { href: "/evil/account-activations/abc", method: "PUT" } },
      }),
    ).toBeNull();
  });

  it("rejeita segmento adicional", () => {
    expect(
      activationTokenFromProblem({
        _links: { activate: { href: "/account-activations/a/b", method: "PUT" } },
      }),
    ).toBeNull();
  });

  it("rejeita query string", () => {
    expect(
      activationTokenFromProblem({
        _links: { activate: { href: "/account-activations/abc?x=1", method: "PUT" } },
      }),
    ).toBeNull();
  });

  it("rejeita token ausente", () => {
    expect(
      activationTokenFromProblem({
        _links: { activate: { href: "/account-activations/", method: "PUT" } },
      }),
    ).toBeNull();
  });

  it("retorna null sem _links", () => {
    expect(activationTokenFromProblem({})).toBeNull();
  });

  it("retorna null sem activate", () => {
    expect(activationTokenFromProblem({ _links: {} })).toBeNull();
  });

  it("retorna null quando href não é string", () => {
    expect(activationTokenFromProblem({ _links: { activate: { href: 42 } } })).toBeNull();
  });

  it("retorna null para null", () => {
    expect(activationTokenFromProblem(null)).toBeNull();
  });

  it("retorna null para undefined", () => {
    expect(activationTokenFromProblem(undefined)).toBeNull();
  });

  it("retorna null para texto", () => {
    expect(activationTokenFromProblem("texto")).toBeNull();
  });

  it("retorna null para número", () => {
    expect(activationTokenFromProblem(42)).toBeNull();
  });
});

describe("isPasswordChangeRequired", () => {
  it("reconhece o type de primeiro acesso obrigatório", () => {
    expect(isPasswordChangeRequired({ type: PASSWORD_CHANGE_REQUIRED_TYPE })).toBe(true);
  });

  it("rejeita outro type", () => {
    expect(isPasswordChangeRequired({ type: "/errors/account-locked" })).toBe(false);
  });

  it("rejeita objeto sem type", () => {
    expect(isPasswordChangeRequired({})).toBe(false);
  });

  it("rejeita null", () => {
    expect(isPasswordChangeRequired(null)).toBe(false);
  });

  it("rejeita texto", () => {
    expect(isPasswordChangeRequired("texto")).toBe(false);
  });
});

describe("isEmailInUse", () => {
  it("reconhece o type de e-mail já em uso", () => {
    expect(EMAIL_IN_USE_TYPE).toBe("/errors/email-already-in-use");
    expect(isEmailInUse({ type: EMAIL_IN_USE_TYPE, status: 409 })).toBe(true);
  });

  it("o 409 de token já utilizado NÃO é e-mail em uso", () => {
    expect(isEmailInUse({ type: "/errors/conflict", title: "Token já utilizado", status: 409 })).toBe(false);
  });

  it.each([[{}], [null], [undefined], ["texto"], [42]])("rejeita %p", (valor) => {
    expect(isEmailInUse(valor)).toBe(false);
  });
});
