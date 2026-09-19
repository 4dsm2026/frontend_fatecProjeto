"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, extractApiError } from "../../../../../utils/api";
import SugestaoStatusBadge from "../../../../components/shared/SugestaoStatusBadge";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

// Mesmo limite aplicado no backend (src/validators/sugestoes.ts).
const RESPOSTA_MAX = 500;

type StatusSugestao = "NAO_RESPONDIDO" | "RESPONDIDO";

type SugestaoDetalhe = {
  id: string;
  conteudo: string;
  emailContato: string;
  status: StatusSugestao;
  resposta: string | null;
  criadoEm: string;
  usuario?: { nome?: string | null; ra?: string | null } | null;
};

export default function DetalheSugestaoAdminPage() {
  const params = useParams();
  const id = params?.id as string;

  const [sugestao, setSugestao] = useState<SugestaoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [resposta, setResposta] = useState("");
  const [status, setStatus] = useState<StatusSugestao>("NAO_RESPONDIDO");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await apiFetch(`${API}/sugestoes/${id}`, { cache: "no-store" });
      if (!res.ok) {
        setErro(
          res.status === 404
            ? "Sugestão não encontrada."
            : "Não foi possível carregar a sugestão.",
        );
        return;
      }
      const data: SugestaoDetalhe = await res.json();
      setSugestao(data);
      setResposta(data.resposta ?? "");
      setStatus(data.status);
    } catch {
      setErro("Não foi possível carregar a sugestão.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Regras de imutabilidade (espelham o backend em sugestoes.service.ts):
  // - status RESPONDIDO = definitivo: nada mais pode ser alterado.
  // - resposta já salva (não vazia) = texto da resposta fica travado,
  //   mesmo que o status ainda esteja NAO_RESPONDIDO.
  const statusFinal = sugestao?.status === "RESPONDIDO";
  const respostaJaSalva = !!sugestao?.resposta;
  const respostaBloqueada = statusFinal || respostaJaSalva;
  const statusBloqueado = statusFinal;

  async function handleSalvar() {
    const texto = resposta.trim();
    if (texto.length > RESPOSTA_MAX) {
      toast.error(`A resposta deve ter no máximo ${RESPOSTA_MAX} caracteres.`);
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch(`${API}/sugestoes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          // Só envia `resposta` se ela ainda não tiver sido salva antes —
          // depois de salva, o campo fica bloqueado e não deve ser reenviado.
          ...(texto && !respostaJaSalva ? { resposta: texto } : {}),
          ...(!statusBloqueado ? { status } : {}),
        }),
      });
      if (!res.ok) {
        throw new Error(await extractApiError(res, "Falha ao salvar."));
      }
      toast.success("Sugestão atualizada!");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link
        href="/admin/sugestoes"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" />
        Voltar para Caixa de Sugestões
      </Link>

      {loading ? (
        <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      ) : erro ? (
        <div className="rounded-xl border border-[var(--border)] bg-card p-5 text-sm text-destructive">
          {erro}
        </div>
      ) : sugestao ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border)] bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold">Sugestão enviada</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {sugestao.usuario?.nome ?? "Aluno"}
                  {sugestao.usuario?.ra ? ` · R.A. ${sugestao.usuario.ra}` : ""}
                  {sugestao.emailContato ? ` · ${sugestao.emailContato}` : ""}
                </div>
              </div>
              <SugestaoStatusBadge status={sugestao.status} />
            </div>
            <p className="whitespace-pre-wrap break-words text-sm">{sugestao.conteudo}</p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-card p-5 space-y-3">
            <label className="space-y-1 text-sm block">
              <span className="font-medium">Resposta do funcionário/professor</span>
              <textarea
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                maxLength={RESPOSTA_MAX}
                rows={4}
                disabled={respostaBloqueada}
                placeholder="Escreva a resposta para o aluno…"
                className="w-full rounded-lg border border-[var(--border)] bg-input px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none disabled:opacity-70 disabled:cursor-not-allowed"
              />
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
            </label>

            <label className="space-y-1 text-sm block">
              <span className="font-medium">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusSugestao)}
                disabled={statusBloqueado}
                className="w-full h-10 rounded-lg border border-[var(--border)] bg-input px-3 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <option value="NAO_RESPONDIDO">Não respondido</option>
                <option value="RESPONDIDO">Respondido</option>
              </select>
              {statusBloqueado && (
                <span className="block text-xs text-muted-foreground">
                  Status "Respondido" é definitivo e não pode mais ser alterado.
                </span>
              )}
            </label>

            {!statusBloqueado && (
              <div className="flex justify-end">
                <button
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
        </div>
      ) : null}
    </div>
  );
}
