import { describe, it, expect } from "vitest";
import { rotuloProtocolo } from "../utils/protocolo";

describe("rotuloProtocolo (#233)", () => {
  it("mostra o protocolo quando existe", () => {
    expect(rotuloProtocolo("TCK-ABC123")).toBe("TCK-ABC123");
  });
  it.each([null, undefined, "", "  "])("sem protocolo (%j) nunca mostra o id interno", (p) => {
    expect(rotuloProtocolo(p)).toBe("Sem protocolo");
  });
});
