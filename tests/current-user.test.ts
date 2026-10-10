import { describe, it, expect, vi, beforeEach } from "vitest";

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));

vi.mock("../utils/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/api")>()),
  apiFetch,
}));

import { getCurrentUser } from "../utils/current-user";

beforeEach(() => vi.clearAllMocks());

describe("getCurrentUser", () => {
  it("devolve o usuário e pede sem cache", async () => {
    apiFetch.mockResolvedValue(new Response(JSON.stringify({ id: "u-1", nome: "João" }), { status: 200 }));

    await expect(getCurrentUser()).resolves.toEqual({ id: "u-1", nome: "João" });

    expect(apiFetch).toHaveBeenCalledWith(expect.stringMatching(/\/auth\/me$/), { cache: "no-store" });
  });

  it("resposta de erro vira Error com a mensagem do backend (e não dados em branco)", async () => {
    apiFetch.mockResolvedValue(new Response(JSON.stringify({ error: "Usuário não encontrado" }), { status: 404 }));

    await expect(getCurrentUser()).rejects.toThrow("Usuário não encontrado");
  });

  it("erro sem corpo usa a mensagem padrão com o status", async () => {
    apiFetch.mockResolvedValue(new Response("", { status: 500 }));

    await expect(getCurrentUser()).rejects.toThrow("Erro ao carregar o usuário (500)");
  });
});
