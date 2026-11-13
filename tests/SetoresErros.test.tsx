import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import SetoresPage from "../app/(dashboard)/admin/setores/page";
import { json, stubApi } from "./helpers-api";

const collection = (rel: string, items: unknown[]) => ({ _embedded: { [rel]: items }, page: { number: 0, size: 10, totalElements: items.length, totalPages: 1 }, _links: {} });
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Setores: falhas de carregamento", () => {
  it("informa falha ao carregar setores sem apresentar lista vazia como sucesso", async () => {
    stubApi({
      "GET /admin/sectors": () => json({}, 500),
      "GET /admin/roles": () => json(collection("roles", [])),
      "GET /users": () => json(collection("users", [])),
    });
    render(<SetoresPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar setores (500)");
    expect(screen.queryByText("Nenhum setor encontrado.")).not.toBeInTheDocument();
    expect(screen.queryByText("Nenhum setor cadastrado. Crie o primeiro à esquerda.")).not.toBeInTheDocument();
  });

  it("informa falha ao carregar membros e impede atribuição sem conhecer os vínculos", async () => {
    stubApi({
      "GET /admin/sectors": () => json(collection("sectors", [{ id: "s1", nome: "Secretaria", _links: { delete: { href: "/admin/sectors/s1", method: "DELETE" } } }])),
      "GET /admin/roles": () => json(collection("roles", [])),
      "GET /users": () => json(collection("users", [])),
      "GET /admin/sectors/s1/users": () => json({}, 503),
    });
    render(<SetoresPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha ao carregar membros (503)");
    expect(screen.queryByText("Nenhum membro neste setor.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atribuir funcionários" })).toBeDisabled();
  });
  it.each([
    ["roles", "Falha ao carregar pap\u00e9is (503)"],
    ["users", "Falha ao carregar funcion\u00e1rios (503)"],
  ])("informa falha da cole\u00e7\u00e3o %s e bloqueia atribui\u00e7\u00e3o", async (failed, message) => {
    stubApi({
      "GET /admin/sectors": () => json(collection("sectors", [{ id: "s1", nome: "Secretaria" }])),
      "GET /admin/roles": () => failed === "roles" ? json({}, 503) : json(collection("roles", [])),
      "GET /users": () => failed === "users" ? json({}, 503) : json(collection("users", [])),
      "GET /admin/sectors/s1/users": () => json(collection("users", [{ id: "v1", usuarioId: "u1", setorId: "s1", usuario: { nome: "Pessoa", ativo: true }, _links: { update: { href: "/admin/user-sectors/v1", method: "PATCH" } } }])),
    });
    render(<SetoresPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(await screen.findByRole("button", { name: "Atribuir funcion\u00e1rios" })).toBeDisabled();
    if (failed === "roles") expect(await screen.findByRole("combobox")).toBeDisabled();
  });
  it("recusa pagina parcial quando uma pagina seguinte falha", async () => {
    let chamadas = 0;
    stubApi({
      "GET /admin/sectors": () => {
        chamadas++;
        if (chamadas > 1) return json({}, 503);
        return json({ ...collection("sectors", [{ id: "s1", nome: "Secretaria" }]), page: { number: 0, size: 1, totalElements: 2, totalPages: 2 }, _links: { next: { href: "/admin/sectors?page=1", method: "GET" } } });
      },
      "GET /admin/roles": () => json(collection("roles", [])),
      "GET /users": () => json(collection("users", [])),
    });
    render(<SetoresPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("N\u00e3o foi poss\u00edvel carregar todos os resultados paginados.");
    expect(chamadas).toBe(2);
    expect(screen.queryByRole("heading", { name: "Secretaria" })).not.toBeInTheDocument();
  });

  it("ignora resposta atrasada dos membros de setor anteriormente selecionado", async () => {
    let resolveFirst!: (response: Response) => void;
    const first = new Promise<Response>((resolve) => { resolveFirst = resolve; });
    stubApi({
      "GET /admin/sectors": () => json(collection("sectors", [{ id: "s1", nome: "Primeiro" }, { id: "s2", nome: "Segundo" }])),
      "GET /admin/roles": () => json(collection("roles", [])),
      "GET /users": () => json(collection("users", [])),
      "GET /admin/sectors/s1/users": () => first,
      "GET /admin/sectors/s2/users": () => json(collection("users", [{ id: "v2", usuarioId: "u2", setorId: "s2", usuario: { nome: "Pessoa atual", ativo: true } }])),
    });
    render(<SetoresPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Segundo" }));
    expect(await screen.findByText("Pessoa atual")).toBeInTheDocument();
    await act(async () => {
      resolveFirst(json(collection("users", [{ id: "v1", usuarioId: "u1", setorId: "s1", usuario: { nome: "Pessoa antiga", ativo: true } }])));
      await first;
    });
    expect(screen.getByText("Pessoa atual")).toBeInTheDocument();
    expect(screen.queryByText("Pessoa antiga")).not.toBeInTheDocument();
  });
  it("impede trocar de setor enquanto uma alteração de membro está pendente", async () => {
    let resolveUpdate!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => { resolveUpdate = resolve; });
    stubApi({
      "GET /admin/sectors": () => json(collection("sectors", [{ id: "s1", nome: "Primeiro" }, { id: "s2", nome: "Segundo" }])),
      "GET /admin/roles": () => json(collection("roles", [{ id: "p1", nome: "Gestor" }])),
      "GET /users": () => json(collection("users", [])),
      "GET /admin/sectors/s1/users": () => json(collection("users", [{ id: "v1", usuarioId: "u1", setorId: "s1", usuario: { nome: "Pessoa", ativo: true }, _links: { update: { href: "/v1", method: "PATCH" } } }])),
      "GET /admin/sectors/s2/users": () => json(collection("users", [])),
      "PATCH /v1": () => pending,
    });
    render(<SetoresPage />);
    const role = await screen.findByRole("combobox");
    await waitFor(() => expect(role).toBeEnabled());
    fireEvent.change(role, { target: { value: "p1" } });
    const other = screen.getByRole("button", { name: "Segundo" });
    expect(other).toBeDisabled();
    await act(async () => { resolveUpdate(json({})); await pending; });
    await waitFor(() => expect(other).toBeEnabled());
    fireEvent.click(other);
    expect(await screen.findByRole("heading", { name: "Segundo" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Pessoa")).not.toBeInTheDocument());
  });

  it("informa atribuicao parcial e atualiza membros apos as respostas", async () => {
    const warning = vi.spyOn(toast, "warning");
    let loads = 0;
    stubApi({
      "GET /admin/sectors": () => json(collection("sectors", [{ id: "s1", nome: "Secretaria" }])),
      "GET /admin/roles": () => json(collection("roles", [])),
      "GET /users": () => json(collection("users", [{ id: "u1", nome: "Alice", ativo: true, papel: "TECNICO" }, { id: "u2", nome: "Bruno", ativo: true, papel: "TECNICO" }])),
      "GET /admin/sectors/s1/users": () => {
        loads++;
        return json(collection("users", loads === 1 ? [] : [{ id: "v1", usuarioId: "u1", setorId: "s1", usuario: { nome: "Alice", ativo: true } }]));
      },
      "POST /admin/users/u1/sectors": () => json({}, 201),
      "POST /admin/users/u2/sectors": () => json({}, 500),
    });
    render(<SetoresPage />);
    const open = await screen.findByRole("button", { name: "Atribuir funcion\u00e1rios" });
    await waitFor(() => expect(open).toBeEnabled());
    fireEvent.click(open);
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByRole("button", { name: "Atribuir ao setor" }));
    await waitFor(() => expect(warning).toHaveBeenCalledWith("1 atribu\u00eddo(s), 1 com erro."));
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(loads).toBe(2);
  });
  it("desabilita acoes apos recarga parcial que sucede uma lista valida", async () => {
    const previousShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
    const previousClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } });
    try {
      let loads = 0;
      const sector = { id: "s1", nome: "Secretaria", _links: { update: { href: "/admin/sectors/s1", method: "PATCH" }, delete: { href: "/admin/sectors/s1", method: "DELETE" } } };
      stubApi({
        "GET /admin/sectors": () => {
          loads++;
          if (loads === 1) return json({ ...collection("sectors", [sector]), _links: { create: { href: "/admin/sectors", method: "POST" } } });
          if (loads === 2) return json({ ...collection("sectors", [sector]), page: { number: 0, size: 1, totalElements: 2, totalPages: 2 }, _links: { next: { href: "/admin/sectors?page=1", method: "GET" }, create: { href: "/admin/sectors", method: "POST" } } });
          return json({}, 503);
        },
        "POST /admin/sectors": () => json({ id: "s2", nome: "Novo" }, 201),
        "GET /admin/roles": () => json(collection("roles", [])),
        "GET /users": () => json(collection("users", [])),
        "GET /admin/sectors/s1/users": () => json(collection("users", [])),
      });
      render(<SetoresPage />);
      const create = await screen.findByRole("button", { name: "Novo setor" });
      await waitFor(() => expect(create).toBeEnabled());
      fireEvent.click(create);
      fireEvent.change(await screen.findByLabelText("Nome do setor"), { target: { value: "Novo" } });
      fireEvent.click(screen.getByRole("button", { name: "Criar" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("N\u00e3o foi poss\u00edvel carregar todos os resultados paginados.");
      expect(screen.getByRole("button", { name: "Novo setor" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Renomear" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Remover" })).toBeDisabled();
      expect(screen.queryByRole("heading", { name: "Secretaria" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Atribuir funcion\u00e1rios" })).not.toBeInTheDocument();
    } finally {
      if (previousShow) Object.defineProperty(HTMLDialogElement.prototype, "showModal", previousShow);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
      if (previousClose) Object.defineProperty(HTMLDialogElement.prototype, "close", previousClose);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
    }
  });
  it("reune setores de todas as paginas seguindo o link next", async () => {
    let loads = 0;
    stubApi({
      "GET /admin/sectors": () => {
        loads++;
        if (loads === 1) return json({ ...collection("sectors", [{ id: "s1", nome: "Primeiro" }]), page: { number: 0, size: 1, totalElements: 2, totalPages: 2 }, _links: { next: { href: "/admin/sectors?page=1", method: "GET" } } });
        return json({ ...collection("sectors", [{ id: "s2", nome: "Segundo" }]), page: { number: 1, size: 1, totalElements: 2, totalPages: 2 } });
      },
      "GET /admin/roles": () => json(collection("roles", [])),
      "GET /users": () => json(collection("users", [])),
      "GET /admin/sectors/s1/users": () => json(collection("users", [])),
      "GET /admin/sectors/s2/users": () => json(collection("users", [])),
    });
    render(<SetoresPage />);
    expect(await screen.findByRole("button", { name: "Segundo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Primeiro" })).toBeInTheDocument();
    expect(loads).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Segundo" }));
    expect(await screen.findByRole("heading", { name: "Segundo" })).toBeInTheDocument();
  });

  it("mantem dialogo e lista quando a criacao de setor e recusada", async () => {
    const previousShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
    const previousClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } });
    try {
      const errorToast = vi.spyOn(toast, "error");
      let loads = 0;
      stubApi({
        "GET /admin/sectors": () => { loads++; return json({ ...collection("sectors", [{ id: "s1", nome: "Secretaria" }]), _links: { create: { href: "/admin/sectors", method: "POST" } } }); },
        "POST /admin/sectors": () => json({}, 403),
        "GET /admin/roles": () => json(collection("roles", [])),
        "GET /users": () => json(collection("users", [])),
        "GET /admin/sectors/s1/users": () => json(collection("users", [])),
      });
      render(<SetoresPage />);
      const create = await screen.findByRole("button", { name: "Novo setor" });
      await waitFor(() => expect(create).toBeEnabled());
      fireEvent.click(create);
      fireEvent.change(await screen.findByLabelText("Nome do setor"), { target: { value: "Novo" } });
      fireEvent.click(screen.getByRole("button", { name: "Criar" }));
      await waitFor(() => expect(errorToast).toHaveBeenCalledWith("Falha ao criar setor (403)"));
      expect(screen.getByRole("dialog", { name: "Novo setor" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Secretaria" })).toBeInTheDocument();
      expect(loads).toBe(1);
    } finally {
      if (previousShow) Object.defineProperty(HTMLDialogElement.prototype, "showModal", previousShow);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
      if (previousClose) Object.defineProperty(HTMLDialogElement.prototype, "close", previousClose);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
    }
  });
  it("renomeia e exclui setor seguindo links HAL e reflete a recarga", async () => {
    const previousShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
    const previousClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } });
    try {
      let name = "Secretaria";
      let exists = true;
      let payload: unknown;
      const api = stubApi({
        "GET /admin/sectors": () => json(collection("sectors", exists ? [{ id: "s1", nome: name, _links: { update: { href: "/custom/sector", method: "PATCH" }, delete: { href: "/custom/sector", method: "DELETE" } } }] : [])),
        "GET /admin/roles": () => json(collection("roles", [])),
        "GET /users": () => json(collection("users", [])),
        "GET /admin/sectors/s1/users": () => json(collection("users", [])),
        "PATCH /custom/sector": (init) => { payload = JSON.parse(String(init.body)); name = "Secretaria nova"; return json({ id: "s1", nome: name }); },
        "DELETE /custom/sector": () => { exists = false; return new Response(null, { status: 204 }); },
      });
      render(<SetoresPage />);
      const rename = await screen.findByRole("button", { name: "Renomear" });
      await waitFor(() => expect(rename).toBeEnabled());
      fireEvent.click(rename);
      fireEvent.change(await screen.findByLabelText("Novo nome"), { target: { value: "Secretaria nova" } });
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
      expect(await screen.findByRole("heading", { name: "Secretaria nova" })).toBeInTheDocument();
      expect(payload).toEqual({ nome: "Secretaria nova" });
      fireEvent.click(screen.getByRole("button", { name: "Remover" }));
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Remover" }));
      expect(await screen.findByText("Nenhum setor cadastrado. Crie o primeiro \u00e0 esquerda.")).toBeInTheDocument();
      expect(api.keys()).toContain("PATCH /custom/sector");
      expect(api.keys()).toContain("DELETE /custom/sector");
    } finally {
      if (previousShow) Object.defineProperty(HTMLDialogElement.prototype, "showModal", previousShow);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
      if (previousClose) Object.defineProperty(HTMLDialogElement.prototype, "close", previousClose);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
    }
  });
  it("mantem setor e confirmacao quando exclusao retorna conflito", async () => {
    const previousShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
    const previousClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } });
    try {
      const errorToast = vi.spyOn(toast, "error");
      let loads = 0;
      stubApi({
        "GET /admin/sectors": () => { loads++; return json(collection("sectors", [{ id: "s1", nome: "Secretaria", _links: { delete: { href: "/custom/sector", method: "DELETE" } } }])); },
        "GET /admin/roles": () => json(collection("roles", [])),
        "GET /users": () => json(collection("users", [])),
        "GET /admin/sectors/s1/users": () => json(collection("users", [])),
        "DELETE /custom/sector": () => json({}, 409),
      });
      render(<SetoresPage />);
      const remove = await screen.findByRole("button", { name: "Remover" });
      await waitFor(() => expect(remove).toBeEnabled());
      fireEvent.click(remove);
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Remover" }));
      await waitFor(() => expect(errorToast).toHaveBeenCalledWith("Falha ao remover (409)"));
      expect(dialog).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Secretaria" })).toBeInTheDocument();
      expect(loads).toBe(1);
    } finally {
      if (previousShow) Object.defineProperty(HTMLDialogElement.prototype, "showModal", previousShow);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
      if (previousClose) Object.defineProperty(HTMLDialogElement.prototype, "close", previousClose);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
    }
  });

  it("filtra setores na barra lateral e candidatos disponiveis no drawer sem repetir membros", async () => {
    stubApi({
      "GET /admin/sectors": () => json(collection("sectors", [{ id: "s1", nome: "Secretaria" }, { id: "s2", nome: "Biblioteca" }])),
      "GET /admin/roles": () => json(collection("roles", [{ id: "r1", nome: "Atendente" }])),
      "GET /users": () => json(collection("users", [
        { id: "u1", nome: "Alice Membro", emailPessoal: "alice@fatec.test", ativo: true, papel: "TECNICO" },
        { id: "u2", nome: "Bruno Candidato", emailPessoal: "bruno@fatec.test", ativo: true, papel: "TECNICO" },
        { id: "u3", nome: "Carla Candidata", emailPessoal: "carla@fatec.test", ativo: true, papel: "BACKOFFICE" },
      ])),
      "GET /admin/sectors/s1/users": () => json(collection("users", [
        { id: "v1", usuarioId: "u1", setorId: "s1", usuario: { id: "u1", nome: "Alice Membro", ativo: true } },
      ])),
      "GET /admin/sectors/s2/users": () => json(collection("users", [])),
    });
    render(<SetoresPage />);
    expect(await screen.findByText("Alice Membro")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Buscar setor"), { target: { value: "Biblio" } });
    expect(screen.queryByRole("button", { name: "Secretaria" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Biblioteca" })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Buscar setor"), { target: { value: "" } });
    const assign = screen.getByRole("button", { name: "Atribuir funcionários" });
    await waitFor(() => expect(assign).toBeEnabled());
    fireEvent.click(assign);

    const drawerTitle = await screen.findByText(/Atribuir funcionários — Secretaria/);
    const drawer = drawerTitle.closest("div.fixed") as HTMLElement;
    expect(within(drawer).queryByText("Alice Membro")).not.toBeInTheDocument();
    expect(within(drawer).getByText("Bruno Candidato")).toBeInTheDocument();
    expect(within(drawer).getByText("Carla Candidata")).toBeInTheDocument();

    fireEvent.change(within(drawer).getByPlaceholderText("Buscar por nome ou e-mail"), { target: { value: "carla@fatec" } });
    expect(within(drawer).queryByText("Bruno Candidato")).not.toBeInTheDocument();
    expect(within(drawer).getByText("Carla Candidata")).toBeInTheDocument();
  });

  it("reune membros de todas as paginas seguindo o link next", async () => {
    let loads = 0;
    stubApi({
      "GET /admin/sectors": () => json(collection("sectors", [{ id: "s1", nome: "Secretaria" }])),
      "GET /admin/roles": () => json(collection("roles", [])),
      "GET /users": () => json(collection("users", [])),
      "GET /admin/sectors/s1/users": () => {
        loads++;
        if (loads === 1) {
          return json({
            ...collection("users", [{ id: "v1", usuarioId: "u1", setorId: "s1", usuario: { nome: "Alice Pag1", ativo: true } }]),
            page: { number: 0, size: 1, totalElements: 2, totalPages: 2 },
            _links: { next: { href: "/admin/sectors/s1/users?page=1", method: "GET" } },
          });
        }
        return json({
          ...collection("users", [{ id: "v2", usuarioId: "u2", setorId: "s1", usuario: { nome: "Bruno Pag2", ativo: true } }]),
          page: { number: 1, size: 1, totalElements: 2, totalPages: 2 },
        });
      },
    });
    render(<SetoresPage />);
    expect(await screen.findByText("Alice Pag1")).toBeInTheDocument();
    expect(screen.getByText("Bruno Pag2")).toBeInTheDocument();
    expect(screen.getByText("2 membro(s)")).toBeInTheDocument();
    expect(loads).toBe(2);
  });

  it("desvincula membro seguindo link HAL delete e preserva estado quando falha", async () => {
    const previousShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
    const previousClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.removeAttribute("open"); } });
    try {
      const errorToast = vi.spyOn(toast, "error");
      let deleted = false;
      let shouldFail = true;
      const api = stubApi({
        "GET /admin/sectors": () => json(collection("sectors", [{ id: "s1", nome: "Secretaria" }])),
        "GET /admin/roles": () => json(collection("roles", [])),
        "GET /users": () => json(collection("users", [])),
        "GET /admin/sectors/s1/users": () => json(collection("users", deleted ? [] : [
          {
            id: "v1",
            usuarioId: "u1",
            setorId: "s1",
            usuario: { nome: "Alice Vínculo", ativo: true },
            _links: { delete: { href: "/custom/binding/v1", method: "DELETE" } },
          },
        ])),
        "DELETE /custom/binding/v1": () => {
          if (shouldFail) return json({}, 500);
          deleted = true;
          return new Response(null, { status: 204 });
        },
      });
      render(<SetoresPage />);
      const removeBtn = await screen.findByTitle("Remover do setor");
      await waitFor(() => expect(removeBtn).toBeEnabled());
      fireEvent.click(removeBtn);

      let dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Remover" }));
      await waitFor(() => expect(errorToast).toHaveBeenCalledWith("Falha ao remover membro (500)"));
      expect(dialog).toBeInTheDocument();
      expect(screen.getByText("Alice Vínculo")).toBeInTheDocument();

      shouldFail = false;
      fireEvent.click(within(dialog).getByRole("button", { name: "Remover" }));
      await waitFor(() => expect(screen.queryByText("Alice Vínculo")).not.toBeInTheDocument());
      expect(screen.getByText("Nenhum membro neste setor.")).toBeInTheDocument();
      expect(api.keys()).toContain("DELETE /custom/binding/v1");
    } finally {
      if (previousShow) Object.defineProperty(HTMLDialogElement.prototype, "showModal", previousShow);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
      if (previousClose) Object.defineProperty(HTMLDialogElement.prototype, "close", previousClose);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
    }
  });

  it("exibe erro quando alteracao de papel falha e mantem papel anterior", async () => {
    const errorToast = vi.spyOn(toast, "error");
    stubApi({
      "GET /admin/sectors": () => json(collection("sectors", [{ id: "s1", nome: "Secretaria" }])),
      "GET /admin/roles": () => json(collection("roles", [{ id: "r1", nome: "Gestor" }, { id: "r2", nome: "Analista" }])),
      "GET /users": () => json(collection("users", [])),
      "GET /admin/sectors/s1/users": () => json(collection("users", [
        {
          id: "v1",
          usuarioId: "u1",
          setorId: "s1",
          papelId: "r1",
          papel: { id: "r1", nome: "Gestor" },
          usuario: { nome: "Alice Papel", ativo: true },
          _links: { update: { href: "/admin/user-sectors/v1", method: "PATCH" } },
        },
      ])),
      "PATCH /admin/user-sectors/v1": () => json({}, 409),
    });
    render(<SetoresPage />);
    const select = await screen.findByRole("combobox");
    await waitFor(() => expect(select).toBeEnabled());
    fireEvent.change(select, { target: { value: "r2" } });
    await waitFor(() => expect(errorToast).toHaveBeenCalledWith("Falha ao alterar papel (409)"));
    expect((select as HTMLSelectElement).value).toBe("r1");
  });
});
