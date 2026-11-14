import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resetEntryCache } from "../utils/entry";
import { storeSession } from "../utils/session";
import { json, stubApi } from "./helpers-api";
import {
  agruparPorSecao,
  errosDasPerguntas,
  percentual,
  perguntasFaltando,
  perguntasParaApi,
  proximoSemestre,
  semestreAtual,
  semestreLegivel,
  semestreValido,
  type Pergunta,
  type Pesquisa,
} from "../utils/pesquisas";
import PesquisasAlunoPage from "../app/(dashboard)/aluno/pesquisas/page";
import ResponderPesquisaPage from "../app/(dashboard)/aluno/pesquisas/[id]/page";
import AdminPesquisasPage from "../app/(dashboard)/admin/pesquisas/page";
import ResultadosPesquisa from "../app/(dashboard)/admin/pesquisas/_components/ResultadosPesquisa";
import EditorPerguntas from "../app/(dashboard)/admin/pesquisas/_components/EditorPerguntas";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "pesq_1" }),
  useRouter: () => ({ push }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

afterEach(cleanup);
beforeEach(() => {
  push.mockReset();
  localStorage.clear();
  resetEntryCache();
  storeSession({ accessToken: "pesquisa-test-token" });
  Element.prototype.scrollIntoView = vi.fn();
});

const PERGUNTAS: Pergunta[] = [
  { id: "q1", ordem: 1, secao: "Curso", texto: "As disciplinas contribuem?", tipo: "ESCALA", obrigatoria: true },
  { id: "q2", ordem: 2, secao: "Você", texto: "Pretende concluir?", tipo: "MULTIPLA", opcoes: ["Sim", "Não"], obrigatoria: true },
  { id: "q3", ordem: 3, secao: "Você", texto: "O que melhorar?", tipo: "TEXTO", obrigatoria: false },
];

function pesquisa(extra: Partial<Pesquisa> = {}): Pesquisa {
  return {
    id: "pesq_1",
    titulo: "Pesquisa CPA 2026-2",
    semestre: "2026-2",
    status: "ABERTA",
    cursos: null,
    aceitaRespostas: true,
    totalPerguntas: 3,
    totalRespostas: 12,
    perguntas: PERGUNTAS,
    _links: { self: { href: "/surveys/pesq_1" } },
    ...extra,
  };
}

const colecao = (itens: Pesquisa[], links: Record<string, { href: string; method?: string }> = {}) => ({
  _embedded: { surveys: itens },
  page: { size: 20, number: 0, totalElements: itens.length, totalPages: 1 },
  _links: { self: { href: "/surveys" }, ...links },
});

describe("utils/pesquisas", () => {
  it("semestres: valida, calcula o atual, o próximo e o texto legível", () => {
    expect(semestreValido("2026-2")).toBe(true);
    expect(semestreValido("2026-3")).toBe(false);
    expect(semestreAtual(new Date(2026, 10, 13))).toBe("2026-2");
    expect(semestreAtual(new Date(2026, 2, 1))).toBe("2026-1");
    expect(proximoSemestre("2026-2")).toBe("2027-1");
    expect(semestreLegivel("2026-2")).toBe("2º semestre de 2026");
  });

  it("percentual não divide por zero", () => {
    expect(percentual(5, 42)).toBe(12);
    expect(percentual(0, 0)).toBe(0);
  });

  it("agrupa por seção mantendo a ordem", () => {
    expect(agruparPorSecao(PERGUNTAS).map((g) => [g.secao, g.itens.length])).toEqual([["Curso", 1], ["Você", 2]]);
  });

  it("perguntasFaltando: 0 ('não sei') conta como respondida; opcional não falta", () => {
    expect(perguntasFaltando(PERGUNTAS, {})).toEqual(["q1", "q2"]);
    expect(perguntasFaltando(PERGUNTAS, { q1: 0, q2: "Sim" })).toEqual([]);
  });

  it("valida e prepara as perguntas do rascunho", () => {
    const ruins: Pergunta[] = [
      { texto: " ", tipo: "ESCALA", obrigatoria: true },
      { texto: "Qual?", tipo: "MULTIPLA", opcoes: ["A", " "], obrigatoria: true },
      { texto: "Qual?", tipo: "MULTIPLA", opcoes: ["A", "A"], obrigatoria: true },
    ];
    expect(errosDasPerguntas(ruins)).toHaveLength(3);
    expect(errosDasPerguntas(PERGUNTAS)).toEqual([]);
    expect(perguntasParaApi([{ texto: " Qual? ", secao: " ", tipo: "MULTIPLA", opcoes: ["A ", "", "B"], obrigatoria: true }])).toEqual([
      { secao: null, texto: "Qual?", tipo: "MULTIPLA", opcoes: ["A", "B"], obrigatoria: true },
    ]);
    expect(perguntasParaApi([PERGUNTAS[0]])[0].opcoes).toBeNull();
  });
});

describe("aluno — lista", () => {
  it("mostra 'Responder agora' só quando a API dá o link respond", async () => {
    stubApi({
      "GET /surveys": () =>
        json(
          colecao([
            pesquisa({ id: "a", titulo: "Aberta", _links: { respond: { href: "/surveys/a/responses", method: "POST" } } }),
            pesquisa({ id: "b", titulo: "Já respondi", respondida: true }),
          ]),
        ),
    });
    render(<PesquisasAlunoPage />);

    expect(await screen.findByText("Aberta")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Responder agora" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Responder agora" })).toHaveAttribute("href", "/aluno/pesquisas/a");
    expect(screen.getByText("Respondida")).toBeInTheDocument();
    expect(screen.getByText("Sua resposta é anônima")).toBeInTheDocument();
  });

  it("sem pesquisas, explica que o aluno será avisado", async () => {
    stubApi({ "GET /surveys": () => json(colecao([])) });
    render(<PesquisasAlunoPage />);
    expect(await screen.findByText("Nenhuma pesquisa aberta para o seu curso")).toBeInTheDocument();
  });
});

describe("aluno — responder", () => {
  const comLink = pesquisa({ _links: { self: { href: "/surveys/pesq_1" }, respond: { href: "/surveys/pesq_1/responses", method: "POST" } } });

  it("barra o envio com obrigatória em branco e envia as respostas pelo link", async () => {
    const user = userEvent.setup();
    let enviado: unknown = null;
    const api = stubApi({
      "GET /surveys/pesq_1": () => json(comLink),
      "POST /surveys/pesq_1/responses": (init) => {
        enviado = JSON.parse(String(init.body));
        return json({ respondida: true }, 201);
      },
    });
    render(<ResponderPesquisaPage />);

    await screen.findByText("1. As disciplinas contribuem?");
    expect(screen.getByText("0 de 3 respondidas")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Enviar respostas/ }));
    expect(screen.getAllByText("Esta pergunta é obrigatória.")).toHaveLength(2);
    expect(api.keys()).not.toContain("POST /surveys/pesq_1/responses");

    await user.click(screen.getByRole("radio", { name: /4 · Bom/ }));
    await user.click(screen.getByRole("radio", { name: "Sim" }));
    await user.type(screen.getByRole("textbox", { name: "O que melhorar?" }), "Wi-fi");
    expect(screen.getByText("3 de 3 respondidas")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Enviar respostas/ }));
    expect(await screen.findByText("Resposta registrada. Obrigado!")).toBeInTheDocument();
    expect(enviado).toEqual({ respostas: { q1: 4, q2: "Sim", q3: "Wi-fi" } });
  });

  it("'não sei' vale como resposta (envia 0)", async () => {
    const user = userEvent.setup();
    let enviado: { respostas?: Record<string, unknown> } = {};
    stubApi({
      "GET /surveys/pesq_1": () => json(comLink),
      "POST /surveys/pesq_1/responses": (init) => {
        enviado = JSON.parse(String(init.body));
        return json({ respondida: true }, 201);
      },
    });
    render(<ResponderPesquisaPage />);
    await screen.findByText("1. As disciplinas contribuem?");
    await user.click(screen.getByRole("radio", { name: "Não sei / não se aplica" }));
    await user.click(screen.getByRole("radio", { name: "Não" }));
    await user.click(screen.getByRole("button", { name: /Enviar respostas/ }));
    await waitFor(() => expect(enviado.respostas).toEqual({ q1: 0, q2: "Não" }));
  });

  it("quem já respondeu vê o agradecimento, não o formulário", async () => {
    stubApi({ "GET /surveys/pesq_1": () => json(pesquisa({ respondida: true })) });
    render(<ResponderPesquisaPage />);
    expect(await screen.findByText("Resposta registrada. Obrigado!")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Enviar respostas/ })).toBeNull();
  });
});

describe("equipe — edições por semestre", () => {
  it("sugere copiar a última edição para o próximo semestre e segue o link copy", async () => {
    const user = userEvent.setup();
    const atual = semestreAtual();
    let corpo: unknown = null;
    stubApi({
      "GET /surveys": () =>
        json(
          colecao(
            [pesquisa({ semestre: atual, titulo: `Pesquisa CPA ${atual}`, status: "ENCERRADA", _links: { copy: { href: "/surveys/pesq_1/copies", method: "POST" } } })],
            { create: { href: "/surveys", method: "POST" } },
          ),
        ),
      "POST /surveys/pesq_1/copies": (init) => {
        corpo = JSON.parse(String(init.body));
        return json(pesquisa({ id: "pesq_2", status: "RASCUNHO" }), 201);
      },
    });
    render(<AdminPesquisasPage />);

    expect(await screen.findByText(`Pesquisa CPA ${atual}`)).toBeInTheDocument();
    expect(screen.getByText(/12 respostas/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByPlaceholderText("2026-2")).toHaveValue(proximoSemestre(atual)));

    await user.click(screen.getByRole("button", { name: /Nova edição/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/pesquisas/pesq_2"));
    expect(corpo).toEqual({ semestre: proximoSemestre(atual) });
  });

  it("sem edição no semestre, avisa; sem link create (coordenação), não mostra o formulário", async () => {
    stubApi({ "GET /surveys": () => json(colecao([])) });
    render(<AdminPesquisasPage />);
    expect(await screen.findByText(/Ainda não há pesquisa do/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nova edição/ })).toBeNull();
  });
});

describe("equipe — resultados", () => {
  const recurso = { _links: { results: { href: "/surveys/pesq_1/results" } } };
  const participacao = [
    { curso: "COMEX", elegiveis: 30, respondentes: 1 },
    { curso: "DSM", elegiveis: 42, respondentes: 5 },
  ];

  it("mostra participação por curso, média e distribuição; o recorte pequeno vem suprimido", async () => {
    const user = userEvent.setup();
    const api = stubApi({
      "GET /surveys/pesq_1/results": () => {
        const url = new URL(String(api.fetchMock.mock.calls.at(-1)?.[0]), "https://x");
        if (url.searchParams.get("curso") === "COMEX") {
          return json({ pesquisaId: "pesq_1", curso: "COMEX", minimo: 5, totalRespostas: 1, totalElegiveis: 30, participacao, suprimido: true, perguntas: [] });
        }
        return json({
          pesquisaId: "pesq_1", curso: null, minimo: 5, totalRespostas: 6, totalElegiveis: 72, participacao, suprimido: false,
          perguntas: [
            { id: "q1", ordem: 1, secao: "Curso", texto: "As disciplinas contribuem?", tipo: "ESCALA", respostas: 6, media: 3.4, naoSei: 1, distribuicao: { "1": 1, "2": 0, "3": 1, "4": 2, "5": 1 } },
            { id: "q2", ordem: 2, secao: "Você", texto: "Pretende concluir?", tipo: "MULTIPLA", respostas: 6, opcoes: [{ opcao: "Sim", total: 4 }, { opcao: "Não", total: 2 }] },
            { id: "q3", ordem: 3, secao: "Você", texto: "O que melhorar?", tipo: "TEXTO", respostas: 2, textos: ["Biblioteca", "Wi-fi"] },
          ],
        });
      },
    });
    render(<ResultadosPesquisa pesquisa={recurso} />);

    expect(await screen.findByText("6 de 72 alunos · 8%")).toBeInTheDocument();
    expect(screen.getByText("5 de 42 · 12%")).toBeInTheDocument();
    expect(screen.getByText("3,4")).toBeInTheDocument();
    expect(screen.getByText(/5 avaliaram · 1 não souberam/)).toBeInTheDocument();
    expect(screen.getByText("4 · 67%")).toBeInTheDocument();
    expect(screen.getByText("2 resposta(s) abertas")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Ver respostas de"), "COMEX");
    expect(await screen.findByText(/Respostas insuficientes para exibir \(1 de no mínimo 5\)/)).toBeInTheDocument();
    expect(screen.queryByText("3,4")).toBeNull();
  });
});

describe("equipe — editor de perguntas", () => {
  it("adiciona, reordena e remove", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EditorPerguntas perguntas={PERGUNTAS} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Descer pergunta 1" }));
    expect(onChange.mock.calls[0][0].map((p: Pergunta) => p.id)).toEqual(["q2", "q1", "q3"]);

    await user.click(screen.getByRole("button", { name: "Remover pergunta 2" }));
    expect(onChange.mock.calls[1][0].map((p: Pergunta) => p.id)).toEqual(["q1", "q3"]);

    await user.click(screen.getByRole("button", { name: /Adicionar pergunta/ }));
    const novas = onChange.mock.calls[2][0] as Pergunta[];
    expect(novas).toHaveLength(4);
    expect(novas[3]).toMatchObject({ secao: "Você", tipo: "ESCALA", obrigatoria: true });

    expect(screen.getByRole("button", { name: "Subir pergunta 1" })).toBeDisabled();
    expect(within(screen.getByText("Pergunta 2").closest("div")!.parentElement!).getByLabelText("Opções da pergunta 2")).toHaveValue("Sim\nNão");
  });
});
