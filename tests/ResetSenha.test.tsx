import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const search = vi.hoisted(() => ({ value: "token=abc123" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search.value) }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn(), info: vi.fn() },
}));
vi.mock("../utils/session", () => ({ storeSession: vi.fn() }));

import { toast } from "sonner";
import { storeSession } from "../utils/session";
import ResetPasswordContent from "../app/(public)/reset-senha/ResetPasswordContent";

const SENHA = "NovaSenha1#";
const problemHeaders = { "Content-Type": "application/problem+json" };
const LOGIN_URL = "http://localhost/reset-senha";

function respond(status: number, body: unknown = null) {
  const texto = typeof body === "string" ? body : JSON.stringify(body);
  const init = { status, headers: typeof body === "object" && body !== null ? problemHeaders : undefined };
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(body === null ? null : texto, init));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function redefinir(senha = SENHA, confirmacao = senha) {
  render(<ResetPasswordContent />);
  await userEvent.type(screen.getByLabelText("Nova senha"), senha);
  await userEvent.type(screen.getByLabelText("Confirmar nova senha"), confirmacao);
  await userEvent.click(screen.getByRole("button", { name: /redefinir senha/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  search.value = "token=abc123";
  vi.stubGlobal("location", { href: LOGIN_URL, origin: "http://localhost" });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("reset-senha — PUT /password-resets/:token", () => {
  it("envia PUT com o token no CAMINHO e só novaSenha no corpo, sem cookies", async () => {
    const fetchMock = respond(204);

    await redefinir();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url).endsWith("/password-resets/abc123")).toBe(true);
    expect(String(url)).not.toContain("/auth/reset-senha");
    expect(init?.method).toBe("PUT");
    expect(init?.credentials).toBeUndefined();
    expect(JSON.parse(String(init?.body))).toEqual({ novaSenha: SENHA });
  });

  it("codifica o token no caminho (nada escapa do segmento)", async () => {
    search.value = `token=${encodeURIComponent("a/b?c#d")}`;
    const fetchMock = respond(204);

    await redefinir();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0][0]).endsWith("/password-resets/a%2Fb%3Fc%23d")).toBe(true);
  });

  it("204: avisa, NÃO cria sessão e manda para /login depois de um instante", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    respond(204);

    await redefinir();
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));

    expect(storeSession).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(window.location.href).toBe(LOGIN_URL);
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(window.location.href).toBe("/login");
  });

  it("depois do sucesso o botão fica desabilitado (não dá para reenviar e gastar o token)", async () => {
    respond(204);

    await redefinir();
    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    expect(screen.getByRole("button", { name: /redefinir senha/i })).toBeDisabled();
  });

  it("404: pede um novo link, sem mostrar o JSON nem o código", async () => {
    respond(404, { type: "/errors/not-found", title: "Token inválido ou expirado", status: 404 });

    await redefinir();

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith("Não foi possível redefinir a senha.", {
      description: expect.stringContaining("inválido ou expirou"),
    });
    expect(window.location.href).toBe(LOGIN_URL);
  });

  it("409: avisa que o link já foi usado", async () => {
    respond(409, { type: "/errors/conflict", title: "Token já utilizado", status: 409 });

    await redefinir();

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith("Não foi possível redefinir a senha.", {
      description: expect.stringContaining("já foi utilizado"),
    });
  });

  it("400 de validação do backend: mostra campo e mensagem", async () => {
    respond(400, {
      title: "Dados inválidos",
      status: 400,
      errors: [{ field: "novaSenha", message: "A senha deve ter símbolo" }],
    });

    await redefinir();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível redefinir a senha.", {
        description: "novaSenha: A senha deve ter símbolo",
      }),
    );
  });

  it("500 com corpo não-JSON: mostra o texto cru", async () => {
    respond(500, "Bad Gateway");

    await redefinir();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível redefinir a senha.", { description: "Bad Gateway" }),
    );
  });

  it("falha de rede: mostra a mensagem e não navega", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await redefinir();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível redefinir a senha.", { description: "Failed to fetch" }),
    );
    expect(window.location.href).toBe(LOGIN_URL);
  });

  it("senhas diferentes: nem chama o backend", async () => {
    const fetchMock = respond(204);

    render(<ResetPasswordContent />);
    await userEvent.type(screen.getByLabelText("Nova senha"), SENHA);
    await userEvent.type(screen.getByLabelText("Confirmar nova senha"), "Outra1234#x");

    expect(screen.getByRole("button", { name: /redefinir senha/i })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sem token na URL: o botão fica desabilitado e nada é enviado", async () => {
    search.value = "";
    const fetchMock = respond(204);

    render(<ResetPasswordContent />);
    await userEvent.type(screen.getByLabelText("Nova senha"), SENHA);
    await userEvent.type(screen.getByLabelText("Confirmar nova senha"), SENHA);

    expect(screen.getByRole("button", { name: /redefinir senha/i })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
