import { extractApiError } from "./api";
import { embedded, followLink, getLink, hasLink } from "./hal";
import type { HalCollection, HalResource } from "./hal";

export type TicketAttachment = HalResource & {
  id: string;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
  enviadoEm: string;
  enviadoPor?: { id: string; nome?: string | null } | null;
};

/** Carrega todas as páginas; uma falha não deve parecer uma lista completa. */
export async function listTicketAttachments(ticket: HalResource): Promise<TicketAttachment[]> {
  if (!hasLink(ticket, "attachments")) return [];
  let response = await followLink(ticket, "attachments", { cache: "no-store" });
  const attachments: TicketAttachment[] = [];
  const visited = new Set<string>();
  for (;;) {
    if (!response.ok) throw new Error(await extractApiError(response, "Falha ao carregar anexos"));
    const page: HalCollection<TicketAttachment> = await response.json();
    attachments.push(...embedded(page, "attachments"));
    if (!hasLink(page, "next")) return attachments;
    const href = getLink(page, "next")?.href;
    if (!href || visited.has(href) || visited.size >= 50) {
      throw new Error("Não foi possível concluir a paginação dos anexos");
    }
    visited.add(href);
    response = await followLink(page, "next", { cache: "no-store" });
  }
}

export async function uploadTicketAttachment(ticket: HalResource, file: File): Promise<TicketAttachment> {
  const form = new FormData();
  form.append("file", file);
  const response = await followLink(ticket, "upload", { body: form });
  if (!response.ok) throw new Error(await extractApiError(response, "Falha ao enviar arquivo"));
  return response.json();
}

export async function attachmentImageUrl(attachment: TicketAttachment): Promise<string | null> {
  if (!hasLink(attachment, "content")) return null;
  const response = await followLink(attachment, "content");
  if (!response.ok) throw new Error(await extractApiError(response, "Falha ao carregar imagem"));
  return URL.createObjectURL(await response.blob());
}

export async function downloadTicketAttachment(attachment: TicketAttachment): Promise<void> {
  const response = await followLink(attachment, "content");
  if (!response.ok) throw new Error(await extractApiError(response, "Falha ao baixar arquivo"));
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = attachment.nomeArquivo;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
