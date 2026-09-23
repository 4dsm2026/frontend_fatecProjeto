"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Loader2, Moon, Sun } from "lucide-react";
import { apiFetch } from "../../../../utils/api";
import { cx } from "../../../../utils/cx";

type Props = {
  notificationsHref?: string;
  pollMs?: number;
};

function getInitialTheme(): "light" | "dark" {
  const stored = localStorage.getItem("theme") as "light" | "dark" | null;
  return stored === "dark" ? "dark" : "light";
}

function applyThemeClass(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function getBadgeText(unread: number | null) {
  if (unread === null) return "";
  if (unread > 99) return "99+";
  if (unread > 0) return String(unread);
  return "";
}

function UserHeading({
  loading,
  nome,
  email,
}: {
  loading: boolean;
  nome: string | null;
  email: string | null;
}) {
  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Carregando usuário…
      </div>
    );
  }
  if (!nome) {
    return <h1 className="text-muted-foreground">Usuário não identificado</h1>;
  }
  return (
    <>
      <h1 className="font-grotesk text-2xl sm:text-3xl font-semibold tracking-tight">
        {nome}
      </h1>
      {email && <p className="text-sm text-muted-foreground">{email}</p>}
    </>
  );
}

function ThemeToggleButton({
  mounted,
  theme,
  setTheme,
}: {
  mounted: boolean;
  theme: "light" | "dark";
  setTheme: React.Dispatch<React.SetStateAction<"light" | "dark">>;
}) {
  if (!mounted) {
    return <div className="h-9 w-9 rounded-lg border border-[var(--border)] bg-background" />;
  }
  const isDark = theme === "dark";
  return (
    <button type="button"
      aria-label="Alternar tema"
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-[var(--border)] bg-background hover:bg-[var(--muted)]"
      title={isDark ? "Tema claro" : "Tema escuro"}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

function NotificationLink({
  href,
  unread,
  loadingUnread,
  badgeText,
}: {
  href: string;
  unread: number | null;
  loadingUnread: boolean;
  badgeText: string;
}) {
  const hasUnread = !loadingUnread && !!unread && unread > 0;
  const titleUnread = !!unread && unread > 0;

  return (
    <Link
      href={href}
      className={cx(
        "relative inline-flex items-center justify-center h-9 w-9 rounded-lg border bg-background hover:bg-[var(--muted)]",
        hasUnread
          ? "border-red-400/70 dark:border-red-700/50"
          : "border-[var(--border)]",
      )}
      aria-label="Notificações"
      title={titleUnread ? `${unread} notificação(ões) não lida(s)` : "Notificações"}
    >
      <Bell className={cx("size-4", hasUnread ? "text-red-500 dark:text-red-400" : "")} />
      {loadingUnread ? (
        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] grid place-items-center">
          <Loader2 className="size-3 animate-spin" />
        </span>
      ) : titleUnread ? (
        <span className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-red-500 text-white text-[10px] grid place-items-center px-1">
          {badgeText}
        </span>
      ) : null}
    </Link>
  );
}

export default function SistemaTopbar({
  notificationsHref = "/admin/notificacoes",
  pollMs = 60_000,
}: Props) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [mounted, setMounted] = useState(false);

  const [loadingUser, setLoadingUser] = useState(true);
  const [userNome, setUserNome] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [unread, setUnread] = useState<number | null>(null);
  const [loadingUnread, setLoadingUnread] = useState(true);

  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setMounted(true);
    try {
      const stored = getInitialTheme();
      setTheme(stored);
      applyThemeClass(stored);
    } catch {}
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      applyThemeClass(theme);
      localStorage.setItem("theme", theme);
    } catch {}
  }, [theme, mounted]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch(`${apiBase}/auth/me`, { cache: "no-store" });
        const data = await res.json();
        if (!alive) return;
        setUserNome(data?.nome ?? null);
        setUserEmail(data?.emailPessoal ?? data?.email ?? null);
      } catch {
        setUserNome(null);
        setUserEmail(null);
      } finally {
        if (alive) setLoadingUser(false);
      }
    })();
    return () => { alive = false; };
  }, [apiBase]);

  async function fetchUnread() {
    try {
      setLoadingUnread(true);
      const res = await apiFetch(
        `${apiBase}/notifications?apenasNaoLidas=1&page=1&pageSize=1`,
        { cache: "no-store" }
      );
      const data = await res.json();
      setUnread(Number(data?.total ?? 0));
    } catch {
      setUnread(0);
    } finally {
      setLoadingUnread(false);
    }
  }

  useEffect(() => {
    fetchUnread();
    const t = setInterval(fetchUnread, pollMs);
    return () => clearInterval(t);
  }, [pollMs]);

  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <UserHeading loading={loadingUser} nome={userNome} email={userEmail} />
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggleButton mounted={mounted} theme={theme} setTheme={setTheme} />
        <NotificationLink
          href={notificationsHref}
          unread={unread}
          loadingUnread={loadingUnread}
          badgeText={getBadgeText(unread)}
        />
      </div>
    </div>
  );
}
