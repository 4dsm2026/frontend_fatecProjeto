"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { TIPO_PERGUNTA_LABEL, type Pergunta, type TipoPergunta } from "../../../../../utils/pesquisas";

const INPUT =
  "w-full rounded-lg border border-[var(--border)] bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";
const ICONE = "inline-grid size-8 place-items-center rounded-md border border-[var(--border)] hover:bg-[var(--muted)] disabled:opacity-40";

type Props = Readonly<{
  perguntas: Pergunta[];
  onChange: (perguntas: Pergunta[]) => void;
}>;

/** Editor da lista de perguntas de um rascunho. A ordem da lista é a ordem da pesquisa. */
export default function EditorPerguntas({ perguntas, onChange }: Props) {
  function alterar(i: number, mudanca: Partial<Pergunta>) {
    onChange(perguntas.map((p, j) => (j === i ? { ...p, ...mudanca } : p)));
  }
  function mover(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= perguntas.length) return;
    const nova = [...perguntas];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    onChange(nova);
  }
  function adicionar() {
    const secao = perguntas[perguntas.length - 1]?.secao ?? "";
    onChange([...perguntas, { secao, texto: "", tipo: "ESCALA", opcoes: null, obrigatoria: true }]);
  }

  return (
    <div className="space-y-3">
      {perguntas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pergunta ainda.</p>}

      {perguntas.map((p, i) => (
        <div key={p.id ?? `nova-${i}`} className="rounded-lg border border-[var(--border)] p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Pergunta {i + 1}</span>
            <div className="flex gap-1">
              <button type="button" className={ICONE} onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir pergunta ${i + 1}`}>
                <ArrowUp className="size-4" />
              </button>
              <button type="button" className={ICONE} onClick={() => mover(i, 1)} disabled={i === perguntas.length - 1} aria-label={`Descer pergunta ${i + 1}`}>
                <ArrowDown className="size-4" />
              </button>
              <button type="button" className={ICONE} onClick={() => onChange(perguntas.filter((_, j) => j !== i))} aria-label={`Remover pergunta ${i + 1}`}>
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>

          <textarea
            aria-label={`Texto da pergunta ${i + 1}`}
            className={`${INPUT} resize-none`}
            rows={2}
            maxLength={300}
            placeholder="Texto da pergunta"
            value={p.texto}
            onChange={(e) => alterar(i, { texto: e.target.value })}
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <input
              aria-label={`Seção da pergunta ${i + 1}`}
              className={INPUT}
              maxLength={80}
              placeholder="Seção (ex.: Infraestrutura)"
              value={p.secao ?? ""}
              onChange={(e) => alterar(i, { secao: e.target.value })}
            />
            <select
              aria-label={`Tipo da pergunta ${i + 1}`}
              className={INPUT}
              value={p.tipo}
              onChange={(e) => alterar(i, { tipo: e.target.value as TipoPergunta })}
            >
              {(Object.keys(TIPO_PERGUNTA_LABEL) as TipoPergunta[]).map((t) => (
                <option key={t} value={t}>
                  {TIPO_PERGUNTA_LABEL[t]}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4" checked={p.obrigatoria} onChange={(e) => alterar(i, { obrigatoria: e.target.checked })} />
              Obrigatória
            </label>
          </div>

          {p.tipo === "MULTIPLA" && (
            <textarea
              aria-label={`Opções da pergunta ${i + 1}`}
              className={`${INPUT} resize-none`}
              rows={Math.max(3, (p.opcoes ?? []).length + 1)}
              placeholder="Uma opção por linha"
              value={(p.opcoes ?? []).join("\n")}
              onChange={(e) => alterar(i, { opcoes: e.target.value.split("\n") })}
            />
          )}
        </div>
      ))}

      <button type="button" onClick={adicionar} className="inline-flex h-9 items-center gap-2 rounded-md border border-dashed border-[var(--border)] px-3 text-sm hover:bg-[var(--muted)]">
        <Plus className="size-4" /> Adicionar pergunta
      </button>
    </div>
  );
}
