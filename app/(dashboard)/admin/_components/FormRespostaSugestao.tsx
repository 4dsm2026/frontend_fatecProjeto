"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { extractApiError } from "../../../../utils/api";
import { followLink } from "../../../../utils/hal";
import type { HalResource } from "../../../../utils/hal";
import SugestaoEditor, { type SugestaoEditorValor } from "../../../components/shared/SugestaoEditor";
import SugestaoDocumentoView from "../../../components/shared/SugestaoDocumentoView";
import type { JSONContent } from "@tiptap/react";

const RESPOSTA_MAX = 500;

type StatusSugestao = "NAO_RESPONDIDO" | "RESPONDIDO";

type Props = Readonly<{
  sugestao: HalResource | null;
  resposta: string;
  respostaDocumento: JSONContent | null;
  onRespostaChange: (value: SugestaoEditorValor) => void;
  status: StatusSugestao;
  respostaBloqueada: boolean;
  statusBloqueado: boolean;
  statusFinal: boolean;
  respostaJaSalva: boolean;
  onSaved: () => Promise<void> | void;
}>;

export default function FormRespostaSugestao({
  sugestao,
  resposta,
  respostaDocumento,
  onRespostaChange,
  status,
  respostaBloqueada,
  statusBloqueado,
  statusFinal,
  respostaJaSalva,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);

  async function handleSalvar() {
    const texto = resposta.trim();

    if (!texto) {
      toast.error("Escreva uma resposta antes de salvar.");
      return;
    }
    if (texto.length > RESPOSTA_MAX) {
      toast.error(`A resposta deve ter no máximo ${RESPOSTA_MAX} caracteres.`);
      return;
    }

    setSaving(true);

    try {
      const res = await followLink(sugestao, "answer", {
        body: JSON.stringify({ resposta: texto, ...(respostaDocumento ? { respostaDocumento } : {}) }),
      });

      if (!res.ok) {
        throw new Error(await extractApiError(res, "Falha ao salvar."));
      }

      toast.success("Sugestão atualizada!");
      await onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-card p-5 space-y-3">
      <div className="space-y-1 text-sm">
        <span className="font-medium">
          Resposta do funcionário/professor
        </span>

        {respostaJaSalva ? (
          <SugestaoDocumentoView documento={respostaDocumento} conteudo={resposta} />
        ) : (
          <SugestaoEditor disabled={respostaBloqueada} onChange={onRespostaChange} />
        )}

        <span className="block text-right text-xs text-muted-foreground">
          {resposta.length}/{RESPOSTA_MAX}
        </span>

        {respostaBloqueada && (
          <span className="block text-xs text-muted-foreground">
            {statusFinal
              ? "Sugestão respondida: a resposta não pode mais ser alterada."
              : "Esta resposta já foi salva e não pode mais ser editada."}
          </span>
        )}
      </div>

      <p className="text-sm">Status: {status === "RESPONDIDO" ? "Respondido" : "Não respondido"}. Ao enviar a resposta, a sugestão será marcada como respondida.</p>

      {!statusBloqueado && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSalvar}
            disabled={saving}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Salvar
          </button>
        </div>
      )}
    </div>
  );
}
