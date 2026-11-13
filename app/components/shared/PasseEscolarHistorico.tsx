import { STATUS_PASSE_LABEL, formatarDataHora, type PasseHistorico } from "../../../utils/passe-escolar";

/** Quem mudou o quê e quando: a parte "transparente" do acompanhamento. */
export default function PasseEscolarHistorico({ historico }: Readonly<{ historico: PasseHistorico[] }>) {
  if (historico.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem movimentações.</p>;
  }
  const ordenado = [...historico].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  return (
    <ol className="space-y-3">
      {ordenado.map((h) => (
        <li key={h.id} className="flex gap-3 text-sm">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--border)]" aria-hidden />
          <div className="min-w-0">
            <div className="font-medium">{STATUS_PASSE_LABEL[h.para] ?? h.para}</div>
            {h.comentario && <p className="whitespace-pre-wrap break-words text-muted-foreground">{h.comentario}</p>}
            <div className="text-xs text-muted-foreground">
              {formatarDataHora(h.criadoEm)}
              {h.autor?.nome ? ` · ${h.autor.nome}` : ""}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
