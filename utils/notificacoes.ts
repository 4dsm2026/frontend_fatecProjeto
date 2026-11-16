/** Texto do contador de notificações não lidas no sino: vazio, o número ou "99+". */
export function textoBadgeNaoLidas(unread: number | null): string {
  if (unread === null || unread <= 0) return "";
  if (unread > 99) return "99+";
  return String(unread);
}
