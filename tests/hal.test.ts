import { describe, it, expect, vi, beforeEach } from "vitest";
import { embedded, followLink, getLink, getLinks, hasLink, HalLinkError } from "../utils/hal";
import type { HalCollection, HalResource } from "../utils/hal";
import { apiFetch } from "../utils/api";

vi.mock("../utils/api", () => ({
  API_BASE: "http://api.test",
  apiFetch: vi.fn(),
}));

const chamado: HalResource = {
  _links: {
    self: { href: "/tickets/clx1", method: "GET" },
    reply: { href: "/tickets/clx1/messages", method: "POST" },
    transition: [
      { href: "/tickets/clx1", method: "PATCH", name: "RESOLVIDO" },
      { href: "/tickets/clx1", method: "PATCH", name: "ENCERRADO" },
    ],
  },
};

describe("getLinks", () => {
  it("transforma um link único em lista", () => {
    expect(getLinks(chamado, "self")).toEqual([{ href: "/tickets/clx1", method: "GET" }]);
  });

  it("devolve a lista quando o rel já tem vários links", () => {
    expect(getLinks(chamado, "transition")).toHaveLength(2);
  });

  it("devolve lista vazia quando o rel não existe", () => {
    expect(getLinks(chamado, "archive")).toEqual([]);
  });

  it.each([[undefined], [null], [{}]])("devolve lista vazia para o recurso %j", (recurso) => {
    expect(getLinks(recurso as HalResource | null | undefined, "self")).toEqual([]);
  });
});

describe("getLink e hasLink", () => {
  it("getLink devolve o primeiro link do rel", () => {
    expect(getLink(chamado, "reply")).toEqual({ href: "/tickets/clx1/messages", method: "POST" });
  });

  it("getLink com name escolhe o link certo", () => {
    expect(getLink(chamado, "transition", "ENCERRADO")?.name).toBe("ENCERRADO");
  });

  it("getLink com name inexistente devolve undefined", () => {
    expect(getLink(chamado, "transition", "ABERTO")).toBeUndefined();
  });

  it("hasLink é true só quando o link existe", () => {
    expect(hasLink(chamado, "reply")).toBe(true);
    expect(hasLink(chamado, "archive")).toBe(false);
    expect(hasLink(chamado, "transition", "RESOLVIDO")).toBe(true);
    expect(hasLink(chamado, "transition", "ABERTO")).toBe(false);
    expect(hasLink(undefined, "reply")).toBe(false);
  });
});

describe("embedded", () => {
  const colecao: HalCollection<{ id: string }> = {
    _embedded: { tickets: [{ id: "a" }, { id: "b" }] },
  };

  it("devolve os itens do rel", () => {
    expect(embedded(colecao, "tickets")).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("devolve lista vazia quando não há o rel ou a coleção", () => {
    expect(embedded(colecao, "messages")).toEqual([]);
    expect(embedded({}, "tickets")).toEqual([]);
    expect(embedded(null, "tickets")).toEqual([]);
  });
});

describe("followLink", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockResolvedValue({ ok: true } as Response);
  });

  it("usa o href (com a base da API) e o método do link", async () => {
    await followLink(chamado, "reply", { body: JSON.stringify({ conteudo: "oi" }) });
    expect(apiFetch).toHaveBeenCalledWith("http://api.test/tickets/clx1/messages", {
      body: JSON.stringify({ conteudo: "oi" }),
      method: "POST",
    });
  });

  it("sem method no link, usa GET", async () => {
    await followLink({ _links: { self: { href: "/tickets/clx1" } } }, "self");
    expect(vi.mocked(apiFetch).mock.calls[0][1]).toMatchObject({ method: "GET" });
  });

  it("o método do link vale sobre o method do init", async () => {
    await followLink(chamado, "reply", { method: "DELETE" });
    expect(vi.mocked(apiFetch).mock.calls[0][1]).toMatchObject({ method: "POST" });
  });

  it("name escolhe a transição e não vai para o fetch", async () => {
    await followLink(chamado, "transition", { name: "ENCERRADO", body: "{}" });
    const init = vi.mocked(apiFetch).mock.calls[0][1] as Record<string, unknown>;
    expect(init.method).toBe("PATCH");
    expect(init).not.toHaveProperty("name");
  });

  it("devolve a resposta do apiFetch", async () => {
    const res = await followLink(chamado, "self");
    expect(res).toEqual({ ok: true });
  });

  it("lança HalLinkError quando o link não existe, sem chamar a API", async () => {
    await expect(followLink(chamado, "archive")).rejects.toBeInstanceOf(HalLinkError);
    await expect(followLink(chamado, "transition", { name: "ABERTO" })).rejects.toThrow(/ABERTO/);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it.each([["https://evil.example/x"], ["//evil.example/x"], ["tickets/clx1"], [""]])(
    "recusa o href %j (não é caminho da API)",
    async (href) => {
      await expect(followLink({ _links: { self: { href } } }, "self")).rejects.toBeInstanceOf(HalLinkError);
      expect(apiFetch).not.toHaveBeenCalled();
    },
  );
});