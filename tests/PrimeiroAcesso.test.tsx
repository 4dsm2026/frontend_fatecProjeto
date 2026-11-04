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
import PrimeiroAcessoContent from "../app/(public)/primeiro-acesso/PrimeiroAcessoContent";

const SENHA = "NovaSenha1#";
const EMAIL = "novo@example.com";
const PAGINA = "http://localhost/primeiro-acesso";
const problemHeaders = { "Content-Type": "application/problem+json" };

function respond(status: number, body: unknown = null) {
  const texto = typeof body === "string" ? body : JSON.stringify(body);
  const init = { status, headers: typeof body === "object" && body !== null ? problemHeaders : undefined };
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(body === null ? null : texto, init));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function preencher(email?: string) {
  const ui = render(<PrimeiroAcessoContent />);
  if (email) await userEvent.type(screen.getByLabelText(/e-mail pessoal/i), email);
  await userEvent.type(screen.getByLabelText("Nova senha"), SENHA);
  await userEvent.type(screen.getByLabelText("Confirmar nova senha"), SENHA);
  return ui;
}

async function concluir(email?: string) {
  const ui = await preencher(email);
  await userEvent.click(screen.getByRole("button", { name: /concluir primeiro acesso/i }));
  return ui;
}

beforeEach(() => {
  vi.clearAllMocks();
  search.value = "token=abc123";
  // Timers falsos em todos os testes: um redirecionamento agendado não pode vazar para o teste seguinte.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal("location", { href: PAGINA, origin: "http://localhost" });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("primeiro acesso — PUT /account-activations/:token", () => {
  it("envia PUT com o token no CAMINHO e só novaSenha no corpo (sem e-mail, sem cookies)", async () => {
    const fetchMock = respond(204);

    await concluir();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url).endsWith("/account-activations/abc123")).toBe(true);
    expect(String(url)).not.toContain("/auth/primeiro-acesso");
    expect(init?.method).toBe("PUT");
    expect(init?.credentials).toBeUndefined();
    expect(JSON.parse(String(init?.body))).toEqual({ novaSenha: SENHA });
  });

  it("com e-mail pessoal: envia emailPessoal (português, igual ao resto da API)", async () => {
    const fetchMock = respond(204);

    await concluir(EMAIL);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ novaSenha: SENHA, emailPessoal: EMAIL });
  });

  it("codifica o token no caminho (nada escapa do segmento)", async () => {
    search.value = `token=${encodeURIComponent("a/b?c#d")}`;
    const fetchMock = respond(204);

    await concluir();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0][0]).endsWith("/account-activations/a%2Fb%3Fc%23d")).toBe(true);
  });

  it("204 sem e-mail: avisa, NÃO cria sessão e vai para /login depois de um instante", async () => {
    respond(204);

    await concluir();
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));

    expect(toast.success).toHaveBeenCalledWith("Senha atualizada com sucesso!", {
      description: "Você pode adicionar seu e-mail pessoal depois nas configurações.",
    });
    expect(storeSession).not.toHaveBeenCalled();
    expect(window.location.href).toBe(PAGINA);
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(window.location.href).toBe("/login");
  });

  it("204 com e-mail: a mensagem diz que o e-mail foi vinculado", async () => {
    respond(204);

    await concluir(EMAIL);

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Senha atualizada com sucesso!", {
        description: "Pronto! Seu e-mail pessoal foi vinculado à sua conta.",
      }),
    );
  });

  it("depois do sucesso o botão fica desabilitado (não dá para reenviar e gastar o token)", async () => {
    respond(204);

    await concluir();
    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    expect(screen.getByRole("button", { name: /concluir primeiro acesso/i })).toBeDisabled();
  });

  it("sair da tela antes do redirecionamento o cancela", async () => {
    respond(204);
    const { unmount } = await concluir();
    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    unmount();
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(window.location.href).toBe(PAGINA);
  });

  it("409 de TOKEN já usado: avisa que já concluiu e manda para o login", async () => {
    respond(409, { type: "/errors/conflict", title: "Token já utilizado", status: 409 });

    await concluir();

    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith("Primeiro acesso já concluído. Faça login normalmente."),
    );
    expect(window.location.href).toBe("/login");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("409 de E-MAIL em uso: mostra o erro, NÃO sai da tela e deixa corrigir o e-mail", async () => {
    respond(409, {
      type: "/errors/email-already-in-use",
      title: "Este e-mail pessoal já está em uso",
      status: 409,
    });

    await concluir(EMAIL);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível concluir o primeiro acesso.", {
        description: "Este e-mail pessoal já está em uso",
      }),
    );
    expect(toast.info).not.toHaveBeenCalled();
    expect(window.location.href).toBe(PAGINA);
    expect(screen.getByRole("button", { name: /concluir primeiro acesso/i })).toBeEnabled();
  });

  it("404: o link é inválido/expirou, e diz como obter outro", async () => {
    respond(404, { type: "/errors/not-found", title: "Token inválido ou expirado", status: 404 });

    await concluir();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível concluir o primeiro acesso.", {
        description: expect.stringContaining("Volte ao login"),
      }),
    );
    expect(window.location.href).toBe(PAGINA);
  });

  it("403 usuário inativo: mostra o motivo do servidor", async () => {
    respond(403, { title: "Usuário inativo", status: 403 });

    await concluir();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível concluir o primeiro acesso.", {
        description: "Usuário inativo",
      }),
    );
  });

  it("400 de validação: mostra campo e mensagem", async () => {
    respond(400, {
      title: "Dados inválidos",
      status: 400,
      errors: [{ field: "novaSenha", message: "A senha deve ter símbolo" }],
    });

    await concluir();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível concluir o primeiro acesso.", {
        description: "novaSenha: A senha deve ter símbolo",
      }),
    );
  });

  it("500 com corpo não-JSON: mostra o texto cru", async () => {
    respond(500, "Bad Gateway");

    await concluir();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível concluir o primeiro acesso.", {
        description: "Bad Gateway",
      }),
    );
  });

  it("falha de rede: mostra a mensagem e não navega", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await concluir();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível concluir o primeiro acesso.", {
        description: "Failed to fetch",
      }),
    );
    expect(window.location.href).toBe(PAGINA);
  });

  it("sem token na URL: o botão fica desabilitado e nada é enviado", async () => {
    search.value = "";
    const fetchMock = respond(204);

    await preencher();

    expect(screen.getByRole("button", { name: /concluir primeiro acesso/i })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
