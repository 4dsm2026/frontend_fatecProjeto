"use client";

import {
  LayoutDashboard,
  Ticket,
  Users,
  UserPlus,
  FileChartColumn,
  Settings,
  MessageSquareText,
  MessageSquarePlus,
  Building2,
  LogOut,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "../../../../utils/api";
import SidebarNavItem from "../../../components/shared/SidebarNavItem";
import { useSidebarLogout } from "../../../components/shared/useSidebarLogout";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

type NavItemProps = {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
};

export default function SidebarAdmin({
  chamadosAbertosCount = 0,
  notificacoesCount = 0,
  pendenciasCount = 0,
  mensagensCount = 0,
  onClose,
}: {
  chamadosAbertosCount?: number;
  notificacoesCount?: number;
  pendenciasCount?: number;
  mensagensCount?: number;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const handleLogout = useSidebarLogout(onClose);

  const [slaMedioDias, setSlaMedioDias] = useState<number | null>(null);
  const [pctResolvidos, setPctResolvidos] = useState<number | null>(null);
  const [chamadosAbertosReal, setChamadosAbertosReal] = useState<number | null>(
    null
  );

  useEffect(() => {
    apiFetch(`${API_BASE}/tickets/stats`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;

        setSlaMedioDias(data.slaMedioDias ?? null);
        setPctResolvidos(data.pctResolvidos ?? null);
        setChamadosAbertosReal(data.porStatus?.ABERTO ?? null);
      })
      .catch(() => {});
  }, []);

  const chamadosBadge = chamadosAbertosReal ?? chamadosAbertosCount;

  const items: NavItemProps[] = useMemo(
    () => [
      {
        href: "/admin/home",
        label: "Visão Geral",
        icon: <LayoutDashboard className="size-4" />,
      },
      {
        href: "/admin/chamados",
        label: "Todos os Chamados",
        icon: <Ticket className="size-4" />,
        badge: chamadosBadge || undefined,
      },
      {
        href: "/admin/alunos",
        label: "Gerenciar Alunos",
        icon: <Users className="size-4" />,
        badge: pendenciasCount || undefined,
      },
      {
        href: "/admin/funcionarios",
        label: "Gerenciar Funcionários",
        icon: <UserPlus className="size-4" />,
      },
      {
        href: "/admin/comunicacoes",
        label: "Comunicações",
        icon: <MessageSquareText className="size-4" />,
        badge: notificacoesCount || undefined,
      },
      {
        href: "/admin/sugestoes",
        label: "Caixa de Sugestões",
        icon: <MessageSquarePlus className="size-4" />,
      },
      {
        href: "/admin/relatorios",
        label: "Relatórios",
        icon: <FileChartColumn className="size-4" />,
      },
      {
        href: "/admin/setores",
        label: "Setores",
        icon: <Building2 className="size-4" />,
      },
      {
        href: "/admin/configuracoes",
        label: "Configurações",
        icon: <Settings className="size-4" />,
      },
    ],
    [chamadosBadge, notificacoesCount, pendenciasCount]
  );

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";

    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="xl:sticky xl:top-4 xl:self-start w-full xl:w-[260px]">
      <div className="rounded-2xl border border-[var(--border)] bg-card p-3 flex flex-col min-h-[520px]">
        {/* Header */}
        <div className="mb-2 flex items-center gap-2 px-2 select-none">
          <div className="size-8 rounded-lg bg-primary grid place-items-center text-primary-foreground text-xs font-bold">
            WF
          </div>
          <div>
            <div className="font-grotesk text-sm font-semibold">
              Secretaria
            </div>
            <div className="text-xs text-muted-foreground">
              Sistema de Gestão
            </div>
          </div>
        </div>

        {/* Navegação */}
        <nav className="space-y-1">
          <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
            Visão Geral
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

        {/* Indicadores rápidos */}
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-background p-3">
          <div className="text-xs text-muted-foreground mb-2">
            Indicadores rápidos
          </div>

          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span>SLA médio (dias)</span>
              <span className="font-medium">
                {slaMedioDias != null ? slaMedioDias.toFixed(1) : "—"}
              </span>
            </li>

            <li className="flex items-center justify-between">
              <span>% resolvidos</span>
              <span className="font-medium">
                {pctResolvidos != null ? `${pctResolvidos}%` : "—"}
              </span>
            </li>

            <li className="flex items-center justify-between">
              <span>Pendências</span>
              <span className="font-medium">{pendenciasCount}</span>
            </li>
          </ul>
        </div>

        {/* Sair */}
        <div className="mt-auto pt-3">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] text-sm"
          >
            <LogOut className="size-4" />
            Sair
          </button>
        </div>
      </div>
    </aside>
  );
}