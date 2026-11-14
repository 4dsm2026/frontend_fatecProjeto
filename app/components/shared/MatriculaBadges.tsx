import { cx } from "../../../utils/cx";
import { STATUS_LABEL, situacaoNormalizada, type StatusSolicitacao, type Situacao } from "../../../utils/matricula";

const BASE = "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium border whitespace-nowrap";

const STATUS_CLS: Record<StatusSolicitacao, string> = {
  SOLICITADO: "bg-[var(--brand-cyan)]/12 text-[var(--brand-cyan)] border-[var(--brand-cyan)]/30",
  EM_ANALISE: "bg-[var(--brand-teal)]/12 text-[var(--brand-teal)] border-[var(--brand-teal)]/30",
  PENDENTE_ALUNO: "bg-[var(--warning)]/12 text-[var(--warning)] border-[var(--warning)]/30",
  DEFERIDO: "bg-[var(--success)]/12 text-[var(--success)] border-[var(--success)]/30",
  INDEFERIDO: "bg-[var(--destructive)]/12 text-[var(--destructive)] border-[var(--destructive)]/30",
  CANCELADO: "bg-[var(--muted)] text-muted-foreground border-[var(--border)]",
};

export function SolicitacaoStatusBadge({ status }: Readonly<{ status: StatusSolicitacao }>) {
  return <span className={cx(BASE, STATUS_CLS[status] ?? STATUS_CLS.CANCELADO)}>{STATUS_LABEL[status] ?? status}</span>;
}

const SITUACAO_CLS: Record<Situacao, string> = {
  Regular: "bg-[var(--success)]/12 text-[var(--success)] border-[var(--success)]/30",
  Trancada: "bg-[var(--warning)]/12 text-[var(--warning)] border-[var(--warning)]/30",
  Cancelada: "bg-[var(--destructive)]/12 text-[var(--destructive)] border-[var(--destructive)]/30",
};

/** Situação acadêmica do aluno. O campo é livre; mostra o texto original no `title`. */
export function SituacaoBadge({ situacao }: Readonly<{ situacao?: string | null }>) {
  const s = situacaoNormalizada(situacao);
  return (
    <span className={cx(BASE, SITUACAO_CLS[s])} title={situacao ?? "Sem situação registrada (considerada regular)"}>
      {s}
    </span>
  );
}
