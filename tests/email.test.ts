import { describe, it, expect } from "vitest";
import { isEmailValido } from "../utils/email";

// Regra anterior (login e primeiro acesso). Mantida aqui só para provar equivalência.
// eslint-disable-next-line sonarjs/super-linear-regex -- é a regex antiga, mantida só para comparar com o helper novo
const REGEX_ANTIGA = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

describe("isEmailValido", () => {
  it.each([
    "joao@fatec.sp.gov.br",
    "a@b.c",
    "nome.sobrenome+tag@dominio.com",
    "a@b..c", // a regra antiga aceitava; mantemos
  ])("aceita %s", (email) => {
    expect(isEmailValido(email)).toBe(true);
  });

  it.each([
    "",
    "semarroba",
    "@dominio.com",
    "joao@",
    "joao@dominio",
    "joao@.com",
    "joao@dominio.",
    "joao@@dominio.com",
    "jo ao@dominio.com",
    "joao@dominio .com",
    " joao@dominio.com",
    "joao@dominio.com ",
    "a@b@c.com",
  ])("recusa %j", (email) => {
    expect(isEmailValido(email)).toBe(false);
  });

  it("dá o mesmo resultado que a regex antiga em milhares de combinações", () => {
    const pedacos = ["", "a", "ab", ".", "..", "@", " ", "\t", "a.b", "x@y"];
    let comparados = 0;
    for (const p1 of pedacos) {
      for (const p2 of pedacos) {
        for (const p3 of pedacos) {
          for (const p4 of pedacos) {
            const entrada = `${p1}@${p2}${p3}${p4}`;
            expect(isEmailValido(entrada), JSON.stringify(entrada)).toBe(REGEX_ANTIGA.test(entrada));
            const semArroba = `${p1}${p2}${p3}${p4}`;
            expect(isEmailValido(semArroba), JSON.stringify(semArroba)).toBe(REGEX_ANTIGA.test(semArroba));
            comparados += 2;
          }
        }
      }
    }
    expect(comparados).toBeGreaterThan(10_000);
  });

  it("não trava com entrada enorme e maliciosa (tempo linear)", () => {
    const inicio = Date.now();
    isEmailValido("a@" + ".".repeat(200_000) + " ");
    isEmailValido("a".repeat(200_000) + "@" + "a".repeat(200_000));
    expect(Date.now() - inicio).toBeLessThan(500);
  });
});
