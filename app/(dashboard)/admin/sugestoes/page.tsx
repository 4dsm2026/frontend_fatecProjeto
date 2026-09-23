"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, MessageSquareText } from "lucide-react";
import { apiFetch } from "../../../../utils/api";
import { cx } from "../../../../utils/cx";
import SugestaoStatusBadge from "../../../components/shared/SugestaoStatusBadge";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const PAGE_SIZE = 10;

type StatusSugestao = "NAO_RESPONDIDO" | "RESPONDIDO";

type SugestaoItem = {
  id: string;
  conteudo: string;
  status: StatusSugestao;
  criadoEm: string;
  usuario?: { nome?: string | null; ra?: string | null } | null;
};

export default function AdminSugestoesPage() {
  const [sugestoes, setSugestoes] = useState<SugestaoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"" | StatusSugestao>("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchSugestoes = useCallback(async (status: "" | StatusSugestao, targetPage: number) => {
    try {
      setLoading(true);
      const qs = new URLSearchParams({ page: String(targetPage), pageSize: String(PAGE_SIZE) });
      if (status) qs.set("status", status);
      const res = await apiFetch(`${API}/sugestoes?${qs.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setSugestoes(data?.items ?? []);
      setTotal(data?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSugestoes(filtro, page);
  }, [filtro, page, fetchSugestoes]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-grotesk text-2xl font-semibold tracking-tight">
            Caixa de Sugestões
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sugestões enviadas pelos alunos.
          </p>
        </div>

        <select
          value={filtro}
          onChange={(e) => {
            setFiltro(e.target.value as "" | StatusSugestao);
            setPage(1);
          }}
          className="h-9 rounded-lg border border-[var(--border)] bg-input px-2 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="NAO_RESPONDIDO">Não respondido</option>
          <option value="RESPONDIDO">Respondido</option>
        </select>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-card">
        {loading ? (
          <div className="p-6 text-center text-muted-foreground">
            <Loader2 className="size-4 animate-spin inline-block mr-2" />
            Carregando…
          </div>
        ) : sugestoes.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground inline-flex items-center gap-2 justify-center w-full">
            <MessageSquareText className="size-4" />
            Nenhuma sugestão encontrada.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {sugestoes.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/admin/sugestoes/${s.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--muted)]/60 transition"
                >
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">
                      {s.usuario?.nome ?? "Aluno"} {s.usuario?.ra ? `· R.A. ${s.usuario.ra}` : ""}
                    </div>
                    <div className="text-sm line-clamp-1">{s.conteudo}</div>
                  </div>
                  <SugestaoStatusBadge status={s.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className={cx(
              "h-8 w-8 inline-flex items-center justify-center rounded-md border border-[var(--border)]",
              page === 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-[var(--muted)]",
            )}
          >
            <ChevronLeft className="size-4" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={cx(
                "h-8 min-w-8 px-2 inline-flex items-center justify-center rounded-md text-sm",
                n === page
                  ? "bg-primary text-primary-foreground"
                  : "border border-[var(--border)] hover:bg-[var(--muted)]",
              )}
            >
              {n}
            </button>
          ))}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={cx(
              "h-8 w-8 inline-flex items-center justify-center rounded-md border border-[var(--border)]",
              page === totalPages ? "opacity-50 cursor-not-allowed" : "hover:bg-[var(--muted)]",
            )}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
