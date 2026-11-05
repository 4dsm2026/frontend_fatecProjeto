import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetEntryCache } from "../utils/entry";
import { storeSession } from "../utils/session";
import { entryWith, json, stubApi } from "./helpers-api";
import { isEmailAddress } from "../app/(dashboard)/admin/_components/FormAlunoCreate";
import FormAlunoCreate from "../app/(dashboard)/admin/_components/FormAlunoCreate";
import AdminAlunosPage from "../app/(dashboard)/admin/alunos/page";
import PageAlunoDetalhe from "../app/(dashboard)/admin/alunos/[id]/page";
import AdminFuncionariosPage from "../app/(dashboard)/admin/funcionarios/page";
import FuncionarioDetalhePage from "../app/(dashboard)/admin/funcionarios/[id]/page";
import type { HalCollection, HalResource } from "../utils/hal";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "admin-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));

const apiEntry = entryWith({ users: { href: "/users", method: "GET" } });

function userResource(id: string, links: Record<string, { href: string; method?: string }> = {}) {
  return {
    id,
    nome: `Aluno ${id}`,
    emailPessoal: `${id}@example.test`,
    emailEducacional: `${id}@fatec.test`,
    ra: id,
    papel: "USUARIO",
    ativo: true,
    criadoEm: "2026-10-01T00:00:00.000Z",
    _links: { self: { href: `/users/${id}`, method: "GET" }, ...links },
  };
}

function usersCollection(
  page: number,
  userOrUsers: ReturnType<typeof userResource> | ReturnType<typeof userResource>[],
  includeCreate = true,
  totalElements = 21,
) {
  const users = Array.isArray(userOrUsers) ? userOrUsers : [userOrUsers];
  return {
    _embedded: { users },
    page: { size: 20, number: page, totalElements, totalPages: Math.ceil(totalElements / 20) },
    _links: {
      self: { href: `/users?page=${page}&size=20`, method: "GET" },
      first: { href: "/users?page=0&size=20", method: "GET" },
      ...(page > 0 ? { prev: { href: "/users?page=0&size=20", method: "GET" } } : {}),
      ...(page < Math.ceil(totalElements / 20) - 1
        ? { next: { href: `/users?page=${page + 1}&size=20`, method: "GET" } }
        : {}),
      ...(includeCreate ? { create: { href: "/users", method: "POST" } } : {}),
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  resetEntryCache();
  storeSession({ accessToken: "users-test-token" });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("users HAL integration", () => {
  it("requests page zero with size and follows the collection next link", async () => {
    let showNextPage = false;
    const api = stubApi({
      "GET /api": () => json(apiEntry),
      "GET /users": () => json(usersCollection(
        showNextPage ? 1 : 0,
        userResource(showNextPage ? "67890" : "12345", {
          delete: { href: `/users/${showNextPage ? "67890" : "12345"}`, method: "DELETE" },
        }),
      )),
    });

    render(<AdminAlunosPage />);

    expect(await screen.findByText("12345")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cadastrar aluno" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Selecionar aluno RA 12345" })).toBeEnabled();

    const firstUsersRequest = api.fetchMock.mock.calls.find(([input]) =>
      new URL(String(input), "http://localhost").pathname === "/users",
    );
    const firstUrl = new URL(String(firstUsersRequest?.[0]), "http://localhost");
    expect(firstUrl.searchParams.get("page")).toBe("0");
    expect(firstUrl.searchParams.get("size")).toBe("20");
    expect(firstUrl.searchParams.get("papel")).toBe("USUARIO");
    expect(screen.getByText((_, element) =>
      element?.tagName === "DIV" && element.childElementCount === 0 &&
      element.textContent?.includes("Página 1 de 2") === true,
    )).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Buscar por RA, e-mail ou nome"), {
      target: { value: "aluno" },
    });
    await waitFor(() => {
      const userRequests = api.fetchMock.mock.calls.filter(([input]) =>
        new URL(String(input), "http://localhost").pathname === "/users",
      );
      const lastUrl = new URL(String(userRequests.at(-1)?.[0]), "http://localhost");
      expect(lastUrl.searchParams.get("q")).toBe("aluno");
    });

    const nextPageButton = screen.getByRole("button", { name: "Próximo" });
    await waitFor(() => expect(nextPageButton).toBeEnabled());
    showNextPage = true;
    fireEvent.click(nextPageButton);
    expect(await screen.findByText("67890")).toBeInTheDocument();
    expect(screen.getByText((_, element) =>
      element?.tagName === "DIV" && element.childElementCount === 0 &&
      element.textContent?.includes("Página 2 de 2") === true,
    )).toBeInTheDocument();
    expect(api.calls).toContainEqual({ key: "GET /users", auth: "Bearer users-test-token" });
  });

  it("keeps the previous email validation behavior for representative inputs", () => {
    const examples: Array<[string, boolean]> = [
      ["ana@fatec.sp.gov.br", true],
      ["a@b.c", true],
      ["a@b.c.", true],
      ["a@.b.c", true],
      ["a@b..", true],
      ["invalid", false],
      ["ana @fatec.sp.gov.br", false],
      ["a@@b.c", false],
      ["a@b", false],
      ["a@b.", false],
    ];

    for (const [email, expected] of examples) {
      expect(isEmailAddress(email)).toBe(expected);
    }
  });

  it("hides student creation actions when the collection has no create link", async () => {
    stubApi({
      "GET /api": () => json(apiEntry),
      "GET /users": () => json(usersCollection(0, userResource("12345"), false)),
    });

    render(<AdminAlunosPage />);

    expect(await screen.findByText("12345")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cadastrar aluno" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Importar planilha" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Selecionar aluno RA 12345" })).toBeDisabled();
  });

  it("sends student papel/status filters to the server and uses HAL page totals", async () => {
    const student = userResource("student-1");
    let requestCount = 0;
    const api = stubApi({
      "GET /api": () => json(apiEntry),
      "GET /users": () => {
        requestCount += 1;
        return requestCount === 1
          ? json(usersCollection(0, student, false, 1))
          : json(usersCollection(0, [], false, 0));
      },
    });

    render(<AdminAlunosPage />);

    expect(await screen.findByText("student-1")).toBeInTheDocument();
    const initialUserRequest = api.fetchMock.mock.calls.find(([input]) =>
      new URL(String(input), "http://localhost").pathname === "/users",
    );
    const initialUrl = new URL(String(initialUserRequest?.[0]), "http://localhost");
    expect(initialUrl.searchParams.get("papel")).toBe("USUARIO");
    expect(initialUrl.searchParams.has("ativo")).toBe(false);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "INATIVO" } });
    expect(await screen.findByText("Nenhum aluno encontrado com os filtros atuais.")).toBeInTheDocument();
    const userRequests = api.fetchMock.mock.calls.filter(([input]) =>
      new URL(String(input), "http://localhost").pathname === "/users",
    );
    const activeFilterUrl = new URL(String(userRequests.at(-1)?.[0]), "http://localhost");
    expect(activeFilterUrl.searchParams.get("papel")).toBe("USUARIO");
    expect(activeFilterUrl.searchParams.get("ativo")).toBe("false");
    expect(screen.getByText((_, element) =>
      element?.tagName === "DIV" && element.childElementCount === 0 &&
      element.textContent?.includes("Mostrando 0") === true,
    )).toBeInTheDocument();
  });

  it("filters employee papel/status locally while the footer reports all users", async () => {
    const staff = { ...userResource("staff-1"), papel: "TECNICO" };
    const student = userResource("student-1");
    const api = stubApi({
      "GET /api": () => json(apiEntry),
      "GET /users": () => json(usersCollection(0, [staff, student], false, 2)),
    });

    render(<AdminFuncionariosPage />);

    expect(await screen.findByText("Aluno staff-1")).toBeInTheDocument();
    expect(screen.queryByText("student-1")).not.toBeInTheDocument();
    const summary = () => screen.getByText((_, element) =>
      element?.tagName === "DIV" && element.childElementCount === 0 &&
      element.textContent?.includes("Mostrando 1-2 de 2") === true,
    );
    expect(summary()).toBeInTheDocument();

    const beforeRoleChange = api.fetchMock.mock.calls.length;
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "BACKOFFICE" } });
    expect(await screen.findByText("Nenhum funcionário encontrado com os filtros atuais.")).toBeInTheDocument();
    expect(summary()).toBeInTheDocument();
    expect(api.fetchMock).toHaveBeenCalledTimes(beforeRoleChange);

    fireEvent.change(screen.getByPlaceholderText("Buscar por e-mail, nome, setor…"), {
      target: { value: "staff" },
    });
    await waitFor(() => {
      const requests = api.fetchMock.mock.calls.filter(([input]) =>
        new URL(String(input), "http://localhost").pathname === "/users",
      );
      const qUrl = new URL(String(requests.at(-1)?.[0]), "http://localhost");
      expect(qUrl.searchParams.get("q")).toBe("staff");
    });

    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "INATIVO" } });
    await waitFor(() => {
      const requests = api.fetchMock.mock.calls.filter(([input]) =>
        new URL(String(input), "http://localhost").pathname === "/users",
      );
      const statusUrl = new URL(String(requests.at(-1)?.[0]), "http://localhost");
      expect(statusUrl.searchParams.get("ativo")).toBe("false");
      expect(statusUrl.searchParams.has("papel")).toBe(false);
    });
  });

  it("does not show delete for an administrator when that resource omits delete", async () => {
    const admin = {
      ...userResource("admin-1", {
        update: { href: "/users/admin-1", method: "PATCH" },
        collection: { href: "/users", method: "GET" },
        sectors: { href: "/admin/users/admin-1/sectors", method: "GET" },
      }),
      nome: "Admin de teste",
      papel: "ADMINISTRADOR",
    };
    stubApi({
      "GET /api": () => json(apiEntry),
      "GET /users/admin-1": () => json(admin),
      "GET /admin/users/admin-1/sectors": () => json({
        _embedded: { sectors: [] },
        page: { size: 20, number: 0, totalElements: 0, totalPages: 0 },
        _links: { self: { href: "/admin/users/admin-1/sectors", method: "GET" } },
      }),
      "GET /admin/sectors": () => json({
        _embedded: { sectors: [] },
        page: { size: 20, number: 0, totalElements: 0, totalPages: 0 },
        _links: { self: { href: "/admin/sectors", method: "GET" } },
      }),
    });

    render(<FuncionarioDetalhePage />);

    expect(await screen.findAllByText("Admin de teste")).not.toHaveLength(0);
    expect(screen.getByRole("link", { name: "Editar" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /^Excluir$/ })).not.toBeInTheDocument();
    });
  });

  it("does not render student details for a resource whose role is not USUARIO", async () => {
    const admin = { ...userResource("admin-1"), papel: "ADMINISTRADOR" };
    const api = stubApi({
      "GET /api": () => json(apiEntry),
      "GET /users/admin-1": () => json(admin),
    });

    render(<PageAlunoDetalhe />);

    expect(await screen.findByText("Este cadastro não é de aluno")).toBeInTheDocument();
    expect(api.calls.some((call) => call.key === "GET /tickets")).toBe(false);
  });

  it("creates through the collection create link and uses the returned HAL resource", async () => {
    const created = {
      id: "created-1",
      nome: "Usuário criado via HAL",
      _links: { self: { href: "/users/created-1", method: "GET" } },
    };
    const collection: HalCollection<HalResource & { id: string; nome?: string | null }> = {
      _links: { create: { href: "/users", method: "POST" } },
    };
    const api = stubApi({
      "POST /users": () => new Response(JSON.stringify(created), {
        status: 201,
        headers: { "Content-Type": "application/json", Location: "/users/created-1" },
      }),
    });
    const onSuccess = vi.fn();

    render(<FormAlunoCreate collection={collection} onSuccess={onSuccess} />);
    fireEvent.change(screen.getByLabelText(/RA/), { target: { value: "123456" } });
    fireEvent.change(screen.getByLabelText(/E-mail educacional/), {
      target: { value: "ana@fatec.test" },
    });
    fireEvent.submit(screen.getByLabelText(/RA/).closest("form")!);

    expect(await screen.findByText("Aluno cadastrado com sucesso!")).toBeInTheDocument();
    expect(screen.getByText("Usuário criado via HAL")).toBeInTheDocument();
    expect(api.calls[0].key).toBe("POST /users");
    fireEvent.click(screen.getByRole("button", { name: "Concluído" }));
    expect(onSuccess).toHaveBeenCalledWith(created);
  });
});