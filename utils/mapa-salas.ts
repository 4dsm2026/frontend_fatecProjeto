import { API_BASE, apiFetch, extractApiError } from "./api";
import type { HalResource } from "./hal";

/** Mapa de salas (beta): o PDF publicado pela Fatec no site institucional. */

export type OrigemMapa = "AUTOMATICA" | "MANUAL";

export type VersaoMapa = HalResource & {
  id: string;
  origem: OrigemMapa;
  nomeArquivo: string;
  tamanhoBytes: number;
  checksumSha256: string;
  urlOrigem?: string | null;
  publicadoEm: string;
  publicadoPor?: { id: string; nome?: string | null } | null;
};

export type MapaAtual = HalResource & { atual: VersaoMapa | null };

export type FonteMapa = HalResource & {
  url: string | null;
  xpath: string | null;
  atualizacaoAutomatica: boolean;
  ultimaVerificacaoEm?: string | null;
  ultimoResultado?: string | null;
  ultimoErro?: string | null;
  atualizadoEm?: string | null;
  atualizadoPor?: { id: string; nome?: string | null } | null;
};

export type ResultadoTeste = { urlPdf: string; nomeArquivo: string; tamanhoBytes: number; igualAoAtual: boolean };

export const ORIGEM_LABEL: Record<OrigemMapa, string> = {
  AUTOMATICA: "Site institucional",
  MANUAL: "Envio manual",
};

/** XPath sugerido: o mapa embutido num iframe (como no site da Fatec Cotia). */
export const XPATH_SUGERIDO = "//iframe[contains(@class,'embed-pdf-viewer')]/@src";

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Baixa o PDF com o token (o arquivo é protegido) e devolve um endereço local
 * (blob:) para o visualizador. Quem chama deve liberar com URL.revokeObjectURL.
 */
export async function carregarPdf(href: string): Promise<string> {
  const res = await apiFetch(`${API_BASE}${href}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Não foi possível carregar o mapa de salas."));
  const blob = await res.blob();
  return URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
}

/** Celular e tablet: o navegador costuma não mostrar PDF dentro da página. */
export function telaPequena(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(max-width: 768px)").matches === true;
}
