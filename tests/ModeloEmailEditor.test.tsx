import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ModeloEmailEditor from "../app/(dashboard)/admin/_components/ModeloEmailEditor";
import ModeloEmailPreview from "../app/(dashboard)/admin/_components/ModeloEmailPreview";

const CORPO_ATUAL = "Olá {{aluno.nome}},<br/><br/>Seja bem-vindo(a).";
const exemplo = (texto: string) => texto.replaceAll("{{aluno.nome}}", "Maria Souza");

function renderizarEditor(onChange = vi.fn()) {
  render(
    <ModeloEmailEditor
      value={CORPO_ATUAL}
      onChange={onChange}
      variaveis={["aluno.nome", "chamado.protocolo"]}
    />,
  );
  return onChange;
}

describe("ModeloEmailEditor", () => {
  it("carrega o corpo atual (HTML com <br/>) sem marcar como alterado", async () => {
    const onChange = renderizarEditor();
    const editor = await screen.findByRole("textbox", { name: "Corpo do comunicado" });
    expect(editor).toHaveTextContent("Olá {{aluno.nome}},");
    expect(editor).toHaveTextContent("Seja bem-vindo(a).");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("insere a variável clicada no texto", async () => {
    const onChange = renderizarEditor();
    await screen.findByRole("textbox", { name: "Corpo do comunicado" });
    await userEvent.click(screen.getByRole("button", { name: "{{chamado.protocolo}}" }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.lastCall?.[0]).toContain("{{chamado.protocolo}}");
  });
});

describe("ModeloEmailPreview", () => {
  it("mostra assunto e corpo com os dados de exemplo", () => {
    render(<ModeloEmailPreview assunto="Bem-vindo, {{aluno.nome}}!" corpo={CORPO_ATUAL} aplicarExemplo={exemplo} />);
    const email = screen.getByRole("article", { name: "Visualização do e-mail" });
    expect(email).toHaveTextContent("Bem-vindo, Maria Souza!");
    expect(email).toHaveTextContent("Olá Maria Souza,");
    expect(email).not.toHaveTextContent("{{aluno.nome}}");
  });

  it("acompanha as mudanças do corpo", () => {
    const { rerender } = render(<ModeloEmailPreview assunto="Aviso" corpo="<p>Primeira versão</p>" aplicarExemplo={exemplo} />);
    rerender(<ModeloEmailPreview assunto="Aviso" corpo="<p><strong>Versão editada</strong></p>" aplicarExemplo={exemplo} />);
    const email = screen.getByRole("article", { name: "Visualização do e-mail" });
    expect(email).toHaveTextContent("Versão editada");
    expect(email.querySelector("strong")).not.toBeNull();
  });
});
