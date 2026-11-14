"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, apiFetch, extractApiError } from "../../../../utils/api";
import { embedded, getLink, hasLink, type HalCollection } from "../../../../utils/hal";
import { ORIGEM_LABEL, carregarPdf, formatarDataHora, formatarTamanho, type FonteMapa, type MapaAtual, type VersaoMapa } from "../../../../utils/mapa-salas";
import BetaBadge from "../../../components/shared/BetaBadge";
import VisualizadorMapaSalas from "../../../components/shared/VisualizadorMapaSalas";
import Alert from "../../../components/ui/Alert";
import Card from "../../../components/ui/Card";
import FonteMapaSalas from "./_components/FonteMapaSalas";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Equipe: vê o mapa e o histórico. Administrador: também configura a fonte
 * automática e envia o PDF à mão. Cada parte aparece se a API deu o link.
 */
export default function AdminMapaDeSalasPage() {
  const [mapa, setMapa] = useState<MapaAtual | null>(null);
  const [fonte, setFonte] = useState<FonteMapa | null>(null);
  const [versoes, setVersoes] = useState<VersaoMapa[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch(`${API_BASE}/room-maps/current`, { cache: "no-store" });
      if (!r.ok) throw new Error(await extractApiError(r, "Não foi possível carregar o mapa de salas."));
      const m = (await r.json()) as MapaAtual;
      setMapa(m);
      const [rf, rv] = await Promise.all([
        hasLink(m, "source") ? apiFetch(`${API_BASE}${getLink(m, "source")?.href}`, { cache: "no-store" }) : Promise.resolve(null),
        hasLink(m, "versions") ? apiFetch(`${API_BASE}${getLink(m, "versions")?.href}?page=0&size=20`, { cache: "no-store" }) : Promise.resolve(null),
      ]);
      if (rf?.ok) setFonte((await rf.json()) as FonteMapa);
      if (rv?.ok) setVersoes(embedded<VersaoMapa>((await rv.json()) as HalCollection<VersaoMapa>, "room-map-versions"));
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o mapa de salas.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function enviar(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo || !mapa) return;
    if (arquivo.size > MAX_BYTES) {
      toast.error("O PDF passa de 10 MB.");
      return;
    }
    if (arquivo.type && arquivo.type !== "application/pdf") {
      toast.error("Envie um arquivo PDF.");
      return;
    }
    const form = new FormData();
    form.append("file", arquivo, arquivo.name);
    try {
      setEnviando(true);
      const res = await apiFetch(`${API_BASE}${getLink(mapa, "upload")?.href}`, { method: "POST", body: form });
      if (!res.ok) throw new Error(await extractApiError(res, "Não foi possível enviar o PDF."));
      const r = (await res.json()) as { nova: boolean };
      if (r.nova) toast.success("Mapa publicado.");
      else toast.info("Esse PDF é igual ao mapa publicado: nada mudou.");
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o PDF.");
    } finally {
      setEnviando(false);
    }
  }

  async function abrirVersao(v: VersaoMapa) {
    const href = getLink(v, "file")?.href;
    if (!href) return;
    try {
      const url = await carregarPdf(href);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Não foi possível abrir a versão.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-grotesk text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
          Mapa de salas <BetaBadge />
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">O PDF que os alunos veem em “Mapa de salas”.</p>
      </div>

      {erro && <Alert variant="error">{erro}</Alert>}

      {(fonte || hasLink(mapa, "upload")) && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          {fonte && <FonteMapaSalas fonte={fonte} onChanged={load} />}
          {hasLink(mapa, "upload") && (
            <Card className="space-y-3 self-start">
              <div className="text-sm font-semibold">Enviar o PDF manualmente</div>
              <p className="text-xs text-muted-foreground">Use quando o site estiver fora do ar ou o mapa ainda não tiver sido publicado lá. Até 10 MB.</p>
              <input ref={arquivoRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={enviar} aria-label="Escolher PDF do mapa de salas" />
              <button
                type="button"
                onClick={() => arquivoRef.current?.click()}
                disabled={enviando}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm hover:bg-[var(--muted)] disabled:opacity-60"
              >
                {enviando ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />} Escolher PDF
              </button>
            </Card>
          )}
        </div>
      )}

      <VisualizadorMapaSalas mapa={mapa} />

      {versoes.length > 0 && (
        <Card className="space-y-3">
          <div className="text-sm font-semibold">Histórico</div>
          <ul className="divide-y divide-[var(--border)]">
            {versoes.map((v, i) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {v.nomeArquivo} {i === 0 && <span className="ml-1 rounded border border-[var(--success)]/30 bg-[var(--success)]/10 px-1.5 text-xs text-[var(--success)]">atual</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatarDataHora(v.publicadoEm)} · {ORIGEM_LABEL[v.origem]}
                    {v.publicadoPor?.nome ? ` por ${v.publicadoPor.nome}` : ""} · {formatarTamanho(v.tamanhoBytes)}
                  </div>
                </div>
                <button type="button" onClick={() => abrirVersao(v)} className="text-sm text-primary hover:underline">
                  Abrir
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
