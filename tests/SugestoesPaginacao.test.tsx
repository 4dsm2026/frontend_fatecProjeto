import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SugestoesPaginacao from "../app/components/shared/SugestoesPaginacao";

afterEach(cleanup);

function ExemploComTresPaginas() {
  const [page, setPage] = useState(1);

  return (
    <SugestoesPaginacao
      page={page}
      totalPages={3}
      onPageChange={setPage}
    />
  );
}

describe("SugestoesPaginacao", () => {
  it("não mostra botões quando há apenas uma página", () => {
    const { container } = render(
      <SugestoesPaginacao
        page={1}
        totalPages={1}
        onPageChange={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("avança e volta, atualizando a página selecionada", async () => {
    const user = userEvent.setup();
    render(<ExemploComTresPaginas />);

    const anterior = screen.getByRole("button", {
      name: "Página anterior",
    });
    const proxima = screen.getByRole("button", {
      name: "Próxima página",
    });

    expect(anterior).toBeDisabled();

    await user.click(proxima);

    expect(
      screen.getByRole("button", { name: "Página 2" }),
    ).toHaveAttribute("aria-current", "page");
    expect(anterior).toBeEnabled();

    await user.click(proxima);

    expect(
      screen.getByRole("button", { name: "Página 3" }),
    ).toHaveAttribute("aria-current", "page");
    expect(proxima).toBeDisabled();

    await user.click(anterior);

    expect(
      screen.getByRole("button", { name: "Página 2" }),
    ).toHaveAttribute("aria-current", "page");
    expect(proxima).toBeEnabled();
  });

  it("permite escolher uma página pelo número", async () => {
    const user = userEvent.setup();
    render(<ExemploComTresPaginas />);

    await user.click(
      screen.getByRole("button", { name: "Página 3" }),
    );

    expect(
      screen.getByRole("button", { name: "Página 3" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("button", { name: "Página 1" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("não solicita páginas fora dos limites pelos botões desabilitados", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    const { rerender } = render(
      <SugestoesPaginacao
        page={1}
        totalPages={3}
        onPageChange={onPageChange}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Página anterior" }),
    );
    expect(onPageChange).not.toHaveBeenCalled();

    rerender(
      <SugestoesPaginacao
        page={3}
        totalPages={3}
        onPageChange={onPageChange}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Próxima página" }),
    );
    expect(onPageChange).not.toHaveBeenCalled();
  });
});