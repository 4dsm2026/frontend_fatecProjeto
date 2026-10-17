import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { resetEntryCache } from "../utils/entry";
import { storeSession } from "../utils/session";
import { entryWith, json, stubApi } from "./helpers-api";
import FuncionarioDetalhePage from "../app/(dashboard)/admin/funcionarios/[id]/page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "staff-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));

const adminEntry = entryWith({
  users: { href: "/users", method: "GET" },
  sectors: { href: "/admin/sectors", method: "GET" },
  roles: { href: "/admin/roles", method: "GET" },
});

const user = {
  id: "staff-1",
  nome: "Técnico de teste",
  emailPessoal: "staff@example.test",
  emailEducacional: null,
  papel: "TECNICO",
  ativo: true,
  criadoEm: "2026-10-01T00:00:00.000Z",
  atualizadoEm: "2026-10-02T00:00:00.000Z",
  _links: {
    self: { href: "/users/staff-1", method: "GET" },
    sectors: { href: "/admin/users/staff-1/sectors", method: "GET" },
    update: { href: "/users/staff-1", method: "PATCH" },
  },
};

const assignedSector = {
  id: "assignment-1",
  usuarioId: "staff-1",
  setorId: "sector-1",
  papelId: "role-1",
  setor: { id: "sector-1", nome: "Tecnologia" },
  papel: { id: "role-1", nome: "Agente" },
  _links: {
    self: { href: "/admin/user-sectors/assignment-1", method: "GET" },
    update: { href: "/admin/user-sectors/assignment-1", method: "PATCH" },
    delete: { href: "/admin/user-sectors/assignment-1", method: "DELETE" },
  },
};

const userSectors = {
  _embedded: { sectors: [assignedSector] },
  page: { size: 20, number: 0, totalElements: 1, totalPages: 1 },
  _links: { self: { href: "/admin/users/staff-1/sectors", method: "GET" } },
};

const availableSectors = {
  _embedded: { sectors: [
    { id: "sector-1", nome: "Tecnologia" },
    { id: "sector-2", nome: "Secretaria" },
  ] },
  page: { size: 20, number: 0, totalElements: 2, totalPages: 1 },
  _links: { self: { href: "/admin/sectors", method: "GET" } },
};

const availableRoles = {
  _embedded: { roles: [
    { id: "role-1", nome: "Agente" },
    { id: "role-2", nome: "Coordenador" },
  ] },
  page: { size: 20, number: 0, totalElements: 2, totalPages: 1 },
  _links: { self: { href: "/admin/roles", method: "GET" } },
};

beforeEach(() => {
  localStorage.clear();
  resetEntryCache();
  storeSession({ accessToken: "sector-test-token" });
});

afterEach(() => {
  cleanup();
});

describe("employee sector assignment HAL flow", () => {
  it("follows entry and user links, then uses assignment update/delete links and the create URI convention", async () => {
    const createdAssignment = {
      ...assignedSector,
      id: "assignment-2",
      setorId: "sector-2",
      papelId: null,
      setor: { id: "sector-2", nome: "Secretaria" },
      papel: null,
      _links: {
        self: { href: "/admin/user-sectors/assignment-2", method: "GET" },
        update: { href: "/admin/user-sectors/assignment-2", method: "PATCH" },
        delete: { href: "/admin/user-sectors/assignment-2", method: "DELETE" },
      },
    };
    const updatedAssignment = {
      ...assignedSector,
      papelId: "role-2",
      papel: { id: "role-2", nome: "Coordenador" },
    };
    const api = stubApi({
      "GET /api": () => json(adminEntry),
      "GET /users/staff-1": () => json(user),
      "GET /admin/users/staff-1/sectors": () => json(userSectors),
      "GET /admin/sectors": () => json(availableSectors),
      "GET /admin/roles": () => json(availableRoles),
      "POST /admin/users/staff-1/sectors": () => json(createdAssignment, 201),
      "PATCH /admin/user-sectors/assignment-1": () => json(updatedAssignment),
      "DELETE /admin/user-sectors/assignment-1": () => new Response(null, { status: 204 }),
    });

    render(<FuncionarioDetalhePage />);

    expect(await screen.findByText("Tecnologia")).toBeInTheDocument();
    expect(api.keys()).toEqual(expect.arrayContaining([
      "GET /api",
      "GET /users/staff-1",
      "GET /admin/users/staff-1/sectors",
      "GET /admin/sectors",
      "GET /admin/roles",
    ]));

    fireEvent.change(screen.getByLabelText("Papel para Tecnologia"), { target: { value: "role-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Alterar papel" }));
    await waitFor(() => expect(api.calls).toContainEqual({ key: "PATCH /admin/user-sectors/assignment-1", auth: "Bearer sector-test-token" }));
    expect(JSON.parse(String(api.fetchMock.mock.calls.find(([input, init]) =>
      new URL(String(input), "http://localhost").pathname === "/admin/user-sectors/assignment-1" && init?.method === "PATCH",
    )?.[1]?.body)).papelId).toBe("role-2");

    fireEvent.click(screen.getByRole("button", { name: "Adicionar a setor" }));
    fireEvent.change(screen.getByLabelText("Setor"), { target: { value: "sector-2" } });
    fireEvent.change(screen.getByLabelText("Papel no setor (opcional)"), { target: { value: "role-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    await screen.findByText("Secretaria");
    expect(api.calls).toContainEqual({ key: "POST /admin/users/staff-1/sectors", auth: "Bearer sector-test-token" });

    fireEvent.click(screen.getByRole("button", { name: "Remover Tecnologia" }));
    await waitFor(() => expect(api.calls).toContainEqual({ key: "DELETE /admin/user-sectors/assignment-1", auth: "Bearer sector-test-token" }));
  });
});