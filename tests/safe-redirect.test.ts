import { describe, it, expect } from "vitest";
import { safeRedirect } from "../utils/safe-redirect";

const ORIGIN = "https://app.exemplo.com";
const FALLBACK = "/aluno";
const go = (r: string | null | undefined) => safeRedirect(r, FALLBACK, ORIGIN);

describe("safeRedirect — aceita só caminhos do mesmo site", () => {
  it.each([
    ["/admin/chamados", "/admin/chamados"],
    ["/aluno/chamados/42?aba=mensagens", "/aluno/chamados/42?aba=mensagens"],
    ["/aluno#topo", "/aluno#topo"],
    ["/", "/"],
  ])("aceita %s", (entrada, esperado) => {
    expect(go(entrada)).toBe(esperado);
  });

  it("URL absoluta do MESMO site vira caminho relativo", () => {
    expect(go("https://app.exemplo.com/admin?x=1")).toBe("/admin?x=1");
  });

  it("sem destino: usa o fallback", () => {
    expect(go(null)).toBe(FALLBACK);
    expect(go(undefined)).toBe(FALLBACK);
    expect(go("")).toBe(FALLBACK);
  });
});

describe("safeRedirect — bloqueia redirecionamento para outro site", () => {
  it.each([
    ["URL protocolo-relativa", "//evil.com"],
    ["barra invertida (o navegador troca por /)", "/\\evil.com"],
    ["tab escondido (o navegador remove)", "/\t/evil.com"],
    ["enter escondido (o navegador remove)", "/\n/evil.com"],
    ["URL absoluta de outro site", "https://evil.com/login"],
    ["http de outro site", "http://app.exemplo.com.evil.com"],
    ["esquema javascript:", "javascript:alert(1)"],
    ["esquema data:", "data:text/html,<script>alert(1)</script>"],
    ["relativo sem barra inicial que vira outro host", "evil.com@evil.com"],
  ])("%s -> fallback", (_nome, entrada) => {
    const r = go(entrada);
    // Ou cai no fallback, ou fica DENTRO do site (caminho local). Nunca sai.
    const destino = new URL(r, ORIGIN);
    expect(destino.origin).toBe(ORIGIN);
  });

  it.each(["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "https://evil.com/login", "javascript:alert(1)"])(
    "%j cai exatamente no fallback",
    (entrada) => {
      expect(go(entrada)).toBe(FALLBACK);
    },
  );

  it("formas codificadas (%5C, %2F) não são decodificadas e ficam no site", () => {
    expect(new URL(go("/%5Cevil.com"), ORIGIN).origin).toBe(ORIGIN);
    expect(new URL(go("/%2F/evil.com"), ORIGIN).origin).toBe(ORIGIN);
  });
});
