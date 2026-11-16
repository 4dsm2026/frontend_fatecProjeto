import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resetEntryCache } from "../utils/entry";
import { storeSession } from "../utils/session";
import { json, stubApi } from "./helpers-api";
import { contatosParaApi, descreverGatilho, emailValido, regraParaApi, validarRegra, REGRA_VAZIA, type CategoriaOpcao } from "../utils/roteamento";
import AdminRoteamentoPage from "../app/(dashboard)/admin/roteamento/page";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  resetEntryCache();
  storeSession({ accessToken: "roteamento-test-token" });
});

const CATEGORIAS: CategoriaOpcao[] = [
  {
    id: "manutencao",
    nome: "Manutenção",
    servicos: [
      { id: "manutencao-equipamento", nome: "Equipamento com defeito" },
      { id: "manutencao-predial", nome: "Manutenção predial" },
    ],
  },
  { id: "cat_academico", nome: "Acadêmico", servicos: [{ id: "svc_declaracao", nome: "Declaração" }] },
];

const SETORES = [
  { id: "setor_aux", nome: "Auxiliares Docentes" },
  { id: "setor_coord", nome: "Coordenação" },
  { id: "setor_adm", nome: "Administração" },
];

const REGRA = {
  id: "regra_manut_equipamento",
  nome: "Manutenção de equipamentos",
  ordem: 10,
  ativo: true,
  categoriaChave: "manutencao",
  servicoChave: "manutencao-equipamento",
  setorId: "setor_aux",
  setorCopiaId: "setor_coord",
  setor: SETORES[0],
  setorCopia: SETORES[1],
  _links: {
    update: { href: "/admin/routing-rules/regra_manut_equipamento", method: "PATCH" },
    delete: { href: "/admin/routing-rules/regra_manut_equipamento", method: "DELETE" },
  },
};

const HIERARQUIA = {
  id: "setor_adm",
  nome: "Administração",
  prazoEscalonamentoHoras: 24,
  contatos: [{ id: "c1", nivel: "PRIMEIRO", usuarioId: null, email: "zeladoria@fatec.sp.gov.br", nome: "Zeladoria", usuario: null }],
  _links: {},
};

function rotasBase(extra: Record<string, (init: RequestInit) => Response> = {}) {
  return stubApi({
    "GET /admin/routing-rules": () => json({ total: 1, _embedded: { "routing-rules": [REGRA] }, _links: {} }),
    "GET /admin/sectors": () => json({ _embedded: { sectors: SETORES }, page: { size: 100, number: 0, totalElements: 3, totalPages: 1 }, _links: {} }),
    "GET /catalog": () => json({ categorias: CATEGORIAS }),
    "GET /users": () => json({ _embedded: { users: [{ id: "u1", nome: "Ana Técnica", emailEducacional: "ana@fatec.sp.gov.br", papel: "TECNICO" }] }, _links: {} }),
    "GET /admin/sectors/setor_adm/routing": () => json(HIERARQUIA),
    ...extra,
  });
}

describe("utils/roteamento", () => {
  it("valida e-mail como o backend", () => {
    expect(emailValido("coord@fatec.sp.gov.br")).toBe(true);
    for (const e of ["zeladoria", "a@b", "a b@c.com", "x@y.com, z@w.com", "a@b.com."]) expect(emailValido(e)).toBe(false);
  });

  it("descreve o gatilho da regra pelos nomes do catálogo", () => {
    expect(descreverGatilho(REGRA, CATEGORIAS)).toBe("Manutenção › Equipamento com defeito");
    expect(descreverGatilho({ categoriaChave: "manutencao", servicoChave: null }, CATEGORIAS)).toBe("Manutenção");
    expect(descreverGatilho({ categoriaChave: "sumiu", servicoChave: null }, CATEGORIAS)).toBe("sumiu");
  });

  it("exige categoria ou serviço, destino e cópia diferente", () => {
    expect(validarRegra({ ...REGRA_VAZIA, nome: "XY", setorId: "s" })).toBe("Escolha a categoria ou o serviço.");
    expect(validarRegra({ ...REGRA_VAZIA, nome: "XY", categoriaChave: "c" })).toBe("Escolha o setor de destino.");
    expect(validarRegra({ ...REGRA_VAZIA, nome: "XY", categoriaChave: "c", setorId: "s", setorCopiaId: "s" })).toBe("O setor em cópia deve ser outro.");
    expect(validarRegra({ ...REGRA_VAZIA, nome: "XY", categoriaChave: "c", setorId: "s" })).toBeNull();
  });

  it("envia null nos campos vazios e contatos no formato da API", () => {
    expect(regraParaApi({ ...REGRA_VAZIA, nome: " X ", categoriaChave: "c", setorId: "s" })).toMatchObject({ nome: "X", servicoChave: null, setorCopiaId: null });
    expect(
      contatosParaApi([
        { nivel: "PRIMEIRO", usuarioId: "u1", email: null, nome: null },
        { nivel: "COPIA", usuarioId: null, email: " z@f.br ", nome: " " },
      ]),
    ).toEqual([
      { nivel: "PRIMEIRO", usuarioId: "u1" },
      { nivel: "COPIA", email: "z@f.br", nome: null },
    ]);
  });
});

describe("<AdminRoteamentoPage />", () => {
  it("lista as regras com o gatilho, o destino e a cópia", async () => {
    rotasBase();
    render(<AdminRoteamentoPage />);
    expect(await screen.findByText("Manutenção de equipamentos")).toBeInTheDocument();
    expect(await screen.findByText("Manutenção › Equipamento com defeito")).toBeInTheDocument();
    expect(screen.getByText("· cópia: Coordenação")).toBeInTheDocument();
  });

  it("cria uma regra para Manutenção predial → Administração", async () => {
    const corpos: unknown[] = [];
    rotasBase({
      "POST /admin/routing-rules": (init) => {
        corpos.push(JSON.parse(String(init.body)));
        return json({ ...REGRA, id: "nova" }, 201);
      },
    });
    const user = userEvent.setup();
    render(<AdminRoteamentoPage />);
    await screen.findByText("Manutenção de equipamentos");

    await user.click(screen.getByRole("button", { name: "Nova regra" }));
    const form = screen.getByRole("form", { name: "Nova regra" });
    await user.type(within(form).getByLabelText("Nome"), "Predial");
    await user.selectOptions(within(form).getByLabelText("Categoria"), "manutencao");
    await user.selectOptions(within(form).getByLabelText("Serviço"), "manutencao-predial");
    await user.selectOptions(within(form).getByLabelText("Vai para o setor"), "setor_adm");
    await user.click(within(form).getByRole("button", { name: "Salvar regra" }));

    await waitFor(() => expect(corpos).toHaveLength(1));
    expect(corpos[0]).toEqual({ nome: "Predial", ordem: 100, ativo: true, categoriaChave: "manutencao", servicoChave: "manutencao-predial", setorId: "setor_adm", setorCopiaId: null });
  });

  it("adiciona um e-mail avulso no 2º nível e salva a hierarquia", async () => {
    const corpos: { prazoEscalonamentoHoras: number | null; contatos: unknown[] }[] = [];
    rotasBase({
      "PUT /admin/sectors/setor_adm/routing": (init) => {
        const corpo = JSON.parse(String(init.body));
        corpos.push(corpo);
        return json({ ...HIERARQUIA, contatos: [] });
      },
    });
    const user = userEvent.setup();
    render(<AdminRoteamentoPage />);
    // setores em ordem alfabética: Administração vem primeiro
    expect(await screen.findByText("zeladoria@fatec.sp.gov.br")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar hierarquia" })).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("Nível"), "SEGUNDO");
    await user.selectOptions(screen.getByLabelText("Tipo"), "email");
    await user.type(screen.getByLabelText("E-mail"), "Diretoria@Fatec.sp.gov.br");
    await user.type(screen.getByLabelText("Nome (opcional)"), "Diretoria");
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    const segundo = screen.getByRole("region", { name: "2º nível" });
    expect(within(segundo).getByText("diretoria@fatec.sp.gov.br")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Salvar hierarquia" }));
    await waitFor(() => expect(corpos).toHaveLength(1));
    expect(corpos[0]).toEqual({
      prazoEscalonamentoHoras: 24,
      contatos: [
        { nivel: "PRIMEIRO", email: "zeladoria@fatec.sp.gov.br", nome: "Zeladoria" },
        { nivel: "SEGUNDO", email: "diretoria@fatec.sp.gov.br", nome: "Diretoria" },
      ],
    });
  });

  it("simula e avisa quando ninguém recebe e-mail", async () => {
    rotasBase({
      "POST /admin/routing-preview": () =>
        json({ setorId: "setor_aux", setorCopiaId: "setor_coord", regraId: REGRA.id, motivo: "Regra: Manutenção de equipamentos", setor: SETORES[0], setorCopia: SETORES[1], emails: [], usuarios: 0 }),
    });
    const user = userEvent.setup();
    render(<AdminRoteamentoPage />);
    await screen.findByText("Manutenção de equipamentos");
    const simular = screen.getByRole("heading", { name: "Simular" }).parentElement!;
    await user.selectOptions(within(simular).getByLabelText("Categoria"), "manutencao");
    await user.selectOptions(within(simular).getByLabelText("Serviço"), "manutencao-equipamento");
    await user.click(within(simular).getByRole("button", { name: "Simular" }));
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Vai para Auxiliares Docentes, com cópia para Coordenação.");
    expect(status).toHaveTextContent("Ninguém recebe e-mail na chegada");
  });

  it("para quem não é administrador, explica e não mostra a configuração", async () => {
    stubApi({
      "GET /admin/routing-rules": () => json({ type: "/errors/forbidden", title: "Proibido", status: 403 }, 403),
      "GET /admin/sectors": () => json({ _embedded: { sectors: [] }, _links: {} }),
      "GET /catalog": () => json({ categorias: [] }),
      "GET /users": () => json({ _embedded: { users: [] }, _links: {} }),
    });
    render(<AdminRoteamentoPage />);
    expect(await screen.findByText("Somente administradores configuram o roteamento.")).toBeInTheDocument();
    expect(screen.queryByText("Regras")).not.toBeInTheDocument();
  });
});
