import { describe, expect, it } from "vitest";
import { parseAlunoCsv, parseCsv } from "../app/(dashboard)/admin/_components/ImportAlunos";

describe("parseCsv", () => {
  it("preserves commas and escaped quotes inside quoted fields", () => {
    expect(parseCsv('ra,nome\n1,"Silva, Ana"\n2,"Diz \"\"oi\"\""')).toEqual([
      ["ra", "nome"],
      ["1", "Silva, Ana"],
      ["2", 'Diz "oi"'],
    ]);
  });
});

describe("parseAlunoCsv", () => {
  it("maps headers case-insensitively and marks duplicate RAs ignoring case", () => {
    const result = parseAlunoCsv(
      "RA,EmailEducacional,Nome\n123,ana@fatec.test,Ana\n123,bruna@fatec.test,Bruna\n",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toEqual([
      expect.objectContaining({ idx: 1, ra: "123", nome: "Ana", status: "PENDING" }),
      expect.objectContaining({ idx: 2, ra: "123", nome: "Bruna", status: "ERROR", errorMsg: "RA duplicado no arquivo" }),
    ]);
  });

  it("distinguishes empty input from missing required columns", () => {
    expect(parseAlunoCsv("ra,emailEducacional\n")).toEqual({ ok: false, reason: "empty" });
    expect(parseAlunoCsv("ra,nome\n123,Ana")).toEqual({ ok: false, reason: "missing-columns" });
  });
});