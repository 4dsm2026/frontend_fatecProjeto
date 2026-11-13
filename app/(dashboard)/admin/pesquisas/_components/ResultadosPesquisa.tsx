"use client";

import { useCallback, useEffect, useState } from "react";
import { EyeOff, Loader2 } from "lucide-react";
import { API_BASE, apiFetch, extractApiError } from "../../../../../utils/api";
import { getLink, type HalResource } from "../../../../../utils/hal";
import { ESCALA, agruparPorSecao, percentual, type Resultados, type ResultadoPergunta } from "../../../../../utils/pesquisas";
import Alert from "../../../../components/ui/Alert";
import Card from "../../../../components/ui/Card";

const CORES_ESCALA = ["bg-[var(--destructive)]", "bg-[var(--warning)]", "bg-zinc-400", "bg-[var(--brand-teal)]", "bg-[var(--success)]"];

function Barra({ valor, total, cor = "bg-[var(--brand-teal)]" }: Readonly<{ valor: number; total: number; cor?: string }>) {
  return (
    <div className="h-2 w-full overflow-hidden rounded bg-[var(--muted)]" aria-hidden>
      <div className={`h-full rounded ${cor}`} style={{ width: `${percentual(valor, total)}%` }} />
    </div>
  );
}

function ResultadoEscala({ p }: Readonly<{ p: ResultadoPergunta }>) {
  const avaliaram = p.respostas - (p.naoSei ?? 0);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="font-grotesk text-2xl font-semibold">{p.media == null ? "—" : p.media.toFixed(1).replace(".", ",")}</span>
        <span className="text-xs text-muted-foreground">
          média de 5 · {avaliaram} avaliaram{p.naoSei ? ` · ${p.naoSei} não souberam` : ""}
        </span>
      </div>
      {/* Uma barra só, dividida pelas notas de 1 a 5 */}
      <div className="flex h-3 w-full overflow-hidden rounded bg-[var(--muted)]" role="img" aria-label={ESCALA.map((e) => `${e.rotulo}: ${p.distribuicao?.[String(e.valor)] ?? 0}`).join(", ")}>
        {ESCALA.map((e, i) => (
          <div key={e.valor} className={CORES_ESCALA[i]} style={{ width: `${percentual(p.distribuicao?.[String(e.valor)] ?? 0, avaliaram)}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {ESCALA.map((e, i) => (
          <span key={e.valor} className="inline-flex items-center gap-1">
            <span className={`inline-block size-2 rounded-full ${CORES_ESCALA[i]}`} aria-hidden />
            {e.rotulo}: {p.distribuicao?.[String(e.valor)] ?? 0}
          </span>
        ))}
      </div>
    </div>
  );
}

function ResultadoPerguntaView({ p }: Readonly<{ p: ResultadoPergunta }>) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">
        {p.ordem}. {p.texto}
      </div>
      {p.tipo === "ESCALA" && <ResultadoEscala p={p} />}
      {p.tipo === "MULTIPLA" && (
        <ul className="space-y-2">
          {(p.opcoes ?? []).map((o) => (
            <li key={o.opcao} className="space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <span>{o.opcao}</span>
                <span className="text-muted-foreground">
                  {o.total} · {percentual(o.total, p.respostas)}%
                </span>
              </div>
              <Barra valor={o.total} total={p.respostas} />
            </li>
          ))}
        </ul>
      )}
      {p.tipo === "TEXTO" &&
        ((p.textos ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguém respondeu.</p>
        ) : (
          <details>
            <summary className="cursor-pointer text-sm text-primary">{p.textos?.length} resposta(s) abertas</summary>
            <ul className="mt-2 space-y-2">
              {(p.textos ?? []).map((t, i) => (
                <li key={`${i}-${t.slice(0, 12)}`} className="rounded-md border border-[var(--border)] px-3 py-2 text-sm whitespace-pre-wrap break-words">
                  {t}
                </li>
              ))}
            </ul>
          </details>
        ))}
    </div>
  );
}

/** Resultados agregados de uma pesquisa, com recorte por curso. */
export default function ResultadosPesquisa({ pesquisa }: Readonly<{ pesquisa: HalResource }>) {
  const [curso, setCurso] = useState("");
  const [dados, setDados] = useState<Resultados | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const href = getLink(pesquisa, "results")?.href;

  const load = useCallback(async () => {
    if (!href) return;
    try {
      setLoading(true);
      const qs = curso ? `?${new URLSearchParams({ curso })}` : "";
      const res = await apiFetch(`${API_BASE}${href}${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await extractApiError(res, "Não foi possível carregar os resultados."));
      setDados((await res.json()) as Resultados);
      setErro(null);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os resultados.");
    } finally {
      setLoading(false);
    }
  }, [href, curso]);

  useEffect(() => {
    load();
  }, [load]);

  if (!href) return <Alert variant="info">Os resultados aparecem depois que a pesquisa é aberta.</Alert>;
  if (erro) return <Alert variant="error">{erro}</Alert>;
  if (!dados) {
    return (
      <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" /> Carregando…
      </div>
    );
  }

  const totalGeral = dados.participacao.reduce((s, p) => s + p.respondentes, 0);
  const elegiveisGeral = dados.participacao.reduce((s, p) => s + p.elegiveis, 0);

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-sm font-semibold">Participação por curso</div>
          <div className="text-sm text-muted-foreground">
            {totalGeral} de {elegiveisGeral} alunos · {percentual(totalGeral, elegiveisGeral)}%
          </div>
        </div>
        <ul className="space-y-3">
          {dados.participacao.map((p) => (
            <li key={p.curso} className="space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <span className="min-w-0 truncate">{p.curso}</span>
                <span className="shrink-0 text-muted-foreground">
                  {p.respondentes} de {p.elegiveis} · {percentual(p.respondentes, p.elegiveis)}%
                </span>
              </div>
              <Barra valor={p.respondentes} total={p.elegiveis} />
            </li>
          ))}
          {dados.participacao.length === 0 && <li className="text-sm text-muted-foreground">Nenhum aluno ativo no público desta pesquisa.</li>}
        </ul>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="recorte-curso" className="text-sm font-medium">
          Ver respostas de
        </label>
        <select
          id="recorte-curso"
          className="h-9 rounded-lg border border-[var(--border)] bg-input px-2 text-sm"
          value={curso}
          onChange={(e) => setCurso(e.target.value)}
        >
          <option value="">Todos os cursos</option>
          {dados.participacao.map((p) => (
            <option key={p.curso} value={p.curso}>
              {p.curso}
            </option>
          ))}
        </select>
        {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>

      {dados.suprimido ? (
        <Card className="flex items-start gap-3">
          <EyeOff className="size-5 shrink-0 text-muted-foreground mt-0.5" />
          <div className="text-sm">
            <div className="font-medium">
              Respostas insuficientes para exibir ({dados.totalRespostas} de no mínimo {dados.minimo})
            </div>
            <p className="text-muted-foreground">
              Com poucas respostas, daria para deduzir quem respondeu o quê. Os resultados {dados.curso ? "deste curso" : "da pesquisa"} aparecem
              a partir de {dados.minimo} respostas.
            </p>
          </div>
        </Card>
      ) : (
        agruparPorSecao(dados.perguntas).map((grupo) => (
          <Card key={`${grupo.secao}-${grupo.itens[0]?.id}`} className="space-y-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{grupo.secao}</h3>
            {grupo.itens.map((p) => (
              <ResultadoPerguntaView key={p.id} p={p} />
            ))}
          </Card>
        ))
      )}
    </div>
  );
}
