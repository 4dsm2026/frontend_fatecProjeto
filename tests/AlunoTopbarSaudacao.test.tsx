import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AlunoTopbar from "../app/(dashboard)/aluno/_components/AlunoTopbar";
import { resetEntryCache } from "../utils/entry";
import { storeSession } from "../utils/session";
import { stubApi, json, FULL_ENTRY } from "./helpers-api";

const semNotificacoes = () => json({ items: [], total: 0 });

beforeEach(() => {
  localStorage.clear();
  resetEntryCache();
  storeSession({ accessToken: "tok" });
});
afterEach(() => vi.unstubAllGlobals());

const renderTopbar = () => render(<AlunoTopbar pollMs={3_600_000} />);

describe("AlunoTopbar — saudação com o usuário vindo dos links da API", () => {
  it("mostra o primeiro nome do usuário", async () => {
    stubApi({
      "GET /api": () => json(FULL_ENTRY),
      "GET /users/me": () => json({ id: "u-1", nome: "João da Silva" }),
      "GET /notifications": semNotificacoes,
    });

    renderTopbar();

    expect(await screen.findByText("Olá, João 👋")).toBeTruthy();
  });

  it("descobre o usuário por GET /api → GET /users/me, sem chamar /auth/me", async () => {
    const api = stubApi({
      "GET /api": () => json(FULL_ENTRY),
      "GET /users/me": () => json({ id: "u-1", nome: "Maria" }),
      "GET /notifications": semNotificacoes,
    });

    renderTopbar();
    await screen.findByText("Olá, Maria 👋");

    expect(api.keys()).toContain("GET /api");
    expect(api.keys()).toContain("GET /users/me");
    expect(api.keys()).not.toContain("GET /auth/me");
  });

  it("API recusa o usuário (erro): cai na saudação padrão em vez de mostrar dados quebrados", async () => {
    stubApi({
      "GET /api": () => json(FULL_ENTRY),
      "GET /users/me": () => json({ type: "/errors/not-found", title: "Usuário não encontrado", status: 404 }, 404),
      "GET /notifications": semNotificacoes,
    });

    renderTopbar();

    await waitFor(() => expect(screen.getByText("Olá 👋")).toBeTruthy());
    expect(screen.queryByText(/undefined/)).toBeNull();
  });

  it("usuário sem nome: saudação padrão", async () => {
    stubApi({
      "GET /api": () => json(FULL_ENTRY),
      "GET /users/me": () => json({ id: "u-1" }),
      "GET /notifications": semNotificacoes,
    });

    renderTopbar();

    await waitFor(() => expect(screen.getByText("Olá 👋")).toBeTruthy());
  });
});
