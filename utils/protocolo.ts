/**
 * Como um chamado aparece para o usuário. Nunca usa o id interno do banco:
 * chamados antigos sem protocolo aparecem como "Sem protocolo" (#233).
 * No backend, `pnpm backfill:protocolos` gera protocolo para eles.
 */
export function rotuloProtocolo(protocolo?: string | null): string {
  return protocolo?.trim() || "Sem protocolo";
}
