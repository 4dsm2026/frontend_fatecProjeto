"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Loader2, MessageSquarePlus, Send } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, extractApiError } from "../../../../utils/api";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

// TODO: confirmar o limite real de caracteres definido no banco de dados.
// Usado provisoriamente 1000 (mesmo valor aplicado na validação do backend
// em src/validators/sugestoes.ts).
const CONTEUDO_MAX = 1000;

export default function SugestoesPage() {
  const [ra, setRa] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [enviado, setEnviado] = useState(false);

  /* Busca o R.A. do aluno autenticado — não é digitado, apenas exibido */
  useEffect(() => {
    apiFetch(`${API}/auth/me`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ra?: string | number } | null) => {
        if (data?.ra != null) setRa(String(data.ra));
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const texto = conteudo.trim();
    if (texto.length < 3) {
      toast.error("Escreva sua sugestão antes de enviar.");
      return;
    }
    if (texto.length > CONTEUDO_MAX) {
      toast.error(`A sugestão deve ter no máximo ${CONTEUDO_MAX} caracteres.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch(`${API}/sugestoes`, {
        method: "POST",
        body: JSON.stringify({ conteudo: texto }),
      });

      if (!res.ok) {
        throw new Error(await extractApiError(res, "Falha ao enviar sugestão."));
      }

      toast.success("Sugestão enviada com sucesso!");
      setConteudo("");
      setEnviado(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar sugestão.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-grotesk text-2xl font-semibold tracking-tight">
          Caixa de Sugestões
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Envie uma sugestão, elogio ou crítica. Sua mensagem fica vinculada ao
          seu cadastro.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-[var(--border)] bg-card p-5 space-y-4"
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquarePlus className="size-4 text-muted-foreground" />
          Nova sugestão
        </div>

        {ra && (
          <div className="rounded-lg border border-[var(--border)] px-4 py-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">R.A.:</span> {ra}
          </div>
        )}

        <label className="space-y-1 text-sm block">
          <span className="font-medium">
            Sugestão <span className="text-destructive">*</span>
          </span>
          <textarea
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            rows={6}
            maxLength={CONTEUDO_MAX}
            placeholder="Escreva aqui sua sugestão…"
            className="w-full rounded-lg border border-[var(--border)] bg-input px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
          />
          <span className="block text-right text-xs text-muted-foreground">
            {conteudo.length}/{CONTEUDO_MAX}
          </span>
        </label>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Enviar
          </button>
        </div>
      </form>

      {enviado && (
        <div className="rounded-xl border border-[var(--border)] bg-card p-5 flex items-center gap-3 text-sm">
          <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
          Sua sugestão foi registrada. Obrigado pela contribuição!
        </div>
      )}
    </div>
  );
}
