import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Trava da migração de /auth: estas rotas legadas foram substituídas por recursos
 * (POST /sessions, POST /tokens, ...). Ninguém volta a chamá-las no front.
 * Ao migrar o próximo endpoint, acrescente a rota antiga em MIGRADAS.
 */
const MIGRADAS = ["/auth/login", "/auth/refresh"];

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

describe("convenção: rotas /auth já migradas não voltam", () => {
  it.each(MIGRADAS)("nenhum arquivo de app/ ou utils/ usa %s", (rota) => {
    const infratores = PASTAS.flatMap((p) => arquivos(join(ROOT, p)))
      .filter((f) => readFileSync(f, "utf-8").includes(rota))
      .map((f) => relative(ROOT, f));

    expect(infratores).toEqual([]);
  });
});
