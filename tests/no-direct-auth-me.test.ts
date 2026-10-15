import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Trava da convenção: o usuário logado é carregado por getCurrentUser(), que
 * segue o link `current-user` do GET /api. Ninguém monta a URL do usuário à mão,
 * senão a próxima mudança de rota quebra todas as telas de novo.
 */
const ROOT = join(__dirname, "..");
const PASTAS = ["app", "utils"];
const EXT = /\.(ts|tsx)$/;

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    if (nome === "node_modules" || nome === ".next") return [];
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : EXT.test(nome) ? [caminho] : [];
  });
}

describe("convenção: usuário logado só via getCurrentUser()", () => {
  it("nenhum arquivo de app/ ou utils/ chama /auth/me diretamente", () => {
    const infratores = PASTAS.flatMap((p) => arquivos(join(ROOT, p)))
      .filter((f) => readFileSync(f, "utf-8").includes("/auth/me"))
      .map((f) => relative(ROOT, f));

    expect(infratores).toEqual([]);
  });
});
