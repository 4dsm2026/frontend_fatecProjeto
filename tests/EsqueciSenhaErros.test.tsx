import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn(), info: vi.fn() },
}));

import { toast } from "sonner";
import ForgotPasswordPage from "../app/(public)/esqueci-senha/page";

function respond(status: number, body: string) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function enviar() {
  render(<ForgotPasswordPage />);
  await userEvent.type(screen.getByLabelText("E-mail"), "joao@example.com");
  await userEvent.click(screen.getByRole("button", { name: /enviar/i }));
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("esqueci-senha — mensagem de erro mostrada ao usuário", () => {
  it("mostra a mensagem do backend, e não o JSON cru", async () => {
    respond(429, JSON.stringify({ error: "Muitas tentativas. Tente novamente em instantes." }));

    await enviar();

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith("Não foi possível enviar o link de redefinição.", {
      description: "Muitas tentativas. Tente novamente em instantes.",
    });
  });

  it("erro de validação do backend vira 'campo: mensagem'", async () => {
    respond(400, JSON.stringify({ message: "Validação falhou", issues: [{ path: "email", message: "E-mail inválido" }] }));

    await enviar();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith(expect.any(String), { description: "email: E-mail inválido" });
  });

  it("resposta que não é JSON aparece como texto", async () => {
    respond(502, "Bad Gateway");

    await enviar();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith(expect.any(String), { description: "Bad Gateway" });
  });

  it("erro no formato problem+json: mostra o detail do backend", async () => {
    respond(429, JSON.stringify({ title: "Too Many Requests", status: 429, detail: "Muitas tentativas. Tente em 1 minuto." }));

    await enviar();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith(expect.any(String), { description: "Muitas tentativas. Tente em 1 minuto." });
  });

  it("400 do problem+json: mostra campo e mensagem de errors[]", async () => {
    respond(400, JSON.stringify({ title: "Dados inválidos", status: 400, errors: [{ field: "email", message: "E-mail inválido" }] }));

    await enviar();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith(expect.any(String), { description: "email: E-mail inválido" });
  });

  it("envia POST /password-resets com o e-mail no corpo", async () => {
    const fetchMock = respond(202, JSON.stringify({ message: "ok" }));

    await enviar();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url).endsWith("/password-resets")).toBe(true);
    expect(String(url)).not.toContain("/auth/esqueci-senha");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ email: "joao@example.com" });
  });

  it("sucesso (202) mostra a confirmação e nenhum erro", async () => {
    respond(202, JSON.stringify({ message: "ok" }));

    await enviar();

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
