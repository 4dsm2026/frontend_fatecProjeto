import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import SugestaoStatusBadge from "./SugestaoStatusBadge";

type SugestaoResumo = {
  conteudo: string;
  status: "NAO_RESPONDIDO" | "RESPONDIDO";
};

type Props = Readonly<{
  voltarHref: string;
  loading: boolean;
  erro: string | null;
  sugestao: SugestaoResumo | null;
  identificacao?: ReactNode;
  children?: ReactNode;
}>;

export default function SugestaoDetalheLayout({
  voltarHref,
  loading,
  erro,
  sugestao,
  identificacao,
  children,
}: Props) {
  let conteudo: ReactNode = null;

  if (loading) {
    conteudo = (
      <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" />
        Carregando…
      </div>
    );
  } else if (erro) {
    conteudo = (
      <div className="rounded-xl border border-[var(--border)] bg-card p-5 text-sm text-destructive">
        {erro}
      </div>
    );
  } else if (sugestao) {
    conteudo = (
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--border)] bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">
                Sugestão enviada
              </div>
              {identificacao}
            </div>
            <SugestaoStatusBadge status={sugestao.status} />
          </div>

          <p className="whitespace-pre-wrap break-words text-sm">
            {sugestao.conteudo}
          </p>
        </div>

        {children}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link
        href={voltarHref}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" />
        Voltar para Caixa de Sugestões
      </Link>

      {conteudo}
    </div>
  );
}