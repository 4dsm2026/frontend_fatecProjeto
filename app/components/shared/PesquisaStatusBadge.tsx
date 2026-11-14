import { cx } from "../../../utils/cx";
import { STATUS_PESQUISA_LABEL, type StatusPesquisa } from "../../../utils/pesquisas";

const CLASSES: Record<StatusPesquisa, string> = {
  RASCUNHO: "bg-[var(--muted)] text-muted-foreground border-[var(--border)]",
  ABERTA: "bg-[var(--success)]/12 text-[var(--success)] border-[var(--success)]/30",
  ENCERRADA: "bg-[var(--info)]/12 text-[var(--info)] border-[var(--info)]/30",
};

export default function PesquisaStatusBadge({ status }: Readonly<{ status: StatusPesquisa }>) {
  return (
    <span className={cx("inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium border whitespace-nowrap", CLASSES[status] ?? CLASSES.RASCUNHO)}>
      {STATUS_PESQUISA_LABEL[status] ?? status}
    </span>
  );
}
