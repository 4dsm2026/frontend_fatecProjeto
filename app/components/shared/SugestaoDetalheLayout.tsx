import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { JSONContent } from "@tiptap/react";
import SugestaoStatusBadge from "./SugestaoStatusBadge";

type SugestaoResumo = {
  conteudo: string;
  documento?: JSONContent | null;
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

const DATA_IMAGE_PREFIX = /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i;

function aplicarMarcas(texto: string, marks?: JSONContent["marks"]): ReactNode {
  let resultado: ReactNode = texto;

  for (const mark of marks ?? []) {
    if (mark.type === "bold") {
      resultado = <strong>{resultado}</strong>;
    } else if (mark.type === "italic") {
      resultado = <em>{resultado}</em>;
    }
  }

  return resultado;
}

function renderizarFilhos(nos?: JSONContent[]): ReactNode {
  if (!nos?.length) return null;

  return nos.map((no, indice) => {
    const chave = `${no.type ?? "texto"}-${indice}`;

    if (no.type === "hardBreak") {
      return <br key={chave} />;
    }

    return (
      <span key={chave}>
        {aplicarMarcas(no.text ?? "", no.marks)}
      </span>
    );
  });
}

function renderizarConteudoSugestao(sugestao: SugestaoResumo): ReactNode {
  const blocos = sugestao.documento?.content?.filter(
    (bloco) => bloco.type === "paragraph" || bloco.type === "image",
  );

  if (!blocos?.length) {
    return (
      <p className="whitespace-pre-wrap break-words text-sm">
        {sugestao.conteudo}
      </p>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      {blocos.map((bloco, indice) => {
        if (bloco.type === "image") {
          const src =
            typeof bloco.attrs?.src === "string" ? bloco.attrs.src : "";
          if (!DATA_IMAGE_PREFIX.test(src)) return null;

          const alt =
            typeof bloco.attrs?.alt === "string" && bloco.attrs.alt.trim()
              ? bloco.attrs.alt
              : `Imagem ${indice + 1} da sugestão`;

          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`imagem-${indice}`}
              src={src}
              alt={alt}
              className="my-2 max-h-80 rounded-lg border border-[var(--border)] object-contain"
            />
          );
        }

        return (
          <p
            key={`paragrafo-${indice}`}
            className="whitespace-pre-wrap break-words"
          >
            {renderizarFilhos(bloco.content)}
          </p>
        );
      })}
    </div>
  );
}

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

          {renderizarConteudoSugestao(sugestao)}
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