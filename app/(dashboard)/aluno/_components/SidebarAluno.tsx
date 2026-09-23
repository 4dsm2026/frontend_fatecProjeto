"use client";

import {
  LayoutDashboard,
  Ticket,
  BookOpen,
  User,
  HelpCircle,
  Settings,
  Bell,
  LogOut,
  MessageSquarePlus,
} from "lucide-react";
import { usePathname } from "next/navigation";
import SidebarNav, {
  type SidebarNavItemData,
} from "../../../components/shared/SidebarNav";
import { useSidebarLogout } from "../../../components/shared/useSidebarLogout";

export default function SidebarAluno({
  aguardandoCount = 0,
  meusChamadosCount = 0,
  onClose,
}: {
  aguardandoCount?: number;
  meusChamadosCount?: number;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const handleLogout = useSidebarLogout(onClose);

  const items: SidebarNavItemData[] = [
    {
      href: "/aluno/home",
      label: "Visão Geral",
      icon: <LayoutDashboard className="size-4" />,
    },
    {
      href: "/aluno/chamados",
      label: "Minhas solicitações",
      icon: <Ticket className="size-4" />,
    },
    {
      href: "/aluno/catalogo",
      label: "Catálogo de serviços",
      icon: <BookOpen className="size-4" />,
    },
    {
      href: "/aluno/dados",
      label: "Meus dados",
      icon: <User className="size-4" />,
    },
    {
      href: "/aluno/notificacoes",
      label: "Notificações",
      icon: <Bell className="size-4" />,
    },
    {
      href: "/aluno/sugestoes",
      label: "Caixa de Sugestões",
      icon: <MessageSquarePlus className="size-4" />,
    },
    {
      href: "/aluno/ajuda",
      label: "Ajuda / FAQ",
      icon: <HelpCircle className="size-4" />,
    },
    {
      href: "/aluno/configuracoes",
      label: "Configurações",
      icon: <Settings className="size-4" />,
    },
  ];

  function isActive(href: string) {
    // Mantém o item ativo também nas páginas de detalhes.
    if (href === "/home/aluno") {
      return pathname === "/home/aluno" || pathname === "/aluno";
    }

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
              Portal do Aluno
            </div>
            <div className="text-xs text-muted-foreground">
              Autoatendimento
            </div>
          </div>
        </div>

        {/* Navegação */}
        <SidebarNav
          items={items}
          sectionLabel="Geral"
          isActive={isActive}
          onClose={onClose}
        />

        {/* Indicadores rápidos */}
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-background p-3">
          <div className="text-xs text-muted-foreground mb-2">
            Indicadores rápidos
          </div>

          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span>Aguardando resposta</span>
              <span className="font-medium">{aguardandoCount}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Minhas solicitações</span>
              <span className="font-medium">{meusChamadosCount}</span>
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