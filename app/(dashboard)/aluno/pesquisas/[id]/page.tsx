"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, ChevronLeft, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, apiFetch, extractApiError } from "../../../../../utils/api";
import { followLink, hasLink } from "../../../../../utils/hal";
import {
  ESCALA,
  ESCALA_NAO_SEI,
  agruparPorSecao,
  perguntasFaltando,
  semestreLegivel,
  type Pergunta,
  type Pesquisa,
  type ValorResposta,
} from "../../../../../utils/pesquisas";
import { cx } from "../../../../../utils/cx";
import BetaBadge from "../../../../components/shared/BetaBadge";
import Alert from "../../../../components/ui/Alert";
import Card from "../../../../components/ui/Card";

const TEXTO_MAX = 1000;

function CampoPergunta({
  pergunta,
  numero,
  valor,
  faltando,
  onChange,
}: Readonly<{
  pergunta: Pergunta;
  numero: number;
  valor: ValorResposta | undefined;
  faltando: boolean;
  onChange: (v: ValorResposta | undefined) => void;
}>) {
  const nome = `p-${pergunta.id}`;
  const opcao = "cursor-pointer rounded-md border px-3 py-2 text-sm transition has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--ring)]";

  return (
    <fieldset className={cx("space-y-2 rounded-lg p-3 -mx-3", faltando && "bg-[var(--destructive)]/5")} id={nome}>
      <legend className="text-sm font-medium">
        {numero}. {pergunta.texto}
        {!pergunta.obrigatoria && <span className="font-normal text-muted-foreground"> (opcional)</span>}
      </legend>

      {pergunta.tipo === "ESCALA" && (
        <div className="flex flex-wrap gap-2">
          {ESCALA.map((e) => (
            <label key={e.valor} className={cx(opcao, "border-[var(--border)]")}>
              <input type="radio" className="sr-only" name={nome} checked={valor === e.valor} onChange={() => onChange(e.valor)} />
              {e.valor} · {e.rotulo}
            </label>
          ))}
          <label className={cx(opcao, "border-dashed border-[var(--border)] text-muted-foreground")}>
            <input type="radio" className="sr-only" name={nome} checked={valor === ESCALA_NAO_SEI} onChange={() => onChange(ESCALA_NAO_SEI)} />
            Não sei / não se aplica
          </label>
        </div>
      )}

      {pergunta.tipo === "MULTIPLA" && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {(pergunta.opcoes ?? []).map((o) => (
            <label key={o} className={cx(opcao, "border-[var(--border)]")}>
              <input type="radio" className="sr-only" name={nome} checked={valor === o} onChange={() => onChange(o)} />
              {o}
            </label>
          ))}
        </div>
      )}

      {pergunta.tipo === "TEXTO" && (
        <textarea
          aria-label={pergunta.texto}
          rows={3}
          maxLength={TEXTO_MAX}
          value={typeof valor === "string" ? valor : ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder="Evite citar nomes ou dados que identifiquem você."
          className="w-full rounded-lg border border-[var(--border)] bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
        />
      )}

      {faltando && (
        <p className="text-xs text-destructive" role="alert">
          Esta pergunta é obrigatória.
        </p>
      )}
    </fieldset>
  );
}

export default function ResponderPesquisaPage() {
  const params = useParams();
  const id = params?.id as string;

  const [pesquisa, setPesquisa] = useState<Pesquisa | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Record<string, ValorResposta>>({});
  const [faltando, setFaltando] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const res = await apiFetch(`${API_BASE}/surveys/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!res.ok) {
          setErro(res.status === 404 ? "Pesquisa não encontrada ou não disponível para o seu curso." : await extractApiError(res, "Não foi possível carregar a pesquisa."));
          return;
        }
        setPesquisa((await res.json()) as Pesquisa);
      } catch {
        setErro("Não foi possível carregar a pesquisa.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const perguntas = pesquisa?.perguntas ?? [];
  const respondidas = perguntas.filter((p) => p.id && respostas[p.id] !== undefined && respostas[p.id] !== "").length;

  function responder(perguntaId: string, valor: ValorResposta | undefined) {
    setRespostas((atual) => {
      const novo = { ...atual };
      if (valor === undefined) delete novo[perguntaId];
      else novo[perguntaId] = valor;
      return novo;
    });
    setFaltando((f) => f.filter((x) => x !== perguntaId));
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!pesquisa) return;
    const pendentes = perguntasFaltando(perguntas, respostas);
    setFaltando(pendentes);
    if (pendentes.length) {
      toast.error(`Falta responder ${pendentes.length} pergunta(s) obrigatória(s).`);
      document.getElementById(`p-${pendentes[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    try {
      setEnviando(true);
      const res = await followLink(pesquisa, "respond", { body: JSON.stringify({ respostas }) });
      if (!res.ok) throw new Error(await extractApiError(res, "Não foi possível enviar suas respostas."));
      setEnviada(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar suas respostas.");
    } finally {
      setEnviando(false);
    }
  }

  const jaRespondeu = enviada || pesquisa?.respondida;
  const podeResponder = hasLink(pesquisa, "respond") && !enviada;
  const numeroDe = new Map(perguntas.map((p, i) => [p.id, i + 1]));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/aluno/pesquisas" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ChevronLeft className="size-4" /> Pesquisa institucional
        </Link>
        <h1 className="font-grotesk text-2xl font-semibold tracking-tight flex flex-wrap items-center gap-2 mt-1">
          {pesquisa?.titulo ?? "Pesquisa"} <BetaBadge />
        </h1>
        {pesquisa && <p className="text-sm text-muted-foreground mt-1">{semestreLegivel(pesquisa.semestre)}</p>}
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      )}
      {erro && <Alert variant="error">{erro}</Alert>}

      {pesquisa && jaRespondeu && (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="size-10 text-[var(--success)]" />
          <div className="font-medium">Resposta registrada. Obrigado!</div>
          <p className="max-w-md text-sm text-muted-foreground">
            Suas respostas foram guardadas de forma anônima. A CPA divulga os resultados consolidados depois do
            encerramento.
          </p>
          <Link href="/aluno/pesquisas" className="text-sm font-medium text-primary hover:underline">
            Voltar
          </Link>
        </Card>
      )}

      {pesquisa && !jaRespondeu && !podeResponder && <Alert variant="info">Esta pesquisa não está mais recebendo respostas.</Alert>}

      {pesquisa && podeResponder && (
        <form onSubmit={enviar} className="space-y-6" noValidate>
          {pesquisa.descricao && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{pesquisa.descricao}</p>}
          <Alert variant="success">
            <span className="font-medium">Anônima:</span>{" "}
            as respostas são guardadas sem o seu nome, RA ou horário. Só é possível enviar uma vez.
          </Alert>

          {agruparPorSecao(perguntas).map((grupo) => (
            <Card key={`${grupo.secao}-${grupo.itens[0]?.id}`} className="space-y-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{grupo.secao}</h2>
              {grupo.itens.map((p) => {
                const pid = p.id as string;
                return (
                  <CampoPergunta
                    key={pid}
                    pergunta={p}
                    numero={numeroDe.get(p.id) ?? 0}
                    valor={respostas[pid]}
                    faltando={faltando.includes(pid)}
                    onChange={(v) => responder(pid, v)}
                  />
                );
              })}
            </Card>
          ))}

          <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-card px-4 py-3 shadow-lg">
            <span className="text-sm text-muted-foreground">
              {respondidas} de {perguntas.length} respondidas
            </span>
            <button
              type="submit"
              disabled={enviando}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Enviar respostas
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
