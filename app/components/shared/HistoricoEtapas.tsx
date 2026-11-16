export type ItemHistorico = Readonly<{
  id: string;
  titulo: string;
  comentario?: string | null;
  criadoEm: string;
  autor?: string | null;
}>;

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Linha do tempo "quem mudou o quê e quando", do mais recente para o mais antigo. */
export default function HistoricoEtapas({ itens }: Readonly<{ itens: readonly ItemHistorico[] }>) {
  if (itens.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem movimentações.</p>;
  }
  const ordenado = [...itens].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  return (
    <ol className="space-y-3">
      {ordenado.map((h) => (
        <li key={h.id} className="flex gap-3 text-sm">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--border)]" aria-hidden />
          <div className="min-w-0">
            <div className="font-medium">{h.titulo}</div>
            {h.comentario && <p className="whitespace-pre-wrap break-words text-muted-foreground">{h.comentario}</p>}
            <div className="text-xs text-muted-foreground">
              {dataHora(h.criadoEm)}
              {h.autor ? ` · ${h.autor}` : ""}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
