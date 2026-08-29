"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { apiFetch } from "../../../../../utils/api";
import SugestaoStatusBadge from "../../../../components/shared/SugestaoStatusBadge";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

type StatusSugestao = "NAO_RESPONDIDO" | "RESPONDIDO";

type SugestaoDetalhe = {
  id: string;
  conteudo: string;
  emailContato: string;
  status: StatusSugestao;
  resposta: string | null;
  criadoEm: string;
  respondidoPor?: { nome?: string | null } | null;
};

export default function DetalheSugestaoAlunoPage() {
  const params = useParams();
  const id = params?.id as string;

  const [sugestao, setSugestao] = useState<SugestaoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
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
        setSugestao(await res.json());
      } catch {
        setErro("Não foi possível carregar a sugestão.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link
        href="/aluno/sugestoes"
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
              <span className="text-sm font-semibold">Sugestão enviada</span>
              <SugestaoStatusBadge status={sugestao.status} />
            </div>
            <p className="whitespace-pre-wrap break-words text-sm">{sugestao.conteudo}</p>
          </div>

          {sugestao.status === "RESPONDIDO" && sugestao.resposta && (
            <div className="rounded-xl border border-[var(--border)] bg-card p-5">
              <div className="text-sm font-semibold mb-2">
                {sugestao.respondidoPor?.nome
                  ? `Resposta de "${sugestao.respondidoPor.nome}"`
                  : "Resposta do funcionário/professor"}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                {sugestao.resposta}
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
