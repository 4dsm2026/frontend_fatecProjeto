"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, apiFetch, extractApiError } from "../../../../utils/api";
import { embedded, getLink, type HalCollection } from "../../../../utils/hal";
import {
  STATUS_LABEL,
  TIPO_LABEL,
  rotuloMotivo,
  semestreLegivel,
  type ResumoMatricula,
  type Solicitacao,
  type StatusSolicitacao,
  type TipoSolicitacao,
} from "../../../../utils/matricula";
import { formatDate } from "../../../../utils/types";
import BetaBadge from "../../../components/shared/BetaBadge";
import { SolicitacaoStatusBadge } from "../../../components/shared/MatriculaBadges";
import Pagination from "../../../components/shared/Pagination";
import Card from "../../../components/ui/Card";

const PAGE_SIZE = 20;
const SELECT = "h-9 rounded-lg border border-[var(--border)] bg-input px-2 text-sm";
type FiltroStatus = "ABERTOS" | "TODOS" | StatusSolicitacao;

function semestreAtual(agora = new Date()) {
  return `${agora.getFullYear()}-${agora.getMonth() < 6 ? 1 : 2}`;
}

/** Fila da Secretaria e o retrato do semestre (quantos trancaram/cancelaram e por quê). */
export default function AdminMatriculaPage() {
  const [colecao, setColecao] = useState<HalCollection<Solicitacao> | null>(null);
  const [resumo, setResumo] = useState<ResumoMatricula | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<FiltroStatus>("ABERTOS");
  const [tipo, setTipo] = useState<"" | TipoSolicitacao>("");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams({ page: String(page - 1), size: String(PAGE_SIZE) });
      if (status === "ABERTOS") qs.set("abertos", "true");
      else if (status !== "TODOS") qs.set("status", status);
      if (tipo) qs.set("tipo", tipo);
      if (buscaAplicada) qs.set("search", buscaAplicada);
      const res = await apiFetch(`${API_BASE}/enrollment-requests?${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await extractApiError(res, "Não foi possível carregar os pedidos."));
      setColecao((await res.json()) as HalCollection<Solicitacao>);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar os pedidos.");
    } finally {
      setLoading(false);
    }
  }, [page, status, tipo, buscaAplicada]);

  useEffect(() => {
    load();
  }, [load]);

  const linkResumo = getLink(colecao, "summary")?.href;
  useEffect(() => {
    if (!linkResumo) return;
    apiFetch(`${API_BASE}${linkResumo}?semestre=${semestreAtual()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ResumoMatricula | null) => setResumo(d))
      .catch(() => {});
  }, [linkResumo]);

  const itens = embedded<Solicitacao>(colecao, "enrollment-requests");
  const total = colecao?.page?.totalElements ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-grotesk text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
          Trancamento e cancelamento <BetaBadge />
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pedidos dos alunos. Deferir atualiza a situação acadêmica do aluno automaticamente.
        </p>
      </div>

      {resumo && (
        <div className="grid gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))]">
          <Card>
            <div className="text-xs text-muted-foreground">Na fila agora</div>
            <div className="font-grotesk text-3xl font-semibold">{resumo.totalEmAberto}</div>
            <div className="text-xs text-muted-foreground">
              {resumo.emAberto.PENDENTE_ALUNO ? `${resumo.emAberto.PENDENTE_ALUNO} aguardando aluno` : "nenhum aguardando aluno"}
            </div>
          </Card>
          <Card>
            <div className="text-xs text-muted-foreground">Deferidos no {semestreLegivel(resumo.semestre)}</div>
            <div className="mt-1 flex gap-6">
              <div>
                <div className="font-grotesk text-3xl font-semibold">{resumo.deferidos.TRANCAMENTO}</div>
                <div className="text-xs text-muted-foreground">trancamentos</div>
              </div>
              <div>
                <div className="font-grotesk text-3xl font-semibold">{resumo.deferidos.CANCELAMENTO}</div>
                <div className="text-xs text-muted-foreground">cancelamentos</div>
              </div>
            </div>
          </Card>
          <Card>
            <div className="text-xs text-muted-foreground mb-1">Principais motivos no semestre</div>
            {resumo.porMotivo.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum deferido ainda.</div>
            ) : (
              <ul className="space-y-1 text-sm">
                {[...resumo.porMotivo]
                  .sort((a, b) => b.TRANCAMENTO + b.CANCELAMENTO - (a.TRANCAMENTO + a.CANCELAMENTO))
                  .slice(0, 4)
                  .map((m) => (
                    <li key={m.motivo} className="flex justify-between gap-2">
                      <span className="truncate">{m.rotulo}</span>
                      <span className="text-muted-foreground">{m.TRANCAMENTO + m.CANCELAMENTO}</span>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setBuscaAplicada(busca.trim());
        }}
      >
        <select aria-label="Status" className={SELECT} value={status} onChange={(e) => { setStatus(e.target.value as FiltroStatus); setPage(1); }}>
          <option value="ABERTOS">Em aberto</option>
          <option value="TODOS">Todos</option>
          {(Object.keys(STATUS_LABEL) as StatusSolicitacao[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select aria-label="Tipo" className={SELECT} value={tipo} onChange={(e) => { setTipo(e.target.value as "" | TipoSolicitacao); setPage(1); }}>
          <option value="">Trancamento e cancelamento</option>
          <option value="TRANCAMENTO">Só trancamento</option>
          <option value="CANCELAMENTO">Só cancelamento</option>
        </select>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input aria-label="Buscar por nome ou RA" className="h-9 w-full min-w-[12rem] rounded-lg border border-[var(--border)] bg-input px-3 text-sm" placeholder="Nome ou RA" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <button type="submit" className="inline-flex h-9 items-center gap-1 rounded-md border border-[var(--border)] px-3 text-sm hover:bg-[var(--muted)]">
            <Search className="size-4" /> Buscar
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-[var(--border)] bg-card overflow-hidden">
        {loading && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin inline-block mr-2" /> Carregando…
          </div>
        )}
        {!loading && itens.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground inline-flex items-center gap-2 justify-center w-full">
            <UserMinus className="size-4" /> Nenhum pedido com esses filtros.
          </div>
        )}
        {!loading && itens.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)]/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Aluno</th>
                  <th className="px-4 py-2 text-left">Pedido</th>
                  <th className="px-4 py-2 text-left">Motivo</th>
                  <th className="px-4 py-2 text-left">Enviado em</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {itens.map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--muted)]/40">
                    <td className="px-4 py-3">
                      <Link href={`/admin/matricula/${s.id}`} className="font-medium hover:underline">
                        {s.usuario?.nome ?? "Aluno"}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {s.usuario?.ra ? `R.A. ${s.usuario.ra} · ` : ""}
                        {s.curso}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={s.tipo === "CANCELAMENTO" ? "font-medium text-destructive" : "font-medium"}>{TIPO_LABEL[s.tipo]}</span>
                      <div className="text-xs text-muted-foreground">{s.semestre}</div>
                    </td>
                    <td className="px-4 py-3">{rotuloMotivo(s.motivo)}</td>
                    <td className="px-4 py-3">{formatDate(s.criadoEm)}</td>
                    <td className="px-4 py-3">
                      <SolicitacaoStatusBadge status={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{total} pedido(s)</span>
        <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} onChange={setPage} />
      </div>
    </div>
  );
}
