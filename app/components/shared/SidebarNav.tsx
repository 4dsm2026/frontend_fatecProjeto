"use client";

import SidebarNavItem from "./SidebarNavItem";

export type SidebarNavItemData = {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
};

export default function SidebarNav({
  items,
  sectionLabel,
  isActive,
  onClose,
}: {
  items: SidebarNavItemData[];
  sectionLabel: string;
  isActive: (href: string) => boolean;
  onClose?: () => void;
}) {
  return (
    <nav className="space-y-1">
      <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {sectionLabel}
      </div>

      {items.map((it) => (
        <SidebarNavItem
          key={it.href}
          href={it.href}
          label={it.label}
          icon={it.icon}
          badge={it.badge}
          isActive={isActive(it.href)}
          onClick={onClose}
        />
      ))}
    </nav>
  );
}
