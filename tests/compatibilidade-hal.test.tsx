import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SetoresPage from "../app/(dashboard)/admin/setores/page";
import SugestoesAdmin from "../app/(dashboard)/admin/sugestoes/page";
import SugestoesAluno from "../app/(dashboard)/aluno/sugestoes/page";
import DetalheAdmin from "../app/(dashboard)/admin/sugestoes/[id]/page";
import NotificacoesAluno from "../app/(dashboard)/aluno/notificacoes/page";
import NotificacoesAdmin from "../app/(dashboard)/admin/notificacoes/page";
import { resetEntryCache } from "../utils/entry";
import { json, stubApi } from "./helpers-api";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "sug-1" }) }));
vi.mock("../app/components/shared/SugestaoEditor", () => ({
  default: ({ onChange }: { onChange: (value: unknown) => void }) => (
    <button type="button" onClick={() => onChange({ texto: "Resposta válida", documento: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Resposta válida" }] }] } })}>Escrever resposta</button>
  ),
}));

const suggestion = { id: "sug-1", conteudo: "Sugestão de teste", status: "NAO_RESPONDIDO", criadoEm: "2026-11-01T12:00:00Z", emailContato: "aluno@example.com", resposta: null, respostaDocumento: null, _links: { answer: { href: "/suggestions/sug-1", method: "PATCH" } } };
const collection = (rel: string, items: unknown[], total = items.length) => ({ _embedded: { [rel]: items }, page: { number: 0, size: 10, totalElements: total, totalPages: 1 }, _links: {} });

beforeEach(() => { localStorage.clear(); resetEntryCache(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("contratos HAL do front", () => {
  it("carrega setores, usuários, papéis e vínculos das coleções do backend", async () => {
    const api = stubApi({
      "GET /admin/sectors": () => json(collection("sectors", [{ id: "sec-1", nome: "Secretaria" }])),
      "GET /admin/roles": () => json(collection("roles", [{ id: "role-1", nome: "Agente" }])),
      "GET /users": () => json(collection("users", [{ id: "user-1", nome: "Funcionário", papel: "TECNICO", ativo: true }])),
      "GET /admin/sectors/sec-1/users": () => json(collection("users", [{ id: "vinc-1", usuarioId: "user-1", setorId: "sec-1", papelId: "role-1", usuario: { nome: "Funcionário", ativo: true }, papel: { nome: "Agente" } }])),
    });
    render(<SetoresPage />);
    expect(await screen.findByRole("heading", { name: "Secretaria" })).toBeInTheDocument();
    expect(await screen.findByText("Funcionário")).toBeInTheDocument();
    expect(api.keys()).toContain("GET /admin/sectors/sec-1/users");
    expect(api.keys()).not.toContain("GET /admin/setores");
  });

  it("altera o papel usando o link do vínculo e não oferece ações ausentes", async () => {
    let body: Record<string, unknown> | undefined;
    const api = stubApi({
      "GET /admin/sectors": () => json(collection("sectors", [{ id: "sec-1", nome: "Secretaria", _links: {} }])),
      "GET /admin/roles": () => json(collection("roles", [{ id: "role-1", nome: "Agente" }])),
      "GET /users": () => json(collection("users", [])),
      "GET /admin/sectors/sec-1/users": () => json(collection("users", [{ id: "vinc-1", usuarioId: "user-1", setorId: "sec-1", papelId: null, usuario: { nome: "Funcionário", ativo: true }, _links: { update: { href: "/custom/vinculo", method: "PATCH" } } }])),
      "PATCH /custom/vinculo": (init) => { body = JSON.parse(String(init.body)); return json({}); },
    });
    render(<SetoresPage />);
    const select = await screen.findByRole("combobox");
    expect(screen.getByRole("button", { name: "Renomear" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /^Remover$/ })[0]).toBeDisabled();
    fireEvent.change(select, { target: { value: "role-1" } });
    await waitFor(() => expect(api.keys()).toContain("PATCH /custom/vinculo"));
    expect(body).toEqual({ papelId: "role-1" });
  });

  it.each([["aluno", SugestoesAluno], ["admin", SugestoesAdmin]] as const)("lista sugestões HAL na página zero para %s", async (_role, Page) => {
    const api = stubApi({
      "GET /api": () => json({ _links: { "current-user": { href: "/users/me" } } }),
      "GET /users/me": () => json({ id: "user-1", ra: "123" }),
      "GET /suggestions": () => json(collection("suggestions", [suggestion])),
    });
    render(<Page />);
    expect(await screen.findByText("Sugestão de teste")).toBeInTheDocument();
    const call = api.fetchMock.mock.calls.find(([url]) => String(url).includes("/suggestions"));
    const url = new URL(String(call?.[0]), "http://example.test");
    expect(url.searchParams.get("page")).toBe("0");
    expect(url.searchParams.get("size")).toBe("10");
  });

  it("responde usando link answer e envia texto/documento sem status manual", async () => {
    let body: Record<string, unknown> | undefined;
    const api = stubApi({
      "GET /suggestions/sug-1": () => json(suggestion),
      "PATCH /suggestions/sug-1": (init) => { body = JSON.parse(String(init.body)); return json({ ...suggestion, status: "RESPONDIDO" }); },
    });
    render(<DetalheAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "Escrever resposta" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.keys()).toContain("PATCH /suggestions/sug-1"));
    expect(body).toMatchObject({ resposta: "Resposta válida", respostaDocumento: { type: "doc" } });
    expect(body).not.toHaveProperty("status");
  });

  it("não permite responder se o backend não expõe o link answer", async () => {
    stubApi({ "GET /suggestions/sug-1": () => json({ ...suggestion, _links: {} }) });
    render(<DetalheAdmin />);
    await screen.findByText("Sugestão de teste");
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();
  });

  it.each([["aluno", NotificacoesAluno], ["admin", NotificacoesAdmin]] as const)("%s carrega notificações HAL e marca pelo link", async (_role, Page) => {
    let request: Record<string, unknown> | undefined;
    const notification = { id: "n1", titulo: "Aviso de teste", mensagem: "Nova atualização", tipo: "SISTEMA", criadoEm: "2026-11-01T12:00:00Z", lidaEm: null, _links: { "mark-read": { href: "/notifications/n1", method: "PATCH" } } };
    const api = stubApi({
      "GET /notifications": () => json({ ...collection("notifications", [notification]), _links: { "mark-all-read": { href: "/notifications", method: "PATCH" } } }),
      "PATCH /notifications/n1": (init) => { request = JSON.parse(String(init.body)); return json({ ...notification, lidaEm: "2026-11-05T00:00:00Z" }); },
    });
    render(<Page />);
    await screen.findByText("Nova atualização");
    fireEvent.click(screen.getByTitle("Marcar como lida"));
    await waitFor(() => expect(api.keys()).toContain("PATCH /notifications/n1"));
    expect(request).toEqual({ lida: true });
    expect(api.keys().some((key) => key.includes("/lida"))).toBe(false);
  });
});
