import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmDialog from "../app/components/ui/ConfirmDialog";

const showModalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) { this.setAttribute("open", ""); },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) { this.removeAttribute("open"); },
  });
});

afterEach(() => {
  if (showModalDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "showModal", showModalDescriptor);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (closeDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "close", closeDescriptor);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

describe("ConfirmDialog", () => {
  it("mantém o dialog fechado quando open=false", () => {
    const { container } = render(
      <ConfirmDialog open={false} title="X" onConfirm={() => {}} onClose={() => {}} />,
    );
    expect(container.querySelector("dialog")).toBeInTheDocument();
    expect(container.querySelector("dialog")).not.toHaveAttribute("open");
  });

  it("sincroniza a entrada do modo prompt sem resetar por nova identidade do objeto", async () => {
    const { rerender } = render(
      <ConfirmDialog open title="Prompt" onConfirm={() => {}} onClose={() => {}} />,
    );

    rerender(
      <ConfirmDialog
        open
        title="Prompt"
        input={{ label: "Nome", defaultValue: "Inicial" }}
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );
    const input = screen.getByRole("textbox");
    await vi.waitFor(() => expect(input).toHaveValue("Inicial"));
    await vi.waitFor(() => expect(input).toHaveFocus());

    await userEvent.clear(input);
    await userEvent.type(input, "Digitado");
    rerender(
      <ConfirmDialog
        open
        title="Prompt"
        input={{ label: "Nome atualizado", defaultValue: "Inicial" }}
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );
    expect(input).toHaveValue("Digitado");

    rerender(
      <ConfirmDialog
        open
        title="Prompt"
        input={{ label: "Nome atualizado", defaultValue: "Novo padrão" }}
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );
    expect(input).toHaveValue("Novo padrão");
  });

  it("mostra título/descrição e dispara onConfirm ao confirmar", async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Remover setor?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Remover"
        variant="danger"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("Remover setor?")).toBeInTheDocument();
    expect(screen.getByText("Esta ação não pode ser desfeita.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remover" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Sucesso fecha o modal.
    expect(onClose).toHaveBeenCalled();
  });

  it("no modo prompt, passa o valor digitado ao onConfirm", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Novo setor"
        confirmLabel="Criar"
        input={{ label: "Nome", required: true }}
        onConfirm={onConfirm}
        onClose={() => {}}
      />,
    );
    // Botão desabilitado enquanto vazio (required).
    const criar = screen.getByRole("button", { name: "Criar" });
    expect(criar).toBeDisabled();

    await userEvent.type(screen.getByRole("textbox"), "Secretaria");
    expect(criar).toBeEnabled();
    await userEvent.click(criar);
    expect(onConfirm).toHaveBeenCalledWith("Secretaria");
  });

  it("cancelar chama onClose sem confirmar", async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ConfirmDialog open title="X" onConfirm={onConfirm} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
