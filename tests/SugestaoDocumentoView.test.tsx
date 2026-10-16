import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SugestaoDocumentoView from "../app/components/shared/SugestaoDocumentoView";

describe("Exibição do documento da sugestão", () => {
  it("mostra títulos, listas e células de tabela", () => {
    render(<SugestaoDocumentoView conteudo="Resumo" documento={{ type: "doc", content: [
      { type: "heading", attrs: { level: 2, textAlign: "center" }, content: [{ type: "text", text: "Meu título" }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Primeiro item" }] }] }] },
      { type: "table", content: [{ type: "tableRow", content: [
        { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Assunto" }] }] },
        { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Biblioteca" }] }] },
      ] }] },
    ] }} />);
    expect(screen.getByRole("heading", { level: 2, name: "Meu título" })).toHaveStyle({ textAlign: "center" });
    expect(screen.getByRole("listitem")).toHaveTextContent("Primeiro item");
    expect(screen.getByRole("columnheader")).toHaveTextContent("Assunto");
    expect(screen.getByRole("cell")).toHaveTextContent("Biblioteca");
  });

  it("preserva cor, fonte e um link seguro", () => {
    render(<SugestaoDocumentoView conteudo="Resumo" documento={{ type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "Visitar site", marks: [
        { type: "textStyle", attrs: { color: "#ff0000", fontFamily: "Georgia", fontSize: "18px" } },
        { type: "link", attrs: { href: "https://example.com" } },
      ] }] },
    ] }} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://example.com");
    expect(screen.getByRole("link")).toHaveAttribute("rel", "noopener noreferrer nofollow");
    expect(screen.getByText("Visitar site")).toHaveStyle({ color: "rgb(255, 0, 0)", fontFamily: "Georgia", fontSize: "18px" });
  });

  it("não transforma endereços perigosos em links ou imagens", () => {
    render(<SugestaoDocumentoView conteudo="Resumo" documento={{ type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "Texto preservado", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] },
      { type: "image", attrs: { src: "data:image/svg+xml;base64,PHN2Zz4=", alt: "Imagem inválida" } },
    ] }} />);
    expect(screen.getByText("Texto preservado")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("continua mostrando sugestões antigas sem documento", () => {
    render(<SugestaoDocumentoView conteudo="Minha sugestão antiga" />);
    expect(screen.getByText("Minha sugestão antiga")).toBeInTheDocument();
  });
});
