import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetEntryCache } from "../utils/entry";
import { storeSession } from "../utils/session";
import { entryWith, json, stubApi } from "./helpers-api";
import { toast } from "sonner";
import ComunicacoesPage from "../app/(dashboard)/admin/comunicacoes/page";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type DialogProps = {
  open: boolean;
  confirmLabel?: string;
  input?: { label: string };
  onConfirm: (value?: string) => void;
};

vi.mock("../app/components/ui/ConfirmDialog", () => ({
  default: ({ open, confirmLabel = "Confirmar", input, onConfirm }: DialogProps) =>
    open ? (
      <div role="dialog">
        {input && <input aria-label={input.label} defaultValue="qa@example.test" />}
        <button type="button" onClick={() => onConfirm(input ? "  qa@example.test  " : undefined)}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

const entry = entryWith({
  "communication-templates": { href: "/admin/communication-templates", method: "GET" },
});

function template(chave: string, nome: string, links: Record<string, { href: string; method?: string }> = {}) {
  return {
    id: `id-${chave}`,
    chave,
    nome,
    descricao: `Descricao ${nome}`,
    habilitado: true,
    assunto: `Assunto ${nome}`,
    corpo: `Corpo ${nome}`,
    variaveis: ["aluno.nome"],
    _links: {
      self: { href: `/admin/communication-templates/${chave}`, method: "GET" },
      collection: { href: "/admin/communication-templates", method: "GET" },
      update: { href: `/admin/communication-templates/${chave}`, method: "PUT" },
      ...links,
    },
  };
}

function templatesCollection(
  resources: ReturnType<typeof template>[],
  includeTestLink = true,
  testHref = "/admin/communication-tests",
) {
  return {
    _embedded: { "communication-templates": resources },
    page: { size: 20, number: 0, totalElements: resources.length, totalPages: resources.length ? 1 : 0 },
    _links: {
      self: { href: "/admin/communication-templates?page=0&size=20", method: "GET" },
      first: { href: "/admin/communication-templates?page=0&size=20", method: "GET" },
      last: { href: "/admin/communication-templates?page=0&size=20", method: "GET" },
      ...(includeTestLink ? { "communication-tests": { href: testHref, method: "POST" } } : {}),
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  resetEntryCache();
  storeSession({ accessToken: "communications-test-token" });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("communications HAL screen", () => {
  it("loads the collection from the entry and merges persisted templates over defaults", async () => {
    const api = stubApi({
      "GET /api": () => json(entry),
      "GET /admin/communication-templates": () => json(templatesCollection([
        template("TICKET_OPENED", "Persistido - Chamado aberto"),
      ])),
    });

    render(<ComunicacoesPage />);

    expect(await screen.findByText("Persistido - Chamado aberto")).toBeInTheDocument();
    expect(screen.getByText("Bem-vindo — Primeiro acesso")).toBeInTheDocument();
    expect(api.keys()).toEqual(["GET /api", "GET /admin/communication-templates"]);
  });

  it("hides send-test when the collection does not advertise communication-tests", async () => {
    stubApi({
      "GET /api": () => json(entry),
      "GET /admin/communication-templates": () => json(templatesCollection([], false)),
    });

    render(<ComunicacoesPage />);

    expect(await screen.findByText("Bem-vindo — Primeiro acesso")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar teste" })).not.toBeInTheDocument();
  });

  it("follows the collection communication-tests href and method and displays its message", async () => {
    const api = stubApi({
      "GET /api": () => json(entry),
      "GET /admin/communication-templates": () => json(templatesCollection([], true, "/mail-test-link")),
      "POST /mail-test-link": () => json({
        message: "Teste HAL enviado",
        _links: { collection: { href: "/admin/communication-templates", method: "GET" } },
      }),
    });

    render(<ComunicacoesPage />);

    expect(await screen.findByText("Bem-vindo — Primeiro acesso")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar teste" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(api.calls).toContainEqual({
      key: "POST /mail-test-link",
      auth: "Bearer communications-test-token",
    }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Teste HAL enviado"));
  });

  it("updates an already-persisted template through its advertised update link", async () => {
    const persisted = template("TICKET_OPENED", "Template existente", {
      update: { href: "/persisted-update-link", method: "PUT" },
    });
    const api = stubApi({
      "GET /api": () => json(entry),
      "GET /admin/communication-templates": () => json(templatesCollection([persisted])),
      "PUT /persisted-update-link": () => json({ ...persisted, assunto: "Assunto atualizado" }, 200),
    });

    render(<ComunicacoesPage />);
    expect(await screen.findByText("Template existente")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Template existente" }));
    fireEvent.change(screen.getByLabelText("Assunto"), { target: { value: "Assunto editado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(api.calls).toContainEqual({
      key: "PUT /persisted-update-link",
      auth: "Bearer communications-test-token",
    }));
    const putCall = api.fetchMock.mock.calls.find(([input, init]) =>
      new URL(String(input), "http://localhost").pathname === "/persisted-update-link" && init?.method === "PUT",
    );
    expect(JSON.parse(String(putCall?.[1]?.body))).toMatchObject({ assunto: "Assunto editado" });
  });

  it("creates a static template with 201, then updates it through its returned update link with 200", async () => {
    let writes = 0;
    const created = template("WELCOME_FIRST_ACCESS", "Bem-vindo — Primeiro acesso", {
      update: { href: "/admin/communication-templates/WELCOME_FIRST_ACCESS", method: "PUT" },
    });
    const api = stubApi({
      "GET /api": () => json(entry),
      "GET /admin/communication-templates": () => json(templatesCollection([
        template("TICKET_OPENED", "Persistido - Chamado aberto"),
      ])),
      "PUT /admin/communication-templates/WELCOME_FIRST_ACCESS": () => {
        writes += 1;
        const resource = { ...created, assunto: `Assunto salvo ${writes}` };
        return json(resource, writes === 1 ? 201 : 200);
      },
    });

    render(<ComunicacoesPage />);
    expect(await screen.findByText("Bem-vindo — Primeiro acesso")).toBeInTheDocument();

    const subject = screen.getByLabelText("Assunto");
    fireEvent.change(subject, { target: { value: "Primeira gravação" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(writes).toBe(1));

    fireEvent.change(screen.getByLabelText("Assunto"), { target: { value: "Segunda gravação" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(writes).toBe(2));

    const putCalls = api.fetchMock.mock.calls.filter(([input, init]) =>
      new URL(String(input), "http://localhost").pathname === "/admin/communication-templates/WELCOME_FIRST_ACCESS" &&
      init?.method === "PUT",
    );
    expect(putCalls).toHaveLength(2);
    expect(JSON.parse(String(putCalls[0][1]?.body))).toMatchObject({ assunto: "Primeira gravação" });
    expect(JSON.parse(String(putCalls[1][1]?.body))).toMatchObject({ assunto: "Segunda gravação" });
  });
});
