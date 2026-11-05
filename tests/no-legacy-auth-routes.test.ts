import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * O módulo /auth do backend foi REMOVIDO: toda rota virou um recurso. Ninguém no
 * front pode voltar a chamar qualquer /auth/... (a API responderia 404).
 */
const SUBSTITUIDAS: Record<string, string> = {
  "/auth/login": "POST /sessions",
  "/auth/refresh": "POST /tokens",
  "/auth/logout": "DELETE /sessions/current",
  "/auth/me": "GET /users/me",
  "/auth/trocar-senha": "PUT /users/me/password",
  "/auth/esqueci-senha": "POST /password-resets",
  "/auth/reset-senha": "PUT /password-resets/:token",
  "/auth/primeiro-acesso": "PUT /account-activations/:token",
  "/auth/register": "removida (cadastro só pelo admin: POST /users)",
  "/auth/usuarios": "removida (GET /users, só equipe)",
};

const ROOT = join(__dirname, "..");
const PASTAS = ["app", "utils"];
const EXT = /\.(ts|tsx)$/;
// "/auth/algo" que não faça parte de outra palavra (ex.: "/oauth/...").
const QUALQUER_ROTA_AUTH = /(?<![\w.-])\/auth\/[a-z]/;

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    if (nome === "node_modules" || nome === ".next") return [];
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return EXT.test(nome) ? [caminho] : [];
  });
}

const FONTES = PASTAS.flatMap((p) => arquivos(join(ROOT, p)));

describe("convenção: as rotas /auth foram removidas e não voltam", () => {
  it.each(Object.entries(SUBSTITUIDAS))("nenhum arquivo de app/ ou utils/ usa %s (agora: %s)", (rota) => {
    const infratores = FONTES.filter((f) => readFileSync(f, "utf-8").includes(rota)).map((f) => relative(ROOT, f));

    expect(infratores).toEqual([]);
  });

  it("nenhum arquivo chama QUALQUER rota sob /auth (inclusive as que nem estão na lista)", () => {
    const infratores = FONTES.filter((f) => QUALQUER_ROTA_AUTH.test(readFileSync(f, "utf-8"))).map((f) => relative(ROOT, f));

    expect(infratores).toEqual([]);
  });

  it("varre arquivos de verdade (a trava não passa por estar olhando uma pasta vazia)", () => {
    expect(FONTES.length).toBeGreaterThan(50);
  });
});
