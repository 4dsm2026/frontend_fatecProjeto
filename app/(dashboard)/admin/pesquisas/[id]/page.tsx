"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Copy, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, apiFetch, extractApiError } from "../../../../../utils/api";
import { followLink, getLinks, hasLink } from "../../../../../utils/hal";
import {
  ACAO_STATUS_LABEL,
  TIPO_PERGUNTA_LABEL,
  agruparPorSecao,
  errosDasPerguntas,
  perguntasParaApi,
  proximoSemestre,
  semestreLegivel,
  type Pergunta,
  type Pesquisa,
  type StatusPesquisa,
} from "../../../../../utils/pesquisas";
import { cx } from "../../../../../utils/cx";
import BetaBadge from "../../../../components/shared/BetaBadge";
import PesquisaStatusBadge from "../../../../components/shared/PesquisaStatusBadge";
import Alert from "../../../../components/ui/Alert";
import Button from "../../../../components/ui/Button";
import Card from "../../../../components/ui/Card";
import ConfirmDialog from "../../../../components/ui/ConfirmDialog";
import EditorPerguntas from "../_components/EditorPerguntas";
import ResultadosPesquisa from "../_components/ResultadosPesquisa";

const INPUT = "w-full rounded-lg border border-[var(--border)] bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";

type Aba = "perguntas" | "resultados";
type CursoOpcao = { curso: string; alunos: number };
type Confirmacao = { titulo: string; descricao: string; rotulo: string; perigo?: boolean; acao: () => Promise<void> };

const DESCRICAO_STATUS: Record<StatusPesquisa, string> = {
  ABERTA: "Os alunos do público serão avisados e poderão responder. Depois de aberta, as perguntas não mudam mais.",
  ENCERRADA: "A pesquisa para de receber respostas. Os resultados continuam disponíveis e é possível reabrir.",
  RASCUNHO: "",
};

const dataParaInput = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("sv-SE") : "");

export default function AdminPesquisaDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [pesquisa, setPesquisa] = useState<Pesquisa | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("perguntas");
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);

  // Rascunho em edição
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prazo, setPrazo] = useState("");
  const [cursos, setCursos] = useState<string[]>([]);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [cursosDisponiveis, setCursosDisponiveis] = useState<CursoOpcao[]>([]);
  const [salvando, setSalvando] = useState(false);

  const aplicar = useCallback((p: Pesquisa) => {
    setPesquisa(p);
    setTitulo(p.titulo);
    setDescricao(p.descricao ?? "");
    setPrazo(dataParaInput(p.fechaEm));
    setCursos(p.cursos ?? []);
    setPerguntas(p.perguntas ?? []);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await apiFetch(`${API_BASE}/surveys/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!res.ok) {
        setErro(res.status === 404 ? "Pesquisa não encontrada." : await extractApiError(res, "Não foi possível carregar a pesquisa."));
        return;
      }
      aplicar((await res.json()) as Pesquisa);
      setErro(null);
    } catch {
      setErro("Não foi possível carregar a pesquisa.");
    } finally {
      setLoading(false);
    }
  }, [id, aplicar]);

  useEffect(() => {
    load().then(() => undefined);
  }, [load]);

  // Abre na aba que faz sentido para o estado da pesquisa.
  const status = pesquisa?.status;
  useEffect(() => {
    if (status) setAba(status === "RASCUNHO" ? "perguntas" : "resultados");
  }, [status]);

  useEffect(() => {
    apiFetch(`${API_BASE}/surveys/courses`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { cursos?: CursoOpcao[] } | null) => setCursosDisponiveis(d?.cursos ?? []))
      .catch(() => {});
  }, []);

  const editavel = hasLink(pesquisa, "update");

  async function salvar() {
    if (!pesquisa) return;
    const erros = errosDasPerguntas(perguntas);
    if (titulo.trim().length < 3) erros.unshift("Informe o título.");
    if (erros.length) {
      toast.error(erros[0], erros.length > 1 ? { description: `E mais ${erros.length - 1} problema(s).` } : undefined);
      return;
    }
    try {
      setSalvando(true);
      const res = await followLink(pesquisa, "update", {
        body: JSON.stringify({
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          fechaEm: prazo ? new Date(`${prazo}T23:59:59`).toISOString() : null,
          cursos: cursos.length ? cursos : null,
          perguntas: perguntasParaApi(perguntas),
        }),
      });
      if (!res.ok) throw new Error(await extractApiError(res, "Não foi possível salvar."));
      aplicar((await res.json()) as Pesquisa);
      toast.success("Rascunho salvo.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  /** Executa uma ação pelo link e trata o erro; lançar mantém o diálogo aberto. */
  async function executar(rel: string, opcoes: { name?: string; body?: object }, sucesso: string, depois: (res: Response) => Promise<void>) {
    if (!pesquisa) return;
    try {
      const res = await followLink(pesquisa, rel, { name: opcoes.name, body: opcoes.body ? JSON.stringify(opcoes.body) : undefined });
      if (!res.ok) throw new Error(await extractApiError(res, "Não foi possível concluir a ação."));
      toast.success(sucesso);
      await depois(res);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir a ação.");
      throw e;
    }
  }

  function pedirTransicao(para: StatusPesquisa) {
    if (!pesquisa) return;
    const rotulo = ACAO_STATUS_LABEL[pesquisa.status][para] ?? para;
    setConfirmacao({
      titulo: rotulo,
      descricao: DESCRICAO_STATUS[para],
      rotulo,
      perigo: para === "ENCERRADA",
      acao: () => executar("transition", { name: para, body: { status: para } }, "Status atualizado.", async (res) => aplicar((await res.json()) as Pesquisa)),
    });
  }

  function pedirCopia() {
    if (!pesquisa) return;
    const destino = proximoSemestre(pesquisa.semestre);
    setConfirmacao({
      titulo: `Copiar para ${destino}`,
      descricao: `Cria um rascunho para o ${semestreLegivel(destino)} com as mesmas perguntas e o mesmo público. Nenhuma resposta é copiada.`,
      rotulo: "Criar cópia",
      acao: () =>
        executar("copy", { body: { semestre: destino } }, "Cópia criada como rascunho.", async (res) => {
          const nova = (await res.json()) as Pesquisa;
          router.push(`/admin/pesquisas/${nova.id}`);
        }),
    });
  }

  function pedirExclusao() {
    setConfirmacao({
      titulo: "Excluir rascunho",
      descricao: "O rascunho e suas perguntas serão apagados. Esta ação não pode ser desfeita.",
      rotulo: "Excluir",
      perigo: true,
      acao: () => executar("delete", {}, "Rascunho excluído.", async () => router.push("/admin/pesquisas")),
    });
  }

  const transicoes = getLinks(pesquisa, "transition").map((l) => l.name as StatusPesquisa);
  const alterouAlgo =
    !!pesquisa &&
    (titulo !== pesquisa.titulo ||
      descricao !== (pesquisa.descricao ?? "") ||
      prazo !== dataParaInput(pesquisa.fechaEm) ||
      JSON.stringify(cursos) !== JSON.stringify(pesquisa.cursos ?? []) ||
      JSON.stringify(perguntasParaApi(perguntas)) !== JSON.stringify(perguntasParaApi(pesquisa.perguntas ?? [])));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/admin/pesquisas" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ChevronLeft className="size-4" /> Pesquisa institucional
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-grotesk text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
              {pesquisa?.titulo ?? "Pesquisa"} <BetaBadge />
            </h1>
            {pesquisa && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {semestreLegivel(pesquisa.semestre)}
                {pesquisa.cursos?.length ? ` · ${pesquisa.cursos.join(", ")}` : " · todos os cursos"}
                {pesquisa.fechaEm ? ` · prazo ${new Date(pesquisa.fechaEm).toLocaleDateString("pt-BR")}` : ""}
                {pesquisa.status !== "RASCUNHO" ? ` · ${pesquisa.totalRespostas ?? 0} respostas` : ""}
              </div>
            )}
          </div>
          {pesquisa && <PesquisaStatusBadge status={pesquisa.status} />}
        </div>
      </div>

      {loading && !pesquisa && (
        <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      )}
      {erro && <Alert variant="error">{erro}</Alert>}

      {pesquisa && (
        <>
          {pesquisa.status === "ABERTA" && !pesquisa.aceitaRespostas && (
            <Alert variant="warning">O prazo terminou: a pesquisa não recebe mais respostas. Encerre-a ou reabra com novo prazo.</Alert>
          )}

          {(transicoes.length > 0 || hasLink(pesquisa, "copy") || hasLink(pesquisa, "delete")) && (
            <div className="flex flex-wrap gap-2">
              {transicoes.map((para) => (
                <Button key={para} variant={para === "ENCERRADA" ? "secondary" : "primary"} onClick={() => pedirTransicao(para)} disabled={editavel && alterouAlgo} title={editavel && alterouAlgo ? "Salve o rascunho antes" : undefined}>
                  {ACAO_STATUS_LABEL[pesquisa.status][para] ?? para}
                </Button>
              ))}
              {hasLink(pesquisa, "copy") && (
                <Button variant="secondary" icon={<Copy className="size-4" />} onClick={pedirCopia}>
                  Copiar para {proximoSemestre(pesquisa.semestre)}
                </Button>
              )}
              {hasLink(pesquisa, "delete") && (
                <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={pedirExclusao}>
                  Excluir rascunho
                </Button>
              )}
            </div>
          )}

          <div className="flex gap-1 border-b border-[var(--border)]" role="tablist">
            {(["perguntas", "resultados"] as Aba[]).map((a) => (
              <button
                key={a}
                type="button"
                role="tab"
                aria-selected={aba === a}
                onClick={() => setAba(a)}
                className={cx(
                  "px-4 py-2 text-sm font-medium border-b-2 -mb-px",
                  aba === a ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {a === "perguntas" ? `Perguntas (${perguntas.length})` : "Resultados"}
              </button>
            ))}
          </div>

          {aba === "resultados" && <ResultadosPesquisa pesquisa={pesquisa} />}

          {aba === "perguntas" && editavel && (
            <>
              <Card className="space-y-4">
                <div className="text-sm font-semibold">Configuração</div>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Título</span>
                    <input className={INPUT} value={titulo} maxLength={160} onChange={(e) => setTitulo(e.target.value)} />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Prazo para responder</span>
                    <input className={INPUT} type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
                  </label>
                </div>
                <label className="space-y-1 text-sm block">
                  <span className="font-medium">Texto de apresentação (opcional)</span>
                  <textarea className={`${INPUT} resize-none`} rows={2} maxLength={2000} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
                </label>
                <fieldset className="space-y-2 text-sm">
                  <legend className="font-medium">Quem responde</legend>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="size-4" checked={cursos.length === 0} onChange={() => setCursos([])} />
                    Todos os cursos
                  </label>
                  {cursosDisponiveis.map((c) => (
                    <label key={c.curso} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={cursos.includes(c.curso)}
                        onChange={(e) => setCursos(e.target.checked ? [...cursos, c.curso] : cursos.filter((x) => x !== c.curso))}
                      />
                      {c.curso} <span className="text-muted-foreground">· {c.alunos} aluno(s)</span>
                    </label>
                  ))}
                  <p className="text-xs text-muted-foreground">Os cursos vêm do cadastro dos alunos ativos. Os resultados sempre aparecem separados por curso.</p>
                </fieldset>
              </Card>

              <Card className="space-y-4">
                <div className="text-sm font-semibold">Perguntas</div>
                <EditorPerguntas perguntas={perguntas} onChange={setPerguntas} />
              </Card>

              <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-card px-4 py-3 shadow-lg">
                <span className="text-sm text-muted-foreground">{alterouAlgo ? "Há alterações não salvas." : "Tudo salvo."}</span>
                <Button icon={<Save className="size-4" />} loading={salvando} disabled={!alterouAlgo} onClick={salvar}>
                  Salvar rascunho
                </Button>
              </div>
            </>
          )}

          {aba === "perguntas" && !editavel && (
            <>
              {pesquisa.status !== "RASCUNHO" && (
                <Alert variant="info">As perguntas não mudam depois que a pesquisa é aberta. Para ajustar, copie para uma nova edição.</Alert>
              )}
              {agruparPorSecao(perguntas).map((grupo) => (
                <Card key={`${grupo.secao}-${grupo.itens[0]?.id}`} className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{grupo.secao}</h3>
                  <ol className="space-y-2">
                    {grupo.itens.map((p) => (
                      <li key={p.id} className="text-sm">
                        <span className="font-medium">
                          {p.ordem}. {p.texto}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · {TIPO_PERGUNTA_LABEL[p.tipo]}
                          {p.tipo === "MULTIPLA" ? `: ${(p.opcoes ?? []).join(" / ")}` : ""}
                          {p.obrigatoria ? "" : " · opcional"}
                        </span>
                      </li>
                    ))}
                  </ol>
                </Card>
              ))}
            </>
          )}
        </>
      )}

      {confirmacao && (
        <ConfirmDialog
          open
          title={confirmacao.titulo}
          description={confirmacao.descricao}
          confirmLabel={confirmacao.rotulo}
          variant={confirmacao.perigo ? "danger" : "default"}
          onConfirm={confirmacao.acao}
          onClose={() => setConfirmacao(null)}
        />
      )}
    </div>
  );
}
