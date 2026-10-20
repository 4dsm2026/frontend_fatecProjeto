"use client";

import { Eye } from "lucide-react";
import { classeConteudoEmail } from "./ModeloEmailEditor";

type Props = Readonly<{
  assunto: string;
  /** HTML do corpo (o mesmo que está no editor). */
  corpo: string;
  /** Troca as variáveis por dados de exemplo. */
  aplicarExemplo: (texto: string) => string;
}>;

/** Mostra o e-mail como o destinatário veria, com dados de exemplo; atualiza enquanto se edita. */
export default function ModeloEmailPreview({ assunto, corpo, aplicarExemplo }: Props) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold inline-flex items-center gap-2">
          <Eye className="size-4" /> Visualização
        </div>
        <div className="text-xs text-muted-foreground">Com dados de exemplo · atualiza enquanto você edita</div>
      </div>

      <article aria-label="Visualização do e-mail" className="rounded-lg border border-[var(--border)] bg-background">
        <dl className="border-b border-[var(--border)] px-3 py-2 text-xs text-muted-foreground space-y-0.5">
          <div className="flex gap-2"><dt className="w-14 shrink-0">Para</dt><dd>Destinatário do evento (aluno ou equipe)</dd></div>
          <div className="flex gap-2"><dt className="w-14 shrink-0">Assunto</dt><dd className="font-medium text-foreground">{aplicarExemplo(assunto)}</dd></div>
        </dl>
        <div
          className={classeConteudoEmail}
          // Corpo vem do editor (esquema limitado) ou do modelo salvo; os dados de exemplo são fixos.
          dangerouslySetInnerHTML={{ __html: aplicarExemplo(corpo) }}
        />
      </article>
    </div>
  );
}
