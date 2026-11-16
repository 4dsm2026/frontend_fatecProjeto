import { cx } from "../../../utils/cx";

/**
 * Insígnia "Beta": marca funcionalidades em teste, para quem usa saber que
 * podem mudar e que vale reportar problemas.
 */
export default function BetaBadge({ className }: Readonly<{ className?: string }>) {
  return (
    <span
      title="Funcionalidade em teste: pode mudar. Problemas? Use a Caixa de Sugestões."
      className={cx(
        "inline-flex items-center rounded-md border border-[var(--info)]/40 bg-[var(--info)]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--info)]",
        className,
      )}
    >
      Beta
    </span>
  );
}
