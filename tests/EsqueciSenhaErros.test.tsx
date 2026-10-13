import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn(), info: vi.fn() },
}));

import { toast } from "sonner";
import ForgotPasswordPage from "../app/(public)/esqueci-senha/page";

function respond(status: number, body: string) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status })));
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

  it("sucesso mostra a confirmação e nenhum erro", async () => {
    respond(200, JSON.stringify({ message: "ok" }));

    await enviar();

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
