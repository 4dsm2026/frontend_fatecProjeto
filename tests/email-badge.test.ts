import { describe, it, expect } from "vitest";
import { isEmailAddress } from "../utils/email";
import { textoBadgeNaoLidas } from "../utils/notificacoes";

describe("isEmailAddress (#258)", () => {
  it.each(["a@b.c", "nome.sobrenome@fatec.sp.gov.br"])("aceita %s", (e) => expect(isEmailAddress(e)).toBe(true));
  it.each(["", "ana.costa", "a@b", "a@b.", "a b@c.d", "a@@b.c", "@b.c"])("recusa %j", (e) => expect(isEmailAddress(e)).toBe(false));
  it("responde rápido a entradas longas que travam regex com backtracking", () => {
    const longa = "a@" + "a.".repeat(50_000) + "@";
    const t0 = performance.now();
    expect(isEmailAddress(longa)).toBe(false);
    expect(performance.now() - t0).toBeLessThan(100);
  });
});

describe("textoBadgeNaoLidas (#267)", () => {
  it.each([[null, ""], [0, ""], [-1, ""], [5, "5"], [99, "99"], [100, "99+"]] as const)("%j → %j", (n, esperado) =>
    expect(textoBadgeNaoLidas(n)).toBe(esperado));
});
