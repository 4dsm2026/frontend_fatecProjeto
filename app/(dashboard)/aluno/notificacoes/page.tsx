"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, extractApiError } from "../../../../utils/api";
import { collectPages, followLink, hasLink } from "../../../../utils/hal";
import type { HalResource } from "../../../../utils/hal";
import {
  Bell,
  Loader2,
  MessageSquareText,
  Paperclip,
  Check,
  CheckCheck,
  Info,
  AlertCircle,
  Ticket,
} from "lucide-react";
import MobileSidebarTriggerAluno from "../_components/MobileSidebarTriggerAluno";
import { cx } from "../../../../utils/cx";

type Tipo =
  | "CHAMADO_CRIADO"
  | "CHAMADO_ATRIBUIDO"
  | "CHAMADO_ATUALIZADO"
  | "STATUS_ALTERADO"
  | "MENSAGEM_NOVA"
  | "ANEXO_NOVO"
  | "SISTEMA";

type Notificacao = HalResource & {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: Tipo;
  criadoEm: string;
  lidaEm?: string | null;
  arquivadaEm?: string | null;
  chamadoId?: string | null;
  meta?: Record<string, unknown> | null;
};



const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

function TipoIcon({ tipo }: { tipo: Tipo }) {
  const cls = "size-3.5";
  switch (tipo) {
    case "MENSAGEM_NOVA": return <MessageSquareText className={cls} />;
    case "ANEXO_NOVO": return <Paperclip className={cls} />;
    case "SISTEMA": return <Info className={cls} />;
    default: return <Bell className={cls} />;
  }
}

function tipoLabel(tipo: Tipo): string {
  switch (tipo) {
    case "MENSAGEM_NOVA": return "Nova mensagem";
    case "ANEXO_NOVO": return "Novo anexo";
    case "CHAMADO_CRIADO": return "Chamado criado";
    case "CHAMADO_ATRIBUIDO": return "Chamado atribuído";
    case "CHAMADO_ATUALIZADO": return "Chamado atualizado";
    case "STATUS_ALTERADO": return "Status alterado";
    case "SISTEMA": return "Sistema";
    default: return "Notificação";
  }
}

export default function NotificacoesAlunoPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifs, setNotifs] = useState<Notificacao[]>([]);
  const [collection, setCollection] = useState<HalResource | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const unread = useMemo(() => notifs.filter((n) => !n.lidaEm).length, [notifs]);
  const unreadLabel = unread === 1 ? "1 não lida" : `${unread} não lidas`;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        `${API_BASE}/notifications?page=0&size=100`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `Erro ${res.status}`);
      }
      const data = await res.json();
      setCollection(data);
      setNotifs(await collectPages<Notificacao>(data, "notifications"));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar as notificações.");
      setNotifs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function dispatchRead() {
    window.dispatchEvent(new CustomEvent("notificacoes-lidas"));
  }

  async function markAsRead(id: string) {
    setMarking(id);
    try {
      const item = notifs.find((n) => n.id === id);
      if (!hasLink(item, "mark-read")) return;
      const res = await followLink(item, "mark-read", { body: JSON.stringify({ lida: true }) });
      if (!res.ok) throw new Error(await extractApiError(res, "Falha ao marcar como lida."));
      setNotifs((xs) =>
        xs.map((n) => (n.id === id ? { ...n, lidaEm: new Date().toISOString() } : n))
      );
      dispatchRead();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao marcar como lida.");
    } finally {
      setMarking(null);
    }
  }

  async function markAllAsRead() {
    setMarkingAll(true);
    try {
      if (!hasLink(collection, "mark-all-read")) return;
      const res = await followLink(collection, "mark-all-read", { body: JSON.stringify({ lida: true }) });
      if (!res.ok) throw new Error(await extractApiError(res, "Falha ao marcar notificações."));
      setNotifs((xs) =>
        xs.map((n) => ({ ...n, lidaEm: n.lidaEm ?? new Date().toISOString() }))
      );
      dispatchRead();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao marcar notificações.");
    } finally {
      setMarkingAll(false);
    }
  }

  /* Agrupa notificações: com chamadoId ficam juntas; sem ficam em "Avisos gerais" */
  const { ticketEntries, generalNotifs } = useMemo(() => {
    const byTicket = new Map<string, Notificacao[]>();
    const general: Notificacao[] = [];
    for (const n of notifs) {
      if (n.chamadoId && hasLink(n, "ticket")) {
        const arr = byTicket.get(n.chamadoId) ?? [];
        arr.push(n);
        byTicket.set(n.chamadoId, arr);
      } else {
        general.push(n);
      }
    }
    return { ticketEntries: Array.from(byTicket.entries()), generalNotifs: general };
  }, [notifs]);

  return (
    <div className="space-y-6">
      <div className="mb-2 flex items-center justify-between">
        <MobileSidebarTriggerAluno />
      </div>

      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-grotesk text-2xl font-semibold tracking-tight">Notificações</h1>
          {!loading && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {unread > 0 ? unreadLabel : "Tudo em dia"}
            </p>
          )}
        </div>
        {unread > 0 && hasLink(collection, "mark-all-read") && (
          <button type="button"
            onClick={markAllAsRead}
            disabled={markingAll}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-[var(--border)] bg-background hover:bg-[var(--muted)] text-sm disabled:opacity-50 shrink-0"
          >
            {markingAll
              ? <Loader2 className="size-3.5 animate-spin" />
              : <CheckCheck className="size-3.5" />}
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Erro */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      )}
        {!loading && notifs.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-card p-10 flex flex-col items-center gap-2 text-center">
          <Bell className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma notificação no momento.</p>
        </div>
      )}
        {!loading && notifs.length > 0 && (
        <div className="space-y-4">

          {/* Blocos por chamado */}
          {ticketEntries.map(([chamadoId, items]) => {
            const groupUnread = items.filter((n) => !n.lidaEm).length;
            const protocolo = items[0]?.meta?.protocolo as string | undefined;

            return (
              <div
                key={chamadoId}
                className="rounded-xl border border-[var(--border)] bg-card overflow-hidden"
              >
                {/* Cabeçalho do grupo */}
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--muted)]/40">
                  <div className="flex items-center gap-2">
                    <Ticket className="size-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">
                      {protocolo ? `Chamado ${protocolo}` : "Solicitação"}
                    </span>
                    {groupUnread > 0 && (
                      <span className="inline-flex items-center h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium justify-center">
                        {groupUnread}
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/aluno/chamados/${chamadoId}`}
                    className="text-xs text-[var(--brand-cyan)] hover:underline shrink-0"
                  >
                    Ver solicitação →
                  </Link>
                </div>

                {/* Itens do grupo */}
                <ul className="divide-y divide-[var(--border)]">
                  {items.map((n) => (
                    <NotifItem
                      key={n.id}
                      n={n}
                      marking={marking}
                      onMark={markAsRead}
                    />
                  ))}
                </ul>
              </div>
            );
          })}

          {/* Avisos gerais (sem chamado vinculado) */}
          {generalNotifs.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--muted)]/40">
                <Bell className="size-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium">Avisos gerais</span>
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {generalNotifs.map((n) => (
                  <NotifItem
                    key={n.id}
                    n={n}
                    marking={marking}
                    onMark={markAsRead}
                    showTitle
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Item de notificação ---------- */
function NotifItem({
  n,
  marking,
  onMark,
  showTitle = false,
}: {
  n: Notificacao;
  marking: string | null;
  onMark: (id: string) => void;
  showTitle?: boolean;
}) {
  return (
    <li
      className={cx(
        "px-4 py-3 flex items-start gap-3 transition",
        !n.lidaEm ? "bg-[var(--brand-cyan)]/10" : "",
      )}
    >
      <span className="mt-0.5 inline-flex items-center justify-center h-6 w-6 shrink-0 rounded-md border border-[var(--border)] bg-background text-muted-foreground">
        <TipoIcon tipo={n.tipo} />
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {showTitle
            ? <strong className="text-sm">{n.titulo}</strong>
            : <span className="text-xs font-medium text-muted-foreground">{tipoLabel(n.tipo)}</span>
          }
          {!n.lidaEm && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md border bg-[var(--brand-cyan)]/15 text-[var(--brand-cyan)] border-[var(--brand-cyan)]/30">
              novo
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-foreground/90">{n.mensagem}</p>
        <time className="text-xs text-muted-foreground">
          {new Date(n.criadoEm).toLocaleString("pt-BR")}
        </time>
      </div>

      {!n.lidaEm && hasLink(n, "mark-read") && (
        <button type="button"
          onClick={() => onMark(n.id)}
          disabled={marking === n.id}
          title="Marcar como lida"
          className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-md border border-[var(--border)] hover:bg-[var(--muted)] disabled:opacity-50"
        >
          {marking === n.id
            ? <Loader2 className="size-3 animate-spin" />
            : <Check className="size-3" />}
        </button>
      )}
    </li>
  );
}
