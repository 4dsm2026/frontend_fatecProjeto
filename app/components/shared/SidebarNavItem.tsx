"use client";

import Link from "next/link";
import { cx } from "../../../utils/cx";

type Props = Readonly<{
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
  isActive: boolean;
  onClick?: () => void;
}>;

export default function SidebarNavItem({
  href,
  label,
  icon,
  badge,
  isActive,
  onClick,
}: Props) {
  return (
    <Link
      href={href}
      className={cx(
        "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition",
        isActive
          ? "bg-primary text-primary-foreground shadow-sm"
          : "hover:bg-[var(--muted)]/70"
      )}
      onClick={onClick}
    >
      <span className="flex items-center gap-3">
        <span className="inline-grid place-items-center size-5 opacity-90">
          {icon}
        </span>
        <span>{label}</span>
      </span>

      {badge != null && (
        <span className="ml-2 rounded-md bg-background px-1.5 py-0.5 text-xs border border-[var(--border)]">
          {badge}
        </span>
      )}
    </Link>
  );
}
