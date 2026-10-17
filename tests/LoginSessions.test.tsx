import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const search = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search.value) }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn(), info: vi.fn() },
}));
vi.mock("../utils/session", () => ({ storeSession: vi.fn() }));

import { toast } from "sonner";
import { storeSession } from "../utils/session";
import LoginContent from "../app/(public)/login/LoginContent";

const LOGIN_URL = "http://localhost/login";
const problemHeaders = { "Content-Type": "application/problem+json" };

beforeEach(() => {
  vi.clearAllMocks();
  search.value = "";
  vi.stubGlobal("location", { href: LOGIN_URL, origin: "http://localhost" });
});

afterEach(() => vi.unstubAllGlobals());

function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(text, { status, headers }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function entrar(identifier = "joao@example.com") {
  render(<LoginContent />);
  fireEvent.change(document.getElementById("identifier") as HTMLInputElement, {
    target: { value: identifier },
  });
  await userEvent.type(screen.getByLabelText(/^senha$/i), "Test@1234");
  await userEvent.click(screen.getByRole("button", { name: /entrar/i }));
}

async function expectFailure(description: string): Promise<void> {
  await screen.findByText(description);
  expect(toast.error).toHaveBeenCalledWith("Falha no login", { description });
  expect(storeSession).not.toHaveBeenCalled();
  expect(window.location.href).toBe(LOGIN_URL);
}

describe("login via POST /sessions", () => {
  it("envia POST /sessions com credenciais e inclui cookies", async () => {
    const fetchMock = respond(401, { title: "Credenciais inválidas", status: 401 }, problemHeaders);

    await entrar();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error("Fetch não foi chamado");
    const [url, init] = call;
    expect(String(url).endsWith("/sessions")).toBe(true);
    expect(String(url)).not.toContain("/auth/login");
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("include");
    expect(init?.body).toBe(
      JSON.stringify({ email: "joao@example.com", password: "Test@1234" }),
    );
    await expectFailure("Credenciais inválidas");
  });

  it("envia o RA no corpo quando o identificador não é e-mail", async () => {
    const fetchMock = respond(401, { title: "Credenciais inválidas", status: 401 }, problemHeaders);

    await entrar("1234567");

    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error("Fetch não foi chamado");
    expect(call[1]?.body).toBe(JSON.stringify({ ra: "1234567", password: "Test@1234" }));
    await expectFailure("Credenciais inválidas");
  });

  it("201 USUARIO armazena tokens e navega para /aluno/home", async () => {
    respond(201, {
      user: { id: "1", nome: "Ana", papel: "USUARIO" },
      accessToken: "a",
      refreshToken: "r",
    });

    await entrar();

    expect(storeSession).toHaveBeenCalledTimes(1);
    expect(storeSession).toHaveBeenCalledWith({ accessToken: "a", refreshToken: "r" });
    expect(toast.success).toHaveBeenCalled();
    expect(window.location.href).toBe("/aluno/home");
  });

  it("201 TECNICO navega para /admin", async () => {
    respond(201, {
      user: { id: "2", nome: "Téo", papel: "TECNICO" },
      accessToken: "a",
      refreshToken: "r",
    });

    await entrar();

    expect(window.location.href).toBe("/admin");
    expect(storeSession).toHaveBeenCalledWith({ accessToken: "a", refreshToken: "r" });
  });

  it("201 ADMINISTRADOR navega para /admin/home", async () => {
    respond(201, {
      user: { id: "3", nome: "Ada", papel: "ADMINISTRADOR" },
      accessToken: "a",
      refreshToken: "r",
    });

    await entrar();

    expect(window.location.href).toBe("/admin/home");
  });

  it("201 respeita o parâmetro redirect validado", async () => {
    search.value = "redirect=%2Faluno%2Fchamados";
    respond(201, {
      user: { id: "1", nome: "Ana", papel: "USUARIO" },
      accessToken: "a",
      refreshToken: "r",
    });

    await entrar();

    expect(window.location.href).toBe("/aluno/chamados");
  });

  it("401 com detail mostra o detalhe do backend", async () => {
    const detail = "Credenciais inválidas. 2 tentativa(s) restante(s) antes do bloqueio.";
    respond(
      401,
      {
        type: "/errors/unauthorized",
        title: "Credenciais inválidas",
        status: 401,
        detail,
        attemptsLeft: 2,
      },
      problemHeaders,
    );

    await entrar();

    await expectFailure(detail);
  });

  it("401 sem detail usa o título do problem", async () => {
    respond(
      401,
      { type: "/errors/unauthorized", title: "Credenciais inválidas", status: 401 },
      problemHeaders,
    );

    await entrar();

    await expectFailure("Credenciais inválidas");
  });

  it("401 com corpo vazio usa o fallback de credenciais inválidas", async () => {
    respond(401, "");

    await entrar();

    await expectFailure("Credenciais inválidas");
  });

  it("429 conta bloqueada exibe o detalhe fornecido pelo backend", async () => {
    const detail = "Muitas tentativas de login. Tente novamente em 15 minutos.";
    respond(
      429,
      {
        type: "/errors/account-locked",
        title: "Conta bloqueada",
        status: 429,
        detail,
        retryAfter: 900,
      },
      { ...problemHeaders, "Retry-After": "900" },
    );

    await entrar();

    await expectFailure(detail);
  });

  it("403 usuário inativo exibe o título sem navegar", async () => {
    respond(403, { title: "Usuário inativo", status: 403 }, problemHeaders);

    await entrar();

    await expectFailure("Usuário inativo");
  });

  it("403 primeiro acesso segue o token extraído do link activate", async () => {
    respond(
      403,
      {
        type: "/errors/password-change-required",
        title: "Troca de senha obrigatória",
        status: 403,
        detail: "É necessário definir uma nova senha no primeiro acesso.",
        _links: { activate: { href: "/account-activations/abc123", method: "PUT" } },
      },
      problemHeaders,
    );

    await entrar();

    expect(window.location.href).toBe("/primeiro-acesso?token=abc123");
    expect(toast.message).toHaveBeenCalledWith("Primeiro acesso", {
      description: "Você precisa criar uma nova senha antes de continuar.",
    });
    expect(toast.error).not.toHaveBeenCalled();
    expect(storeSession).not.toHaveBeenCalled();
  });

  it("403 primeiro acesso recodifica o token na URL do primeiro acesso", async () => {
    respond(
      403,
      {
        type: "/errors/password-change-required",
        title: "Troca de senha obrigatória",
        status: 403,
        _links: { activate: { href: "/account-activations/a%26b", method: "PUT" } },
      },
      problemHeaders,
    );

    await entrar();

    // "&" decodificado precisa voltar como %26, senão o token seria cortado em "a"
    expect(window.location.href).toBe("/primeiro-acesso?token=a%26b");
  });

  it("403 primeiro acesso sem activate mostra erro e não navega", async () => {
    const description = "Não foi possível iniciar o primeiro acesso. Tente novamente.";
    respond(
      403,
      {
        type: "/errors/password-change-required",
        title: "Troca de senha obrigatória",
        status: 403,
        detail: "É necessário definir uma nova senha no primeiro acesso.",
      },
      problemHeaders,
    );

    await entrar();

    await expectFailure(description);
  });

  it("400 validação mostra campo e mensagem", async () => {
    respond(
      400,
      {
        title: "Dados inválidos",
        status: 400,
        errors: [{ field: "password", message: "Senha obrigatória" }],
      },
      problemHeaders,
    );

    await entrar();

    await expectFailure("password: Senha obrigatória");
  });

  it("500 com corpo não-JSON mostra o texto cru", async () => {
    respond(500, "Bad Gateway");

    await entrar();

    await expectFailure("Bad Gateway");
  });

  it("falha de rede mostra a mensagem e não navega", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch")));

    await entrar();

    await expectFailure("Failed to fetch");
  });

  it("não interpreta o contrato legado 428 como primeiro acesso", async () => {
    respond(428, { token: "xyz", user: { id: "1" } }, problemHeaders);

    await entrar();

    await expectFailure("Erro no servidor");
  });
});
