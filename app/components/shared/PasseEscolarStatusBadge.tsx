import { cx } from "../../../utils/cx";
import { STATUS_PASSE_LABEL, type StatusPasse } from "../../../utils/passe-escolar";

const CLASSES: Record<StatusPasse, string> = {
  SOLICITADO: "bg-[var(--brand-cyan)]/12 text-[var(--brand-cyan)] border-[var(--brand-cyan)]/30",
  PENDENTE_ALUNO: "bg-[var(--warning)]/12 text-[var(--warning)] border-[var(--warning)]/30",
  CADASTRADO_PORTAL: "bg-[var(--brand-teal)]/12 text-[var(--brand-teal)] border-[var(--brand-teal)]/30",
  REQUISITADO_EMTU: "bg-[var(--info)]/12 text-[var(--info)] border-[var(--info)]/30",
  CONCLUIDO: "bg-[var(--success)]/12 text-[var(--success)] border-[var(--success)]/30",
  INDEFERIDO: "bg-[var(--destructive)]/12 text-[var(--destructive)] border-[var(--destructive)]/30",
  CANCELADO: "bg-[var(--muted)] text-muted-foreground border-[var(--border)]",
};

export default function PasseEscolarStatusBadge({ status }: Readonly<{ status: StatusPasse }>) {
  const cls = CLASSES[status] ?? CLASSES.CANCELADO;
  return (
    <span className={cx("inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium border whitespace-nowrap", cls)}>
      {STATUS_PASSE_LABEL[status] ?? status}
    </span>
  );
}
