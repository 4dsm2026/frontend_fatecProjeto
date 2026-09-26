import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Pagination from "../app/components/shared/Pagination";

afterEach(cleanup);

function ExemploComTresPaginas() {
  const [page, setPage] = useState(1);

  return (
    <>
      <p>Página atual: {page}</p>
      <Pagination page={page} totalPages={3} onChange={setPage} />
    </>
  );
}

// As setas do componente atual não têm nome acessível.
// A primeira é "anterior" e a última é "próxima".
function obterSetas() {
  const botoes = screen.getAllByRole("button");

  return {
    anterior: botoes[0],
    proxima: botoes[botoes.length - 1],
  };
}

describe("Pagination", () => {
  it("não mostra botões quando há apenas uma página", () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} onChange={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("avança e volta, atualizando a página selecionada", async () => {
    const user = userEvent.setup();
    render(<ExemploComTresPaginas />);

    const { anterior, proxima } = obterSetas();

    expect(anterior).toBeDisabled();

    await user.click(proxima);
    expect(screen.getByText("Página atual: 2")).toBeInTheDocument();
    expect(anterior).toBeEnabled();

    await user.click(proxima);
    expect(screen.getByText("Página atual: 3")).toBeInTheDocument();
    expect(proxima).toBeDisabled();

    await user.click(anterior);
    expect(screen.getByText("Página atual: 2")).toBeInTheDocument();
    expect(proxima).toBeEnabled();
  });

  it("permite escolher uma página pelo número", async () => {
    const user = userEvent.setup();
    render(<ExemploComTresPaginas />);

    await user.click(screen.getByRole("button", { name: "3" }));
    expect(screen.getByText("Página atual: 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "1" }));
    expect(screen.getByText("Página atual: 1")).toBeInTheDocument();
  });

  it("não solicita páginas fora dos limites pelos botões desabilitados", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { rerender } = render(
      <Pagination page={1} totalPages={3} onChange={onChange} />,
    );

    await user.click(obterSetas().anterior);
    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <Pagination page={3} totalPages={3} onChange={onChange} />,
    );

    await user.click(obterSetas().proxima);
    expect(onChange).not.toHaveBeenCalled();
  });
});