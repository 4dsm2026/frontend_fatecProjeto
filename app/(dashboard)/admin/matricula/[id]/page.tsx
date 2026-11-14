"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, ExternalLink, Loader2 } from "lucide-react";
import { API_BASE, apiFetch, extractApiError } from "../../../../../utils/api";
import {
  ETAPAS_MATRICULA,
  MAX_TRANCAMENTOS,
  TIPO_LABEL,
  etapaDaSolicitacao,
  rotuloMotivo,
  semestreLegivel,
  type Solicitacao,
} from "../../../../../utils/matricula";
import { formatarDataHora } from "../../../../../utils/passe-escolar";
import BetaBadge from "../../../../components/shared/BetaBadge";
import LinhaDeEtapas from "../../../../components/shared/LinhaDeEtapas";
import MatriculaAcoes from "../../../../components/shared/MatriculaAcoes";
import { SituacaoBadge, SolicitacaoStatusBadge } from "../../../../components/shared/MatriculaBadges";
import MatriculaHistorico from "../../../../components/shared/MatriculaHistorico";
import Alert from "../../../../components/ui/Alert";
import Card from "../../../../components/ui/Card";

export default function SolicitacaoAdminPage() {
  const params = useParams();
  const id = params?.id as string;
  const [s, setS] = useState<Solicitacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const etapa = s ? etapaDaSolicitacao(s.status, s.historico) : null;
  const etapasEquipe = ETAPAS_MATRICULA.map((e) => (e.quem === "Você" ? { ...e, quem: "Aluno" } : e));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/admin/matricula" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ChevronLeft className="size-4" /> Trancamento e cancelamento
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-grotesk text-2xl font-semibold tracking-tight flex flex-wrap items-center gap-2">
            {s ? `${TIPO_LABEL[s.tipo]} · ${s.usuario?.nome ?? "Aluno"}` : "Pedido"} <BetaBadge />
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
            <LinhaDeEtapas etapas={etapasEquipe} {...etapa} legendaAtual={etapa.estado === "pendente" ? "Aguardando o aluno" : etapa.legendaAtual} aria-label="Etapas do pedido" />

            {(s.alertas ?? []).length > 0 && (
              <Alert variant="warning" title="Antes de decidir">
                <ul className="list-disc pl-4">
                  {(s.alertas ?? []).map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </Alert>
            )}
            {s.tipo === "CANCELAMENTO" && s.status !== "DEFERIDO" && s.status !== "INDEFERIDO" && s.status !== "CANCELADO" && (
              <Alert variant="info">
                Cancelamento é definitivo. Se o motivo tiver solução (horário, disciplinas, transporte), vale encaminhar o
                aluno à coordenação ou sugerir o trancamento, que mantém a vaga.
              </Alert>
            )}
            {s.orientacaoFatec && (
              <div className="text-sm">
                <span className="font-medium">Última mensagem ao aluno:</span> <span className="whitespace-pre-wrap text-muted-foreground">{s.orientacaoFatec}</span>
              </div>
            )}
            {s.decididoEm && (
              <p className="text-xs text-muted-foreground">
                Decidido em {formatarDataHora(s.decididoEm)}
                {s.decididoPor?.nome ? ` por ${s.decididoPor.nome}` : ""}.
              </p>
            )}

            <MatriculaAcoes solicitacao={s} tipo={s.tipo} quem="equipe" onChanged={load} />
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Aluno</div>
              <Link href={`/admin/alunos/${s.usuarioId}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                Ver ficha do aluno <ExternalLink className="size-3.5" />
              </Link>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Nome</dt>
                <dd className="font-medium">{s.usuario?.nome ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">R.A.</dt>
                <dd className="font-medium">{s.usuario?.ra ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Situação atual</dt>
                <dd className="mt-0.5">
                  <SituacaoBadge situacao={s.usuario?.situacaoAcademica} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Curso (no pedido)</dt>
                <dd className="font-medium">{s.curso}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Semestre do curso</dt>
                <dd className="font-medium">{s.usuario?.semestreAtual ?? "Não informado"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Turno</dt>
                <dd className="font-medium">{s.usuario?.turno ?? "—"}</dd>
              </div>
            </dl>
          </Card>

          <Card className="space-y-3">
            <div className="text-sm font-semibold">Pedido</div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Tipo</dt>
                <dd className="font-medium">
                  {TIPO_LABEL[s.tipo]}
                  {s.tipo === "TRANCAMENTO" ? ` (limite de ${MAX_TRANCAMENTOS})` : " (definitivo)"}
                </dd>
              </div>
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
                  <dt className="text-xs text-muted-foreground">Justificativa do aluno</dt>
                  <dd className="whitespace-pre-wrap">{s.justificativa}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card className="space-y-3">
            <div className="text-sm font-semibold">Histórico</div>
            <MatriculaHistorico historico={s.historico ?? []} />
          </Card>
        </>
      )}
    </div>
  );
}
