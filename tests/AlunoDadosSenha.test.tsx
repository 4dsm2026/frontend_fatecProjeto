import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn(), info: vi.fn() },
}));
vi.mock("../utils/auth", () => ({ logoutAndRedirect: vi.fn() }));
vi.mock("../utils/current-user", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ id: "u1", nome: "Ana Souza", emailPessoal: "ana@example.com" }),
}));
vi.mock("../app/(dashboard)/aluno/_components/MobileSidebarTriggerAluno", () => ({ default: () => null }));

import { toast } from "sonner";
import { logoutAndRedirect } from "../utils/auth";
import MeusDadosPage from "../app/(dashboard)/aluno/dados/page";
import { stubApi } from "./helpers-api";

const SENHA_ATUAL = "Atual123!";
const SENHA_NOVA = "NovaSenha1!";
const problemHeaders = { "Content-Type": "application/problem+json" };

function respond(status: number, body: unknown) {
  const init = { status, headers: body === null ? undefined : problemHeaders };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(body === null ? null : JSON.stringify(body), init)),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem("accessToken", "acc");
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** As labels do formulário não têm htmlFor: os 3 campos de senha são achados pelo placeholder, nesta ordem. */
async function preencherESubmeter() {
  render(<MeusDadosPage />);
  const campos = await screen.findAllByPlaceholderText("••••••••");
  expect(campos).toHaveLength(3);
  await userEvent.type(campos[0], SENHA_ATUAL);
  await userEvent.type(campos[1], SENHA_NOVA);
  await userEvent.type(campos[2], SENHA_NOVA);
  await userEvent.click(screen.getByRole("button", { name: /alterar senha/i }));
}

describe("aluno/dados — trocar senha via PUT /users/me/password", () => {
  it("envia PUT /users/me/password com senhaAtual e novaSenha", async () => {
    const api = stubApi({ "PUT /users/me/password": () => new Response(null, { status: 204 }) });

    await preencherESubmeter();

    await waitFor(() => expect(api.keys()).toEqual(["PUT /users/me/password"]));
    const init = api.fetchMock.mock.calls[0][1];
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({ senhaAtual: SENHA_ATUAL, novaSenha: SENHA_NOVA });
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
  });

  it("204: avisa, limpa os campos e encerra a sessão local depois de 4 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    respond(204, null);

    await preencherESubmeter();
    await waitFor(() => expect(toast.success).toHaveBeenCalled());

    expect(logoutAndRedirect).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    expect(logoutAndRedirect).toHaveBeenCalledTimes(1);
    for (const campo of screen.getAllByPlaceholderText("••••••••")) {
      expect(campo).toHaveValue("");
    }
  });

  it("422 senha atual incorreta: mostra o detail do problem+json (não o código HTTP)", async () => {
    const detail = "A senha atual informada não confere com a senha cadastrada.";
    respond(422, { type: "/errors/unprocessable", title: "Senha atual incorreta", status: 422, detail });

    await preencherESubmeter();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Falha ao alterar senha", { description: detail }),
    );
    expect(logoutAndRedirect).not.toHaveBeenCalled();
  });

  it("422 sem detail: usa o title", async () => {
    respond(422, { title: "Senha atual incorreta", status: 422 });

    await preencherESubmeter();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Falha ao alterar senha", { description: "Senha atual incorreta" }),
    );
  });

  it("400 de validação: mostra campo e mensagem", async () => {
    respond(400, {
      title: "Dados inválidos",
      status: 400,
      errors: [{ field: "novaSenha", message: "A senha deve ter símbolo" }],
    });

    await preencherESubmeter();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Falha ao alterar senha", {
        description: "novaSenha: A senha deve ter símbolo",
      }),
    );
  });

  it("corpo vazio ou não-JSON: cai na mensagem com o código HTTP", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));

    await preencherESubmeter();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Falha ao alterar senha", {
        description: "Erro 500 ao alterar senha",
      }),
    );
  });
});
