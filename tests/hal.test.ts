import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  collectPages,
  embedded,
  followLink,
  getLink,
  getLinks,
  hasLink,
  HalLinkError,
  markMessagesRead,
  markTicketMessagesRead,
} from "../utils/hal";
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

describe("markMessagesRead", () => {
  const colecao: HalResource = {
    _links: { "mark-read": { href: "/tickets/clx1/messages", method: "PATCH" } },
  };

  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockResolvedValue({ ok: true } as Response);
  });

  it("segue o link mark-read mandando { lida: true }", async () => {
    await markMessagesRead(colecao);
    expect(apiFetch).toHaveBeenCalledWith("http://api.test/tickets/clx1/messages", {
      body: JSON.stringify({ lida: true }),
      method: "PATCH",
    });
  });

  it("não chama a API quando não há o link (nada para marcar)", async () => {
    await markMessagesRead({ _links: { self: { href: "/tickets/clx1/messages" } } });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("engole o erro: ler a conversa não pode quebrar a tela", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error("rede caiu"));
    await expect(markMessagesRead(colecao)).resolves.toBeUndefined();
  });
});

describe("markTicketMessagesRead", () => {
  const ticket: HalResource = {
    _links: { messages: { href: "/tickets/clx1/messages", method: "GET" } },
  };

  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("busca a coleção pelo link messages e marca como lidas", async () => {
    const colecao = { _links: { "mark-read": { href: "/tickets/clx1/messages", method: "PATCH" } } };
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ ok: true, json: async () => colecao } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);

    await markTicketMessagesRead(ticket);

    expect(vi.mocked(apiFetch).mock.calls[0][1]).toMatchObject({ method: "GET" });
    expect(vi.mocked(apiFetch).mock.calls[1][1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({ lida: true }),
    });
  });

  it("se a coleção não tem mark-read, só faz a busca", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: true, json: async () => ({ _links: {} }) } as Response);

    await markTicketMessagesRead(ticket);

    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("sem o link messages no chamado, não chama a API", async () => {
    await markTicketMessagesRead({ _links: {} });
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
describe("collectPages", () => {
  const pagina = (ids: string[], next?: string): HalCollection<{ id: string }> => ({
    _embedded: { messages: ids.map((id) => ({ id })) },
    _links: {
      self: { href: "/tickets/clx1/messages?page=0", method: "GET" },
      ...(next ? { next: { href: next, method: "GET" as const } } : {}),
    },
  });
  const resposta = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("com uma página só, devolve os itens sem chamar a API", async () => {
    const itens = await collectPages(pagina(["a", "b"]), "messages");
    expect(itens.map((i) => i.id)).toEqual(["a", "b"]);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("segue o next até acabar e junta tudo em ordem", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(resposta(pagina(["c", "d"], "/tickets/clx1/messages?page=2")))
      .mockResolvedValueOnce(resposta(pagina(["e"])));

    const itens = await collectPages(pagina(["a", "b"], "/tickets/clx1/messages?page=1"), "messages");

    expect(itens.map((i) => i.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(apiFetch).toHaveBeenNthCalledWith(1, "http://api.test/tickets/clx1/messages?page=1", expect.objectContaining({ method: "GET" }));
    expect(apiFetch).toHaveBeenNthCalledWith(2, "http://api.test/tickets/clx1/messages?page=2", expect.objectContaining({ method: "GET" }));
  });

  it("se uma página seguinte falha, devolve o que já juntou", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(resposta({}, false));
    const itens = await collectPages(pagina(["a"], "/tickets/clx1/messages?page=1"), "messages");
    expect(itens.map((i) => i.id)).toEqual(["a"]);
  });

  it("respeita o limite de páginas, mesmo que a API ofereça next para sempre", async () => {
    vi.mocked(apiFetch).mockImplementation(async () => resposta(pagina(["x"], "/tickets/clx1/messages?page=9")));
    const itens = await collectPages(pagina(["a"], "/tickets/clx1/messages?page=1"), "messages", 3);
    expect(itens).toHaveLength(3);
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
});
