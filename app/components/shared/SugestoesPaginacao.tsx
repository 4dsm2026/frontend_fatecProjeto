import { ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "../../../utils/cx";

type Props = Readonly<{
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}>;

export default function SugestoesPaginacao({
  page,
  totalPages,
  onPageChange,
  className,
}: Props) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Paginação das sugestões"
      className={cx(
        "flex items-center justify-center gap-1",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Página anterior"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className={cx(
          "h-8 w-8 inline-flex items-center justify-center rounded-md border border-[var(--border)]",
          page === 1
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-[var(--muted)]",
        )}
      >
        <ChevronLeft className="size-4" />
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((numero) => (
        <button
          key={numero}
          type="button"
          aria-label={`Página ${numero}`}
          aria-current={numero === page ? "page" : undefined}
          onClick={() => onPageChange(numero)}
          className={cx(
            "h-8 min-w-8 px-2 inline-flex items-center justify-center rounded-md text-sm",
            numero === page
              ? "bg-primary text-primary-foreground"
              : "border border-[var(--border)] hover:bg-[var(--muted)]",
          )}
        >
          {numero}
        </button>
      ))}

      <button
        type="button"
        aria-label="Próxima página"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className={cx(
          "h-8 w-8 inline-flex items-center justify-center rounded-md border border-[var(--border)]",
          page === totalPages
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-[var(--muted)]",
        )}
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}