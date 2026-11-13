import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resetEntryCache } from "../utils/entry";
import { storeSession } from "../utils/session";
import { json, stubApi } from "./helpers-api";
import {
  ACAO_LABEL,
  ETAPAS,
  STATUS_PASSE_LABEL,
  corpoDoFormulario,
  cpfValido,
  formatarCep,
  formatarCpf,
  formularioVazio,
  indiceEtapa,
  pedeComentario,
  validarFormulario,
  type PasseDetalhe,
} from "../utils/passe-escolar";
import PasseEscolarEtapas from "../app/components/shared/PasseEscolarEtapas";
import PasseEscolarAcoes from "../app/components/shared/PasseEscolarAcoes";
import PasseEscolarAlunoPage from "../app/(dashboard)/aluno/passe-escolar/page";
import AdminPasseEscolarPage from "../app/(dashboard)/admin/passe-escolar/page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "passe_1" }),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/aluno/passe-escolar",
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

afterEach(cleanup);

// jsdom não implementa <dialog>.showModal/close; o ConfirmDialog usa os dois.
beforeEach(() => {
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
  storeSession({ accessToken: "passe-test-token" });
});

function passe(status: PasseDetalhe["status"], extra: Partial<PasseDetalhe> = {}): PasseDetalhe {
  return {
    id: "passe_1",
    usuarioId: "aluno-1",
    anoReferencia: 2026,
    tipo: "NOVO",
    modalidade: "MEIA_TARIFA",
    status,
    nomeCompleto: "Maria da Silva",
    rg: "12.345.678-9",
    cpf: "52998224725",
    cep: "09500000",
    municipioResidencia: "São Caetano do Sul",
    curso: "DSM",
    periodo: "Noite",
    mesConclusao: 12,
    anoConclusao: 2027,
    declaraBaixaRenda: false,
    criadoEm: "2026-02-01T12:00:00.000Z",
    historico: [],
    _links: { self: { href: "/school-passes/passe_1" } },
    ...extra,
  };
}

function colecao(items: PasseDetalhe[], links: Record<string, { href: string; method?: string }> = {}) {
  return {
    _embedded: { "school-passes": items },
    page: { size: 20, number: 0, totalElements: items.length, totalPages: 1 },
    _links: { self: { href: "/school-passes?page=0&size=20" }, ...links },
  };
}

describe("utils/passe-escolar", () => {
  it("valida CPF e formata CPF/CEP", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("529.982.247-26")).toBe(false);
    expect(cpfValido("000.000.000-00")).toBe(false);
    expect(formatarCpf("52998224725")).toBe("529.982.247-25");
    expect(formatarCep("09500000")).toBe("09500-000");
  });

  it("indiceEtapa: pendência fica na etapa 1; recusa fica onde parou", () => {
    expect(indiceEtapa("SOLICITADO")).toBe(0);
    expect(indiceEtapa("PENDENTE_ALUNO")).toBe(0);
    expect(indiceEtapa("CADASTRADO_PORTAL")).toBe(1);
    expect(indiceEtapa("CONCLUIDO")).toBe(3);
    const hist = [
      { id: "1", de: null, para: "SOLICITADO" as const, comentario: null, criadoEm: "2026-01-01" },
      { id: "2", de: "SOLICITADO" as const, para: "CADASTRADO_PORTAL" as const, comentario: null, criadoEm: "2026-01-02" },
      { id: "3", de: "CADASTRADO_PORTAL" as const, para: "REQUISITADO_EMTU" as const, comentario: null, criadoEm: "2026-01-03" },
    ];
    expect(indiceEtapa("INDEFERIDO", hist)).toBe(2);
    expect(indiceEtapa("CANCELADO", [])).toBe(0);
  });

  it("todo status tem rótulo e toda etapa do caminho feliz existe", () => {
    expect(Object.keys(STATUS_PASSE_LABEL)).toHaveLength(7);
    expect(ETAPAS.map((e) => e.status)).toEqual(["SOLICITADO", "CADASTRADO_PORTAL", "REQUISITADO_EMTU", "CONCLUIDO"]);
  });

  it("validarFormulario aponta os campos com as mesmas regras da API", () => {
    const vazio = formularioVazio(2026);
    const erros = validarFormulario(vazio);
    expect(Object.keys(erros).sort()).toEqual(["cep", "cpf", "curso", "municipioResidencia", "nomeCompleto", "periodo", "rg"]);

    const ok = validarFormulario({
      ...vazio,
      nomeCompleto: "Maria da Silva",
      rg: "12.345.678-9",
      cpf: "529.982.247-25",
      cep: "09500-000",
      municipioResidencia: "Santo André",
      curso: "DSM",
      periodo: "Noite",
    });
    expect(ok).toEqual({});

    const livreSemDeclaracao = validarFormulario({ ...vazio, modalidade: "PASSE_LIVRE" });
    expect(livreSemDeclaracao.declaraBaixaRenda).toBeTruthy();
  });

  it("corpoDoFormulario manda CPF/CEP só com dígitos e números como número", () => {
    const corpo = corpoDoFormulario({ ...formularioVazio(2026), cpf: "529.982.247-25", cep: "09500-000", mesConclusao: "6", anoConclusao: "2027" });
    expect(corpo.cpf).toBe("52998224725");
    expect(corpo.cep).toBe("09500000");
    expect(corpo.mesConclusao).toBe(6);
    expect(corpo.anoConclusao).toBe(2027);
    expect(corpo.observacaoAluno).toBeNull();
  });

  it("a equipe precisa explicar pendência e indeferimento; o aluno não", () => {
    expect(pedeComentario("PENDENTE_ALUNO", "equipe")).toBe("obrigatorio");
    expect(pedeComentario("INDEFERIDO", "equipe")).toBe("obrigatorio");
    expect(pedeComentario("INDEFERIDO", "aluno")).toBe("opcional");
    expect(pedeComentario("CADASTRADO_PORTAL", "equipe")).toBe("nao");
    expect(ACAO_LABEL.aluno.CADASTRADO_PORTAL).toBeUndefined();
  });
});

describe("<PasseEscolarEtapas />", () => {
  it("marca a etapa atual e as concluídas", () => {
    render(<PasseEscolarEtapas status="REQUISITADO_EMTU" />);
    const itens = screen.getAllByRole("listitem");
    expect(itens).toHaveLength(4);
    expect(itens[2]).toHaveAttribute("aria-current", "step");
    expect(within(itens[0]).getByLabelText("concluída")).toBeInTheDocument();
    expect(within(itens[1]).getByLabelText("concluída")).toBeInTheDocument();
    expect(within(itens[3]).queryByLabelText("concluída")).toBeNull();
  });

  it("na visão da equipe, 'Você' vira 'Aluno'", () => {
    render(<PasseEscolarEtapas status="SOLICITADO" pontoDeVista="equipe" />);
    expect(screen.getAllByText("Aluno")).toHaveLength(2);
    expect(screen.queryByText("Você")).toBeNull();
  });
});

describe("<PasseEscolarAcoes />", () => {
  it("mostra um botão por link `transition` e envia o status pelo link", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    const api = stubApi({
      "POST /school-passes/passe_1/status": (init) => {
        const body = JSON.parse(String(init.body));
        expect(body).toEqual({ status: "CADASTRADO_PORTAL" });
        return json(passe("CADASTRADO_PORTAL"));
      },
    });
    const recurso = passe("SOLICITADO", {
      _links: {
        self: { href: "/school-passes/passe_1" },
        transition: [
          { href: "/school-passes/passe_1/status", method: "POST", name: "CADASTRADO_PORTAL" },
          { href: "/school-passes/passe_1/status", method: "POST", name: "PENDENTE_ALUNO" },
        ],
      },
    });

    render(<PasseEscolarAcoes passe={recurso} quem="equipe" onChanged={onChanged} />);
    expect(screen.getByRole("button", { name: "Marcar como cadastrado no portal" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pedir correção ao aluno" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Indeferir" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Marcar como cadastrado no portal" }));
    const dialogo = await screen.findByRole("dialog", { hidden: true });
    await user.click(within(dialogo).getByRole("button", { name: "Marcar como cadastrado no portal", hidden: true }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(api.keys()).toContain("POST /school-passes/passe_1/status");
  });

  it("pedir correção exige o motivo: o botão fica desabilitado até digitar", async () => {
    const user = userEvent.setup();
    stubApi({
      "POST /school-passes/passe_1/status": (init) => {
        const body = JSON.parse(String(init.body));
        expect(body).toEqual({ status: "PENDENTE_ALUNO", comentario: "CEP não confere com o comprovante" });
        return json(passe("PENDENTE_ALUNO"));
      },
    });
    const recurso = passe("SOLICITADO", {
      _links: {
        self: { href: "/school-passes/passe_1" },
        transition: [{ href: "/school-passes/passe_1/status", method: "POST", name: "PENDENTE_ALUNO" }],
      },
    });
    const onChanged = vi.fn();
    render(<PasseEscolarAcoes passe={recurso} quem="equipe" onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: "Pedir correção ao aluno" }));
    const dialogo = await screen.findByRole("dialog", { hidden: true });
    const confirmar = within(dialogo).getByRole("button", { name: "Pedir correção ao aluno", hidden: true });
    expect(confirmar).toBeDisabled();

    await user.type(within(dialogo).getByRole("textbox", { hidden: true }), "CEP não confere com o comprovante");
    expect(confirmar).toBeEnabled();
    await user.click(confirmar);
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("sem links de transição, não renderiza nada", () => {
    const { container } = render(<PasseEscolarAcoes passe={passe("CONCLUIDO")} quem="aluno" onChanged={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Página do aluno", () => {
  it("mostra o pedido em andamento com as etapas e esconde 'Pedir cadastro'", async () => {
    stubApi({
      "GET /school-passes": () => json(colecao([passe("CADASTRADO_PORTAL")], { create: { href: "/school-passes", method: "POST" } })),
    });
    render(<PasseEscolarAlunoPage />);

    expect(await screen.findByText("Pedido de 2026")).toBeInTheDocument();
    expect(screen.getByText("Cadastrado no portal da EMTU")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem", { name: "" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /Pedir cadastro/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Ver detalhes/ })).toHaveAttribute("href", "/aluno/passe-escolar/passe_1");
  });

  it("sem pedido em andamento, oferece 'Pedir cadastro' quando a API dá o link create", async () => {
    stubApi({
      "GET /school-passes": () => json(colecao([passe("CANCELADO")], { create: { href: "/school-passes", method: "POST" } })),
    });
    render(<PasseEscolarAlunoPage />);

    expect(await screen.findByText("Você não tem pedido em andamento")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Pedir cadastro/ })[0]).toHaveAttribute("href", "/aluno/passe-escolar/novo");
    expect(screen.getByText("Pedidos anteriores")).toBeInTheDocument();
  });
});

describe("Página da secretaria", () => {
  it("lista por padrão só o ano atual em andamento e oferece exportar", async () => {
    const ano = new Date().getFullYear();
    const api = stubApi({
      "GET /school-passes": () =>
        json(colecao([passe("SOLICITADO", { usuario: { id: "aluno-1", nome: "Maria", ra: "123" } })], { export: { href: "/school-passes/export" } })),
    });
    render(<AdminPasseEscolarPage />);

    expect(await screen.findByText("Maria da Silva")).toBeInTheDocument();
    expect(screen.getByText("R.A. 123")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Exportar CSV/ })).toBeInTheDocument();

    const url = new URL(String(api.fetchMock.mock.calls[0][0]), "https://x");
    expect(url.searchParams.get("ativos")).toBe("true");
    expect(url.searchParams.get("ano")).toBe(String(ano));
  });
});
