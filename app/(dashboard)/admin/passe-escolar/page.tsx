"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BusFront, Download, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, apiFetch, extractApiError } from "../../../../utils/api";
import { embedded, getLink, hasLink, type HalCollection } from "../../../../utils/hal";
import { STATUS_PASSE_LABEL, formatarConclusao, type PasseResumo, type StatusPasse } from "../../../../utils/passe-escolar";
import { formatDate } from "../../../../utils/types";
import BetaBadge from "../../../components/shared/BetaBadge";
import Pagination from "../../../components/shared/Pagination";
import PasseEscolarStatusBadge from "../../../components/shared/PasseEscolarStatusBadge";

const PAGE_SIZE = 20;
const ANO_ATUAL = new Date().getFullYear();
const SELECT = "h-9 rounded-lg border border-[var(--border)] bg-input px-2 text-sm";

type Filtro = "ATIVOS" | "TODOS" | StatusPasse;

/**
 * Fila da Secretaria. Por padrão mostra só o ano atual e o que está em andamento:
 * quem já concluiu, foi recusado ou se formou não ocupa a tela.
 */
export default function AdminPasseEscolarPage() {
  const [colecao, setColecao] = useState<HalCollection<PasseResumo> | null>(null);
  const [loading, setLoading] = useState(true);
  const [ano, setAno] = useState<string>(String(ANO_ATUAL));
  const [filtro, setFiltro] = useState<Filtro>("ATIVOS");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [page, setPage] = useState(1);
  const [exportando, setExportando] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams({ page: String(page - 1), size: String(PAGE_SIZE) });
      if (ano) qs.set("ano", ano);
      if (filtro === "ATIVOS") qs.set("ativos", "true");
      else if (filtro !== "TODOS") qs.set("status", filtro);
      if (buscaAplicada) qs.set("search", buscaAplicada);

      const res = await apiFetch(`${API_BASE}/school-passes?${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await extractApiError(res, "Não foi possível carregar os pedidos."));
      setColecao((await res.json()) as HalCollection<PasseResumo>);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar os pedidos.");
    } finally {
      setLoading(false);
    }
  }, [ano, filtro, buscaAplicada, page]);

  useEffect(() => {
    load();
  }, [load]);

  const itens = embedded<PasseResumo>(colecao, "school-passes");
  const total = colecao?.page?.totalElements ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function exportar() {
    const link = getLink(colecao, "export");
    if (!link) return;
    try {
      setExportando(true);
      const qs = new URLSearchParams();
      if (ano) qs.set("ano", ano);
      if (filtro !== "ATIVOS" && filtro !== "TODOS") qs.set("status", filtro);
      const sufixo = qs.size ? `?${qs}` : "";
      const res = await apiFetch(`${API_BASE}${link.href}${sufixo}`);
      if (!res.ok) throw new Error(await extractApiError(res, "Não foi possível exportar."));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `passe-escolar-${ano || "todos"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível exportar.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-grotesk text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
            Passe Escolar <BetaBadge />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pedidos de cadastro no Portal de Relacionamento da ARTESP/EMTU. A lista começa pelo que está em andamento.
          </p>
        </div>
        {hasLink(colecao, "export") && (
          <button
            type="button"
            onClick={exportar}
            disabled={exportando}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm hover:bg-[var(--muted)] disabled:opacity-60"
            title="CSV com as colunas do portal, para lançar em lote"
          >
            {exportando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Exportar CSV
          </button>
        )}
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setBuscaAplicada(busca.trim());
        }}
      >
        <select aria-label="Ano" className={SELECT} value={ano} onChange={(e) => { setAno(e.target.value); setPage(1); }}>
          <option value="">Todos os anos</option>
          {[ANO_ATUAL + 1, ANO_ATUAL, ANO_ATUAL - 1, ANO_ATUAL - 2].map((a) => (
            <option key={a} value={String(a)}>
              {a}
            </option>
          ))}
        </select>
        <select aria-label="Etapa" className={SELECT} value={filtro} onChange={(e) => { setFiltro(e.target.value as Filtro); setPage(1); }}>
          <option value="ATIVOS">Em andamento</option>
          <option value="TODOS">Todas as etapas</option>
          {(Object.keys(STATUS_PASSE_LABEL) as StatusPasse[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_PASSE_LABEL[s]}
            </option>
          ))}
        </select>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            aria-label="Buscar por nome, RA ou CPF"
            className="h-9 w-full min-w-[12rem] rounded-lg border border-[var(--border)] bg-input px-3 text-sm"
            placeholder="Nome, RA ou CPF"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
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
            <BusFront className="size-4" /> Nenhum pedido com esses filtros.
          </div>
        )}
        {!loading && itens.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)]/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Aluno</th>
                  <th className="px-4 py-2 text-left">Curso</th>
                  <th className="px-4 py-2 text-left">Modalidade</th>
                  <th className="px-4 py-2 text-left">Conclusão</th>
                  <th className="px-4 py-2 text-left">Pedido em</th>
                  <th className="px-4 py-2 text-left">Etapa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {itens.map((p) => (
                  <tr key={p.id} className="hover:bg-[var(--muted)]/40">
                    <td className="px-4 py-3">
                      <Link href={`/admin/passe-escolar/${p.id}`} className="font-medium hover:underline">
                        {p.nomeCompleto}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {p.usuario?.ra ? `R.A. ${p.usuario.ra}` : ""}
                        {p.tipo === "REVALIDACAO" ? " · Revalidação" : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="line-clamp-1">{p.curso}</div>
                      <div className="text-xs text-muted-foreground">{p.periodo}</div>
                    </td>
                    <td className="px-4 py-3">{p.modalidade === "PASSE_LIVRE" ? "Passe Livre" : "Meia Tarifa"}</td>
                    <td className="px-4 py-3">{formatarConclusao(p.mesConclusao, p.anoConclusao)}</td>
                    <td className="px-4 py-3">{formatDate(p.criadoEm)}</td>
                    <td className="px-4 py-3">
                      <PasseEscolarStatusBadge status={p.status} />
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
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}
