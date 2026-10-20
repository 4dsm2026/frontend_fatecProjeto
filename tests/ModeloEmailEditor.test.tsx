import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ModeloEmailEditor from "../app/(dashboard)/admin/_components/ModeloEmailEditor";

const CORPO_ATUAL = "Olá {{aluno.nome}},<br/><br/>Seja bem-vindo(a).";
const exemplo = (html: string) => html.replaceAll("{{aluno.nome}}", "Maria Souza");

function renderizar(onChange = vi.fn()) {
  render(
    <ModeloEmailEditor
      value={CORPO_ATUAL}
      onChange={onChange}
      variaveis={["aluno.nome", "chamado.protocolo"]}
      aplicarExemplo={exemplo}
    />,
  );
  return onChange;
}

describe("ModeloEmailEditor", () => {
  it("carrega o corpo atual (HTML com <br/>) sem marcar como alterado", async () => {
    const onChange = renderizar();
    const editor = await screen.findByRole("textbox", { name: "Corpo do comunicado" });
    expect(editor).toHaveTextContent("Olá {{aluno.nome}},");
    expect(editor).toHaveTextContent("Seja bem-vindo(a).");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("insere a variável clicada no texto", async () => {
    const onChange = renderizar();
    await screen.findByRole("textbox", { name: "Corpo do comunicado" });
    await userEvent.click(screen.getByRole("button", { name: "{{chamado.protocolo}}" }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.lastCall?.[0]).toContain("{{chamado.protocolo}}");
  });

  it("mostra o corpo com dados de exemplo e volta a editar", async () => {
    renderizar();
    await screen.findByRole("textbox", { name: "Corpo do comunicado" });
    await userEvent.click(screen.getByRole("button", { name: /Ver com dados de exemplo/ }));
    expect(screen.getByLabelText("Corpo com dados de exemplo")).toHaveTextContent("Olá Maria Souza,");
    expect(screen.queryByRole("textbox", { name: "Corpo do comunicado" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Voltar a editar/ }));
    expect(await screen.findByRole("textbox", { name: "Corpo do comunicado" })).toBeInTheDocument();
  });
});
