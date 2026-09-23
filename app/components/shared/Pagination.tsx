"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "../../../utils/cx";

type Props = Readonly<{
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}>;

export default function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className={cx(
          "h-8 w-8 inline-flex items-center justify-center rounded-md border border-[var(--border)]",
          page === 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-[var(--muted)]",
        )}
      >
        <ChevronLeft className="size-4" />
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={cx(
            "h-8 min-w-8 px-2 inline-flex items-center justify-center rounded-md text-sm",
            n === page
              ? "bg-primary text-primary-foreground"
              : "border border-[var(--border)] hover:bg-[var(--muted)]",
          )}
        >
          {n}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className={cx(
          "h-8 w-8 inline-flex items-center justify-center rounded-md border border-[var(--border)]",
          page === totalPages ? "opacity-50 cursor-not-allowed" : "hover:bg-[var(--muted)]",
        )}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
