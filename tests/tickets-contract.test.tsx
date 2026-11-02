import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AlunoTicket from "../app/(dashboard)/aluno/chamados/[id]/page";
import AdminTicket from "../app/(dashboard)/admin/chamados/[id]/page";
import Messages from "../app/(dashboard)/admin/mensagens/page";
import { resetEntryCache } from "../utils/entry";
import { json, stubApi } from "./helpers-api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "ticket-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));

const ticket = {
  id: "ticket-1", titulo: "Solicitação de teste", descricao: "Descrição da solicitação",
  status: "ABERTO", prioridade: "MEDIA", nivel: "N1", criadoPorId: "student-1",
  criadoEm: "2026-11-01T12:00:00Z", atualizadoEm: "2026-11-01T12:00:00Z", mensagens: [],
  _links: {
    self: { href: "/tickets/ticket-1", method: "GET" },
    attachments: { href: "/contract/attachments", method: "GET" },
    messages: { href: "/contract/messages", method: "GET" },
    upload: { href: "/contract/upload", method: "POST" },
    reply: { href: "/contract/reply", method: "POST" },
  },
};
const attachment = {
  id: "attachment-1", nomeArquivo: "comprovante.pdf", mimeType: "application/pdf",
  tamanhoBytes: 32, enviadoEm: "2026-11-01T12:00:00Z",
  _links: {}, // Retenção expirada: metadados visíveis, download indisponível.
};

beforeEach(() => {
  localStorage.clear();
  resetEntryCache();
  vi.stubGlobal("WebSocket", class { close() {} send() {} });
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollTo = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function mockApi(resource = ticket) {
  return stubApi({
    "GET /api": () => json({ _links: { "current-user": { href: "/users/me" } } }),
    "GET /users/me": () => json({ id: "student-1", nome: "Aluno" }),
    "GET /users/student-1": () => json({ id: "student-1", ra: "12345" }),
    "GET /tickets/ticket-1": () => json(resource),
    "GET /tickets": () => json({ _embedded: { tickets: [resource] } }),
    "GET /contract/attachments": () => json({ _embedded: { attachments: [attachment] } }),
    "GET /contract/messages": () => json({ _embedded: { messages: [] } }),
    "POST /contract/upload": () => json(attachment, 201),
    "POST /contract/reply": () => json({ id: "message-1", conteudo: "Olá", autorId: "student-1", criadoEm: "2026-11-02T12:00:00Z" }, 201),
  });
}

describe("telas de chamados compatíveis com HAL", () => {
  it.each([
    ["aluno", AlunoTicket], ["equipe", AdminTicket],
  ] as const)("%s lê _embedded.attachments e respeita ausência de content", async (_role, Page) => {
    const api = mockApi();
    render(<Page />);
    expect(await screen.findByText("comprovante.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Baixar" })).toBeDisabled();
    expect(api.keys()).toContain("GET /contract/attachments");
    expect(api.keys().some((key) => key.includes("/anexos") || key.includes("/usuarios"))).toBe(false);
  });

  it("equipe carrega o perfil do aluno pela rota /users e faz upload pelo link", async () => {
    const api = mockApi();
    const { container } = render(<AdminTicket />);
    await screen.findByText("comprovante.pdf");
    await waitFor(() => expect(api.keys()).toContain("GET /users/student-1"));
    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File(["pdf"], "novo.pdf", { type: "application/pdf" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar arquivo" }));
    await waitFor(() => expect(api.keys()).toContain("POST /contract/upload"));
  });

  it("a conversa segue os links messages/reply e envia a mensagem", async () => {
    const api = mockApi();
    render(<Messages />);
    // Há também a busca: selecionar o campo da conversa pelo placeholder.
    await waitFor(() => expect(screen.getByPlaceholderText("Escreva uma mensagem…")).toBeEnabled());
    const text = screen.getByPlaceholderText("Escreva uma mensagem…");
    fireEvent.change(text, { target: { value: "Olá" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(api.keys()).toContain("POST /contract/reply"));
    expect(api.keys()).toContain("GET /contract/messages");
  });

  it("a conversa resolvida sem reply/upload bloqueia os controles", async () => {
    const closed = { ...ticket, status: "RESOLVIDO", _links: {
      self: ticket._links.self, messages: ticket._links.messages, attachments: ticket._links.attachments,
    } };
    const api = mockApi(closed as typeof ticket);
    render(<Messages />);
    await waitFor(() => expect(api.keys()).toContain("GET /contract/messages"));
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    expect(screen.getByTitle("Anexar arquivo")).toBeDisabled();
    expect(screen.getByPlaceholderText("Conversa disponível apenas para leitura")).toBeDisabled();
    expect(api.keys().filter((key) => key.startsWith("POST"))).toEqual([]);
  });
});
