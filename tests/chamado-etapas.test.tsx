import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { resetEntryCache } from "../utils/entry";
import { json, stubApi } from "./helpers-api";
import { ETAPAS_CHAMADO, ORIENTACAO_CHAMADO, etapaDoChamado, tituloHistoricoChamado } from "../utils/chamado-etapas";
import LinhaDeEtapas from "../app/components/shared/LinhaDeEtapas";
import AlunoTicket from "../app/(dashboard)/aluno/chamados/[id]/page";
import type { Status } from "../utils/types";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "ticket-1" }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

beforeEach(() => {
  localStorage.clear();
  resetEntryCache();
  vi.stubGlobal("WebSocket", class { close() {} send() {} });
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollTo = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const TODOS: Status[] = ["ABERTO", "EM_ATENDIMENTO", "AGUARDANDO_USUARIO", "RESOLVIDO", "ENCERRADO"];

describe("utils/chamado-etapas", () => {
  it("mapeia cada status para uma etapa; aguardando aluno é pendência da etapa 2", () => {
    expect(etapaDoChamado("ABERTO")).toMatchObject({ atual: 0, estado: "andamento" });
    expect(etapaDoChamado("EM_ATENDIMENTO")).toMatchObject({ atual: 1, estado: "andamento" });
    expect(etapaDoChamado("AGUARDANDO_USUARIO")).toMatchObject({ atual: 1, estado: "pendente", legendaAtual: "Aguardando você" });
    expect(etapaDoChamado("RESOLVIDO")).toMatchObject({ atual: 2, estado: "andamento" });
    expect(etapaDoChamado("ENCERRADO")).toMatchObject({ atual: 3, estado: "concluido" });
    expect(ETAPAS_CHAMADO).toHaveLength(4);
  });

  it("todo status tem orientação para o aluno", () => {
    for (const s of TODOS) expect(ORIENTACAO_CHAMADO[s]).toBeTruthy();
  });

  it("reabertura ganha título próprio no histórico", () => {
    expect(tituloHistoricoChamado({ id: "1", de: "RESOLVIDO", para: "EM_ATENDIMENTO", criadoEm: "x" })).toBe("Solicitação reaberta");
    expect(tituloHistoricoChamado({ id: "2", de: "ENCERRADO", para: "EM_ATENDIMENTO", criadoEm: "x" })).toBe("Solicitação reaberta");
    expect(tituloHistoricoChamado({ id: "3", de: "ABERTO", para: "EM_ATENDIMENTO", criadoEm: "x" })).toBe("Em análise pelo setor");
  });
});

describe("<LinhaDeEtapas />", () => {
  const etapas = [
    { chave: "a", titulo: "A", quem: "Fatec" },
    { chave: "b", titulo: "B", quem: "Setor" },
    { chave: "c", titulo: "C" },
  ];

  it("marca concluídas, a atual e usa a legenda da etapa atual", () => {
    render(<LinhaDeEtapas etapas={etapas} atual={1} estado="pendente" legendaAtual="Aguardando você" />);
    const itens = screen.getAllByRole("listitem");
    expect(within(itens[0]).getByLabelText("concluída")).toBeInTheDocument();
    expect(itens[1]).toHaveAttribute("aria-current", "step");
    expect(within(itens[1]).getByText("Aguardando você")).toBeInTheDocument();
    expect(within(itens[1]).queryByText("Setor")).toBeNull();
    expect(within(itens[2]).queryByLabelText("concluída")).toBeNull();
  });

  it("concluído marca todas as etapas e nenhuma fica como atual", () => {
    render(<LinhaDeEtapas etapas={etapas} atual={2} estado="concluido" />);
    expect(screen.getAllByLabelText("concluída")).toHaveLength(3);
    expect(screen.getAllByRole("listitem").some((li) => li.getAttribute("aria-current"))).toBe(false);
  });

  it("falhou marca a etapa atual com X", () => {
    render(<LinhaDeEtapas etapas={etapas} atual={1} estado="falhou" />);
    expect(screen.getByLabelText("encerrada")).toBeInTheDocument();
    expect(screen.getAllByLabelText("concluída")).toHaveLength(1);
  });
});

describe("detalhe do chamado do aluno", () => {
  function mockApi(resource: object) {
    return stubApi({
      "GET /api": () => json({ _links: { "current-user": { href: "/users/me" } } }),
      "GET /users/me": () => json({ id: "student-1", nome: "Aluno" }),
      "GET /tickets/ticket-1": () => json(resource),
      "GET /contract/attachments": () => json({ _embedded: { attachments: [] } }),
      "GET /contract/messages": () => json({ _embedded: { messages: [] } }),
    });
  }

  const base = {
    id: "ticket-1", titulo: "Declaração de matrícula", descricao: "Preciso da declaração",
    prioridade: "MEDIA", nivel: "N1", criadoPorId: "student-1",
    criadoEm: "2026-11-01T12:00:00Z", atualizadoEm: "2026-11-02T12:00:00Z",
    _links: {
      self: { href: "/tickets/ticket-1" },
      attachments: { href: "/contract/attachments" },
      messages: { href: "/contract/messages" },
    },
  };

  it("mostra a etapa, a orientação de 'aguardando você' e o histórico com reabertura", async () => {
    mockApi({
      ...base,
      status: "AGUARDANDO_USUARIO",
      historico: [
        { id: "h4", de: "EM_ATENDIMENTO", para: "AGUARDANDO_USUARIO", criadoEm: "2026-11-04T10:00:00Z", porUsuarioId: "staff-1", porUsuario: { nome: "Secretaria Ana" } },
        { id: "h3", de: "RESOLVIDO", para: "EM_ATENDIMENTO", criadoEm: "2026-11-03T10:00:00Z", porUsuarioId: "student-1", porUsuario: { nome: "Aluno" } },
        { id: "h2", de: "ABERTO", para: "RESOLVIDO", criadoEm: "2026-11-02T10:00:00Z", porUsuarioId: "staff-1", porUsuario: { nome: "Secretaria Ana" } },
        { id: "h1", de: null, para: "ABERTO", criadoEm: "2026-11-01T12:00:00Z", porUsuarioId: "student-1", porUsuario: { nome: "Aluno" } },
      ],
    });
    render(<AlunoTicket />);

    const etapas = await screen.findByRole("list", { name: "Etapas da solicitação" });
    const itens = within(etapas).getAllByRole("listitem");
    expect(itens[1]).toHaveAttribute("aria-current", "step");
    expect(within(itens[1]).getByText("Aguardando você")).toBeInTheDocument();
    expect(screen.getByText(ORIENTACAO_CHAMADO.AGUARDANDO_USUARIO)).toBeInTheDocument();

    expect(screen.getByText("Histórico de status")).toBeInTheDocument();
    expect(screen.getByText("Solicitação reaberta")).toBeInTheDocument();
    expect(screen.getAllByText(/· Você$/)).toHaveLength(2);
    expect(screen.getAllByText(/· Secretaria Ana$/)).toHaveLength(2);
  });

  it("chamado encerrado mostra todas as etapas concluídas", async () => {
    mockApi({ ...base, status: "ENCERRADO", historico: [] });
    render(<AlunoTicket />);
    const etapas = await screen.findByRole("list", { name: "Etapas da solicitação" });
    expect(within(etapas).getAllByLabelText("concluída")).toHaveLength(4);
    expect(screen.queryByText("Histórico de status")).toBeNull();
  });
});
