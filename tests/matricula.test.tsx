import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resetEntryCache } from "../utils/entry";
import { storeSession } from "../utils/session";
import { json, stubApi } from "./helpers-api";
import {
  ehServicoDeTrancamento,
  errosDoFormulario,
  etapaDaSolicitacao,
  orientacaoAluno,
  proximoSemestre,
  rotuloMotivo,
  situacaoNormalizada,
  type Elegibilidade,
  type Solicitacao,
} from "../utils/matricula";
import { SituacaoBadge } from "../app/components/shared/MatriculaBadges";
import MatriculaAlunoPage from "../app/(dashboard)/aluno/matricula/page";
import SolicitacaoAlunoPage from "../app/(dashboard)/aluno/matricula/[id]/page";
import SolicitacaoAdminPage from "../app/(dashboard)/admin/matricula/[id]/page";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "sol_1" }),
  useRouter: () => ({ push }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

afterEach(cleanup);
beforeEach(() => {
  push.mockReset();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) { this.setAttribute("open", ""); },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) { this.removeAttribute("open"); },
  });
  localStorage.clear();
  resetEntryCache();
  storeSession({ accessToken: "matricula-test-token" });
});

function elegibilidade(extra: Partial<Elegibilidade> = {}): Elegibilidade {
  return {
    situacaoAcademica: null,
    curso: "DSM",
    semestreAtual: "3",
    semestreLetivo: "2026-2",
    trancamentosDeferidos: 0,
    pedidoEmAndamento: null,
    podeTrancar: true,
    podeCancelar: true,
    bloqueioTrancamento: null,
    bloqueioCancelamento: null,
    avisosTrancamento: [],
    _links: { create: { href: "/enrollment-requests", method: "POST" } },
    ...extra,
  };
}

function solicitacao(extra: Partial<Solicitacao> = {}): Solicitacao {
  return {
    id: "sol_1",
    usuarioId: "aluno-1",
    tipo: "TRANCAMENTO",
    status: "SOLICITADO",
    semestre: "2026-2",
    motivo: "TRABALHO_HORARIO",
    justificativa: "Mudei de turno",
    curso: "DSM",
    criadoEm: "2026-11-13T12:00:00.000Z",
    historico: [],
    usuario: { id: "aluno-1", nome: "Maria", ra: "123", situacaoAcademica: null, semestreAtual: "3", turno: "Noite" },
    _links: { self: { href: "/enrollment-requests/sol_1" } },
    ...extra,
  };
}

describe("utils/matricula", () => {
  it("normaliza a situação e lê os motivos", () => {
    expect(situacaoNormalizada(null)).toBe("Regular");
    expect(situacaoNormalizada("TRANCADA")).toBe("Trancada");
    expect(situacaoNormalizada("Cancelado")).toBe("Cancelada");
    expect(rotuloMotivo("FINANCEIRO")).toBe("Dificuldade financeira");
    expect(rotuloMotivo("X")).toBe("X");
    expect(proximoSemestre("2026-2")).toBe("2027-1");
  });

  it("mapeia status para etapa: pendência amarela, deferido concluído, desistência falha onde parou", () => {
    expect(etapaDaSolicitacao("SOLICITADO")).toMatchObject({ atual: 1, estado: "andamento" });
    expect(etapaDaSolicitacao("PENDENTE_ALUNO")).toMatchObject({ atual: 1, estado: "pendente", legendaAtual: "Aguardando você" });
    expect(etapaDaSolicitacao("DEFERIDO")).toMatchObject({ estado: "concluido" });
    expect(etapaDaSolicitacao("INDEFERIDO")).toMatchObject({ atual: 2, estado: "falhou" });
    expect(etapaDaSolicitacao("CANCELADO")).toMatchObject({ atual: 0, estado: "falhou" });
    expect(etapaDaSolicitacao("CANCELADO", [{ id: "h", de: "SOLICITADO", para: "EM_ANALISE", comentario: null, criadoEm: "x" }]).atual).toBe(1);
  });

  it("orienta conforme o tipo e o status", () => {
    expect(orientacaoAluno({ tipo: "TRANCAMENTO", status: "DEFERIDO" })).toMatch(/rematrícula/);
    expect(orientacaoAluno({ tipo: "CANCELAMENTO", status: "DEFERIDO" })).toMatch(/vínculo/);
  });

  it("valida o formulário com as regras da API", () => {
    const base = { tipo: "TRANCAMENTO" as const, semestre: "2026-2", motivo: "", justificativa: "", cienteDefinitivo: false };
    expect(Object.keys(errosDoFormulario(base))).toEqual(["motivo"]);
    expect(errosDoFormulario({ ...base, motivo: "OUTRO" }).justificativa).toBeTruthy();
    expect(errosDoFormulario({ ...base, tipo: "CANCELAMENTO", motivo: "FINANCEIRO" }).cienteDefinitivo).toBeTruthy();
    expect(errosDoFormulario({ ...base, tipo: "CANCELAMENTO", motivo: "FINANCEIRO", cienteDefinitivo: true })).toEqual({});
  });

  it("reconhece no catálogo o serviço de trancamento, pela lista fixa ou pelo nome", () => {
    expect(ehServicoDeTrancamento({ id: "secretaria-trancamento-destrancamento" })).toBe(true);
    expect(ehServicoDeTrancamento({ id: "cm123", nome: "Trancamento de matrícula" })).toBe(true);
    expect(ehServicoDeTrancamento({ id: "cm124", nome: "Cancelamento de matrícula" })).toBe(true);
    expect(ehServicoDeTrancamento({ id: "cm125", nome: "Matrícula" })).toBe(false);
    expect(ehServicoDeTrancamento({ id: "cm126", nome: "Emissão de Declaração" })).toBe(false);
  });

  it("SituacaoBadge mostra o texto original no title", () => {
    render(<SituacaoBadge situacao="TRANCADA (2026-1)" />);
    expect(screen.getByText("Trancada")).toHaveAttribute("title", "TRANCADA (2026-1)");
  });
});

describe("aluno — pedir trancamento ou cancelamento", () => {
  it("mostra a situação, os bloqueios e envia o trancamento pelo link create", async () => {
    const user = userEvent.setup();
    let corpo: unknown = null;
    stubApi({
      "GET /enrollment-requests/eligibility": () =>
        json(elegibilidade({ trancamentosDeferidos: 2, podeTrancar: false, bloqueioTrancamento: "O limite de 2 trancamentos já foi usado." })),
      "GET /enrollment-requests": () => json({ _embedded: { "enrollment-requests": [] }, _links: {} }),
      "POST /enrollment-requests": (init) => {
        corpo = JSON.parse(String(init.body));
        return json(solicitacao({ id: "sol_9", tipo: "CANCELAMENTO" }), 201);
      },
    });
    render(<MatriculaAlunoPage />);

    expect(await screen.findByText("2 de 2")).toBeInTheDocument();
    const trancar = screen.getByRole("button", { name: /Trancar matrícula/ });
    expect(trancar).toBeDisabled();
    expect(within(trancar).getByText("O limite de 2 trancamentos já foi usado.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Cancelar matrícula/ }));
    await user.selectOptions(screen.getByRole("combobox", { name: /Motivo principal/ }), "FINANCEIRO");
    await user.click(screen.getByRole("button", { name: "Pedir cancelamento" }));
    expect(screen.getByText("Confirme que entende que o cancelamento é definitivo.")).toBeInTheDocument();
    expect(corpo).toBeNull();

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Pedir cancelamento" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/aluno/matricula/sol_9"));
    expect(corpo).toEqual({ tipo: "CANCELAMENTO", semestre: "2026-2", motivo: "FINANCEIRO", justificativa: null, cienteDefinitivo: true });
  });

  it("com pedido em andamento, só oferece acompanhar", async () => {
    stubApi({
      "GET /enrollment-requests/eligibility": () =>
        json(elegibilidade({ pedidoEmAndamento: { id: "sol_1", tipo: "TRANCAMENTO", status: "EM_ANALISE" }, podeTrancar: false, podeCancelar: false })),
      "GET /enrollment-requests": () => json({ _embedded: { "enrollment-requests": [solicitacao({ status: "EM_ANALISE" })] }, _links: {} }),
    });
    render(<MatriculaAlunoPage />);
    expect(await screen.findByText("Você já tem um pedido em andamento")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "acompanhar o pedido" })).toHaveAttribute("href", "/aluno/matricula/sol_1");
    expect(screen.queryByRole("button", { name: /Trancar matrícula/ })).toBeNull();
    expect(screen.getByText("Em análise")).toBeInTheDocument();
  });
});

describe("aluno — acompanhar o pedido", () => {
  it("na pendência, mostra a mensagem da Secretaria e responde pelo link respond", async () => {
    const user = userEvent.setup();
    let corpo: unknown = null;
    stubApi({
      "GET /enrollment-requests/sol_1": () =>
        json(
          solicitacao({
            status: "PENDENTE_ALUNO",
            orientacaoFatec: "Envie a declaração do empregador.",
            _links: { self: { href: "/enrollment-requests/sol_1" }, respond: { href: "/enrollment-requests/sol_1/replies", method: "POST" } },
          }),
        ),
      "POST /enrollment-requests/sol_1/replies": (init) => {
        corpo = JSON.parse(String(init.body));
        return json(solicitacao({ status: "EM_ANALISE" }));
      },
    });
    render(<SolicitacaoAlunoPage />);

    expect(await screen.findByText("Envie a declaração do empregador.")).toBeInTheDocument();
    const etapas = screen.getByRole("list", { name: "Etapas do pedido" });
    expect(within(etapas).getByText("Aguardando você")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Sua resposta à Secretaria"), "Declaração anexada na Secretaria.");
    await user.click(screen.getByRole("button", { name: /Responder/ }));
    await waitFor(() => expect(corpo).toEqual({ justificativa: "Declaração anexada na Secretaria." }));
    expect(await screen.findByText("Em análise")).toBeInTheDocument();
  });
});

describe("Secretaria — decidir", () => {
  it("mostra os alertas e, ao deferir, explica o efeito e segue o link transition", async () => {
    const user = userEvent.setup();
    let corpo: unknown = null;
    const pedido = solicitacao({
      status: "EM_ANALISE",
      alertas: ["O cadastro indica 1º semestre: pelo regulamento, o trancamento não é concedido no primeiro semestre."],
      _links: {
        self: { href: "/enrollment-requests/sol_1" },
        transition: [
          { href: "/enrollment-requests/sol_1/status", method: "POST", name: "PENDENTE_ALUNO" },
          { href: "/enrollment-requests/sol_1/status", method: "POST", name: "DEFERIDO" },
          { href: "/enrollment-requests/sol_1/status", method: "POST", name: "INDEFERIDO" },
        ],
      },
    });
    stubApi({
      "GET /enrollment-requests/sol_1": () => json(corpo ? solicitacao({ status: "DEFERIDO" }) : pedido),
      "POST /enrollment-requests/sol_1/status": (init) => {
        corpo = JSON.parse(String(init.body));
        return json(solicitacao({ status: "DEFERIDO" }));
      },
    });
    render(<SolicitacaoAdminPage />);

    expect(await screen.findByText(/não é concedido no primeiro semestre/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver ficha do aluno/ })).toHaveAttribute("href", "/admin/alunos/aluno-1");

    await user.click(screen.getByRole("button", { name: "Deferir" }));
    const dialogo = await screen.findByRole("dialog", { hidden: true });
    expect(within(dialogo).getByText(/passa a "Trancada"/)).toBeInTheDocument();
    await user.click(within(dialogo).getByRole("button", { name: "Deferir", hidden: true }));
    await waitFor(() => expect(corpo).toEqual({ status: "DEFERIDO" }));
  });

  it("indeferir exige motivo", async () => {
    const user = userEvent.setup();
    stubApi({
      "GET /enrollment-requests/sol_1": () =>
        json(solicitacao({ _links: { transition: [{ href: "/enrollment-requests/sol_1/status", method: "POST", name: "INDEFERIDO" }] } })),
    });
    render(<SolicitacaoAdminPage />);
    await user.click(await screen.findByRole("button", { name: "Indeferir" }));
    const dialogo = await screen.findByRole("dialog", { hidden: true });
    expect(within(dialogo).getByRole("button", { name: "Indeferir", hidden: true })).toBeDisabled();
  });
});
