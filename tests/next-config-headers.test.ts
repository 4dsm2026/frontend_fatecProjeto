import { describe, it, expect } from "vitest";
import nextConfig from "../next.config.mjs";

type Regra = { source: string; headers: { key: string; value: string }[] };

/** Cabeçalho efetivo de um caminho: no Next, quando duas regras definem a mesma chave, a ÚLTIMA vence. */
function cabecalhoEfetivo(regras: Regra[], caminho: string, chave: string): string | undefined {
  let valor: string | undefined;
  for (const r of regras) {
    const casa = r.source === "/(.*)" || r.source === caminho;
    if (!casa) continue;
    for (const h of r.headers) if (h.key === chave) valor = h.value;
  }
  return valor;
}

describe("next.config — Referrer-Policy (S11: token na URL não vaza pelo Referer)", async () => {
  const regras = (await nextConfig.headers!()) as Regra[];

  it.each(["/reset-senha", "/primeiro-acesso"])("%s usa no-referrer", (caminho) => {
    expect(cabecalhoEfetivo(regras, caminho, "Referrer-Policy")).toBe("no-referrer");
  });

  it.each(["/login", "/aluno/home", "/"])("%s continua com a política global", (caminho) => {
    expect(cabecalhoEfetivo(regras, caminho, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("as telas do token mantêm os demais cabeçalhos de segurança", () => {
    for (const caminho of ["/reset-senha", "/primeiro-acesso"]) {
      expect(cabecalhoEfetivo(regras, caminho, "X-Frame-Options")).toBe("DENY");
      expect(cabecalhoEfetivo(regras, caminho, "X-Content-Type-Options")).toBe("nosniff");
    }
  });
});
