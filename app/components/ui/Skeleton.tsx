import { useId } from "react";
import { cx } from "../../../utils/cx";

type Props = {
  className?: string;
};

export function Skeleton({ className }: Props) {
  return (
    <div
      className={cx(
        "animate-pulse rounded-md bg-[var(--skeleton)]",
        className,
      )}
    />
  );
}

export function SkeletonCard({ rows = 2 }: { rows?: number }) {
  const uid = useId();
  const rowKeys = Array.from({ length: rows }, (_, i) => `${uid}-row-${i}`);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-card p-4 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      {rowKeys.map((key) => (
        <Skeleton key={key} className="h-3 w-full" />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  const uid = useId();
  const rowKeys = Array.from({ length: rows }, (_, r) => `${uid}-row-${r}`);
  const colKeys = Array.from({ length: cols }, (_, c) => `${uid}-col-${c}`);
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-card">
      <div className="bg-[var(--muted)] px-4 py-3">
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="divide-y divide-[var(--border)]">
        {rowKeys.map((rowKey) => (
          <div key={rowKey} className="flex gap-6 px-4 py-3">
            {colKeys.map((colKey) => (
              <Skeleton key={`${rowKey}-${colKey}`} className="h-3 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonKpi() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-card p-4 flex items-center justify-between">
      <div className="space-y-2 flex-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-12" />
      </div>
      <Skeleton className="size-10 rounded-lg shrink-0" />
    </div>
  );
}
