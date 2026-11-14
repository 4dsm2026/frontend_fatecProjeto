import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resetEntryCache } from "../utils/entry";
import { storeSession } from "../utils/session";
import { json, stubApi } from "./helpers-api";
import { XPATH_SUGERIDO, formatarTamanho, type MapaAtual } from "../utils/mapa-salas";
import VisualizadorMapaSalas from "../app/components/shared/VisualizadorMapaSalas";
import AdminMapaDeSalasPage from "../app/(dashboard)/admin/mapa-de-salas/page";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  resetEntryCache();
  storeSession({ accessToken: "mapa-test-token" });
  // jsdom não implementa blob: URLs
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:mapa-1"), revokeObjectURL: vi.fn() });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false }) });
});

const VERSAO = {
  id: "v1",
  origem: "AUTOMATICA" as const,
  nomeArquivo: "2026-07-30-Mapas-de-Salas.pdf",
  tamanhoBytes: 422421,
  checksumSha256: "abc",
  publicadoEm: "2026-11-14T09:00:00.000Z",
  _links: { file: { href: "/room-maps/versions/v1/file" } },
};
const pdf = () => new Response(new Blob(["%PDF-1.4"], { type: "application/pdf" }), { headers: { "content-type": "application/pdf" } });

describe("utils/mapa-salas", () => {
  it("formata o tamanho do arquivo", () => {
    expect(formatarTamanho(900)).toBe("900 B");
    expect(formatarTamanho(422421)).toBe("413 KB");
    expect(formatarTamanho(3 * 1024 * 1024)).toBe("3,0 MB");
  });
});

describe("<VisualizadorMapaSalas />", () => {
  it("sem mapa publicado, explica que ainda não há", () => {
    render(<VisualizadorMapaSalas mapa={{ atual: null, _links: {} }} />);
    expect(screen.getByText("O mapa de salas ainda não foi publicado")).toBeInTheDocument();
  });

  it("baixa o PDF com o token pelo link file e mostra no visualizador", async () => {
    const api = stubApi({ "GET /room-maps/current/file": () => pdf() });
    const mapa: MapaAtual = { atual: VERSAO, _links: { file: { href: "/room-maps/current/file" } } };
    render(<VisualizadorMapaSalas mapa={mapa} />);

    const iframe = await screen.findByTitle("Mapa de salas");
    expect(iframe).toHaveAttribute("src", "blob:mapa-1");
    expect(screen.getByRole("link", { name: /Baixar/ })).toHaveAttribute("download", VERSAO.nomeArquivo);
    expect(screen.getByText(/Site institucional · 413 KB/)).toBeInTheDocument();
    expect(api.calls[0].auth).toBe("Bearer mapa-test-token");
  });

  it("quando o mapa atual muda, baixa o PDF de novo (o endereço é o mesmo)", async () => {
    const api = stubApi({ "GET /room-maps/current/file": () => pdf() });
    const links = { file: { href: "/room-maps/current/file" } };
    const { rerender } = render(<VisualizadorMapaSalas mapa={{ atual: VERSAO, _links: links }} />);
    await screen.findByTitle("Mapa de salas");

    rerender(<VisualizadorMapaSalas mapa={{ atual: { ...VERSAO, id: "v2", nomeArquivo: "novo.pdf" }, _links: links }} />);
    await waitFor(() => expect(api.keys().filter((k) => k === "GET /room-maps/current/file")).toHaveLength(2));
  });

  it("no celular, não embute o PDF e destaca o botão de abrir", async () => {
    Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: true }) });
    stubApi({ "GET /room-maps/current/file": () => pdf() });
    render(<VisualizadorMapaSalas mapa={{ atual: VERSAO, _links: { file: { href: "/room-maps/current/file" } } }} />);

    expect(await screen.findByRole("link", { name: /Abrir em nova aba/ })).toHaveClass("bg-primary");
    expect(screen.queryByTitle("Mapa de salas")).toBeNull();
  });
});

describe("Página do administrador", () => {
  const fonte = {
    url: "https://fatec.exemplo/mapa-de-salas/",
    xpath: XPATH_SUGERIDO,
    atualizacaoAutomatica: true,
    ultimaVerificacaoEm: "2026-11-14T09:00:00.000Z",
    ultimoResultado: "Sem mudança: o PDF é o mesmo da versão atual",
    ultimoErro: null,
    _links: {
      update: { href: "/room-maps/source", method: "PUT" },
      test: { href: "/room-maps/source/test", method: "POST" },
      sync: { href: "/room-maps/source/sync", method: "POST" },
    },
  };

  function rotas(extra: Record<string, (init: RequestInit) => Response> = {}) {
    return stubApi({
      "GET /room-maps/current": () =>
        json({
          atual: VERSAO,
          _links: {
            file: { href: "/room-maps/current/file" },
            versions: { href: "/room-maps/versions" },
            upload: { href: "/room-maps/versions", method: "POST" },
            source: { href: "/room-maps/source" },
          },
        }),
      "GET /room-maps/current/file": () => pdf(),
      "GET /room-maps/source": () => json(fonte),
      "GET /room-maps/versions": () => json({ _embedded: { "room-map-versions": [VERSAO] }, page: { size: 20, number: 0, totalElements: 1, totalPages: 1 } }),
      ...extra,
    });
  }

  it("mostra a fonte, a última verificação e o histórico; Testar envia URL e XPath", async () => {
    const user = userEvent.setup();
    let corpo: unknown = null;
    rotas({
      "POST /room-maps/source/test": (init) => {
        corpo = JSON.parse(String(init.body));
        return json({ urlPdf: "https://arquivos.exemplo/mapa.pdf", nomeArquivo: "mapa.pdf", tamanhoBytes: 422421, igualAoAtual: true });
      },
    });
    render(<AdminMapaDeSalasPage />);

    expect(await screen.findByDisplayValue("https://fatec.exemplo/mapa-de-salas/")).toBeInTheDocument();
    expect(screen.getByText(/Sem mudança: o PDF é o mesmo/)).toBeInTheDocument();
    expect(screen.getByText("Histórico")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar/ })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Testar/ }));
    expect(await screen.findByText("PDF encontrado")).toBeInTheDocument();
    expect(screen.getByText(/igual ao mapa publicado/)).toBeInTheDocument();
    expect(corpo).toEqual({ url: "https://fatec.exemplo/mapa-de-salas/", xpath: XPATH_SUGERIDO });
  });

  it("salvar envia a configuração; com mudança não salva, Atualizar agora fica bloqueado", async () => {
    const user = userEvent.setup();
    let corpo: unknown = null;
    rotas({
      "PUT /room-maps/source": (init) => {
        corpo = JSON.parse(String(init.body));
        return json({ ...fonte, atualizacaoAutomatica: false });
      },
    });
    render(<AdminMapaDeSalasPage />);

    const auto = await screen.findByRole("checkbox", { name: /Conferir automaticamente/ });
    await user.click(auto);
    expect(screen.getByRole("button", { name: /Atualizar agora/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Salvar/ }));
    await waitFor(() => expect(corpo).toEqual({ url: fonte.url, xpath: XPATH_SUGERIDO, atualizacaoAutomatica: false }));
  });

  it("Atualizar agora manda corpo JSON (o servidor recusa JSON vazio) e recarrega a tela", async () => {
    const user = userEvent.setup();
    let corpo: BodyInit | null | undefined;
    rotas({
      "POST /room-maps/source/sync": (init) => {
        corpo = init.body;
        return json({ nova: true, resultado: "Nova versão publicada", versao: VERSAO });
      },
    });
    render(<AdminMapaDeSalasPage />);
    await user.click(await screen.findByRole("button", { name: /Atualizar agora/ }));
    await waitFor(() => expect(corpo).toBe("{}"));
  });

  it("sem os links de gestão (secretaria), só mostra o mapa", async () => {
    stubApi({
      "GET /room-maps/current": () => json({ atual: VERSAO, _links: { file: { href: "/room-maps/current/file" } } }),
      "GET /room-maps/current/file": () => pdf(),
    });
    render(<AdminMapaDeSalasPage />);
    expect(await screen.findByTitle("Mapa de salas")).toBeInTheDocument();
    expect(screen.queryByText("Atualização pelo site institucional")).toBeNull();
    expect(screen.queryByRole("button", { name: /Escolher PDF/ })).toBeNull();
  });
});
