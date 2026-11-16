"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, apiFetch, extractApiError } from "../../../../../utils/api";
import { followLink, hasLink } from "../../../../../utils/hal";
import {
  ETAPAS_MATRICULA,
  TIPO_LABEL,
  etapaDaSolicitacao,
  orientacaoAluno,
  rotuloMotivo,
  semestreLegivel,
  type Solicitacao,
} from "../../../../../utils/matricula";
import BetaBadge from "../../../../components/shared/BetaBadge";
import LinhaDeEtapas from "../../../../components/shared/LinhaDeEtapas";
import MatriculaAcoes from "../../../../components/shared/MatriculaAcoes";
import { SolicitacaoStatusBadge } from "../../../../components/shared/MatriculaBadges";
import MatriculaHistorico from "../../../../components/shared/MatriculaHistorico";
import Alert from "../../../../components/ui/Alert";
import Card from "../../../../components/ui/Card";

const VARIANTE_MENSAGEM: Partial<Record<Solicitacao["status"], "error" | "success" | "warning">> = {
  INDEFERIDO: "error",
  DEFERIDO: "success",
  PENDENTE_ALUNO: "warning",
};

export default function SolicitacaoAlunoPage() {
  const params = useParams();
  const id = params?.id as string;
  const [s, setS] = useState<Solicitacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resposta, setResposta] = useState("");
  const [enviando, setEnviando] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await apiFetch(`${API_BASE}/enrollment-requests/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!res.ok) {
        setErro(res.status === 404 ? "Pedido não encontrado." : await extractApiError(res, "Não foi possível carregar o pedido."));
        return;
      }
      setS((await res.json()) as Solicitacao);
      setErro(null);
    } catch {
      setErro("Não foi possível carregar o pedido.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function responder(e: FormEvent) {
    e.preventDefault();
    if (!s || resposta.trim().length < 3) {
      toast.error("Escreva a sua resposta à Secretaria.");
      return;
    }
    try {
      setEnviando(true);
      const res = await followLink(s, "respond", { body: JSON.stringify({ justificativa: resposta.trim() }) });
      if (!res.ok) throw new Error(await extractApiError(res, "Não foi possível enviar a resposta."));
      toast.success("Resposta enviada. O pedido voltou para análise.");
      setResposta("");
      setS((await res.json()) as Solicitacao);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a resposta.");
    } finally {
      setEnviando(false);
    }
  }

  const etapa = s ? etapaDaSolicitacao(s.status, s.historico) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/aluno/matricula" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ChevronLeft className="size-4" /> Trancamento e cancelamento
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-grotesk text-2xl font-semibold tracking-tight flex flex-wrap items-center gap-2">
            {s ? `${TIPO_LABEL[s.tipo]} · ${s.semestre}` : "Pedido"} <BetaBadge />
          </h1>
          {s && <SolicitacaoStatusBadge status={s.status} />}
        </div>
      </div>

      {loading && !s && (
        <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      )}
      {erro && <Alert variant="error">{erro}</Alert>}

      {s && etapa && (
        <>
          <Card className="space-y-5">
            <LinhaDeEtapas etapas={ETAPAS_MATRICULA} {...etapa} aria-label="Etapas do pedido" />
            {s.orientacaoFatec && (s.status === "PENDENTE_ALUNO" || s.status === "INDEFERIDO" || s.status === "DEFERIDO") && (
              <Alert variant={VARIANTE_MENSAGEM[s.status] ?? "warning"} title="Mensagem da Secretaria">
                <p className="whitespace-pre-wrap">{s.orientacaoFatec}</p>
              </Alert>
            )}
            <p className={s.status === "PENDENTE_ALUNO" ? "text-sm font-medium text-[var(--warning)]" : "text-sm text-muted-foreground"}>{orientacaoAluno(s)}</p>

            {hasLink(s, "respond") && (
              <form onSubmit={responder} className="space-y-2">
                <label htmlFor="resposta" className="text-sm font-medium">
                  Sua resposta à Secretaria
                </label>
                <textarea
                  id="resposta"
                  rows={4}
                  maxLength={2000}
                  value={resposta}
                  onChange={(e) => setResposta(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-none"
                />
                <div className="flex justify-end">
                  <button type="submit" disabled={enviando} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-60">
                    {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Responder
                  </button>
                </div>
              </form>
            )}

            <div className="flex justify-end">
              <MatriculaAcoes solicitacao={s} tipo={s.tipo} quem="aluno" onChanged={load} />
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="text-sm font-semibold">Dados do pedido</div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Semestre</dt>
                <dd className="font-medium">{semestreLegivel(s.semestre)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Motivo</dt>
                <dd className="font-medium">{rotuloMotivo(s.motivo)}</dd>
              </div>
              {s.justificativa && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">O que você escreveu</dt>
                  <dd className="whitespace-pre-wrap">{s.justificativa}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card className="space-y-3">
            <div className="text-sm font-semibold">Histórico</div>
            <MatriculaHistorico historico={s.historico ?? []} donoId={s.usuarioId} />
          </Card>
        </>
      )}
    </div>
  );
}
