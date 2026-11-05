import { describe, it, expect } from "vitest";
import { extractApiError } from "../utils/api";

// Response mínima: extractApiError só usa .text() e .status.
function fakeRes(status: number, body: string): Response {
  return { status, text: async () => body } as unknown as Response;
}

describe("extractApiError", () => {
  it("prioriza issues (validação Zod)", async () => {
    const res = fakeRes(400, JSON.stringify({ issues: [{ path: "ra", message: "obrigatório" }] }));
    expect(await extractApiError(res)).toBe("ra: obrigatório");
  });

  it("usa o campo error do backend", async () => {
    const res = fakeRes(409, JSON.stringify({ error: "Duplicidade (email/RA)" }));
    expect(await extractApiError(res)).toBe("Duplicidade (email/RA)");
  });

  it("usa message quando não há error", async () => {
    const res = fakeRes(400, JSON.stringify({ message: "algo deu errado" }));
    expect(await extractApiError(res)).toBe("algo deu errado");
  });

  it("cai para o texto cru quando não é JSON", async () => {
    const res = fakeRes(500, "Internal Server Error");
    expect(await extractApiError(res)).toBe("Internal Server Error");
  });

  it("usa o fallback quando o corpo é vazio", async () => {
    const res = fakeRes(503, "");
    expect(await extractApiError(res, "Serviço indisponível")).toBe("Serviço indisponível");
  });
});

describe("extractApiError: application/problem+json (RFC 7807)", () => {
  it("lista os erros por campo", async () => {
    const res = fakeRes(
      400,
      JSON.stringify({
        type: "/errors/bad-request",
        title: "Dados inválidos",
        status: 400,
        instance: "/tickets",
        errors: [
          { field: "body.titulo", message: "obrigatório" },
          { field: "body.prioridade", message: "valor inválido" },
        ],
      }),
    );
    expect(await extractApiError(res)).toBe("body.titulo: obrigatório | body.prioridade: valor inválido");
  });

  it("erro por campo sem nome de campo mostra só a mensagem", async () => {
    const res = fakeRes(
      400,
      JSON.stringify({ title: "Dados inválidos", status: 400, errors: [{ field: "", message: "corpo vazio" }] }),
    );
    expect(await extractApiError(res)).toBe("corpo vazio");
  });

  it("prefere o detail ao title", async () => {
    const res = fakeRes(
      404,
      JSON.stringify({ type: "/errors/not-found", title: "Chamado não encontrado", status: 404, detail: "Não existe chamado com esse id" }),
    );
    expect(await extractApiError(res)).toBe("Não existe chamado com esse id");
  });

  it("sem detail usa o title", async () => {
    const res = fakeRes(500, JSON.stringify({ type: "/errors/internal", title: "Erro interno do servidor", status: 500 }));
    expect(await extractApiError(res)).toBe("Erro interno do servidor");
  });

  it("um corpo com title mas sem status não é tratado como problem+json", async () => {
    const res = fakeRes(400, JSON.stringify({ title: "qualquer", error: "mensagem antiga" }));
    expect(await extractApiError(res)).toBe("mensagem antiga");
  });
});
