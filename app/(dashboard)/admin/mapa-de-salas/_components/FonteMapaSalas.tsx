"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, FlaskConical, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { extractApiError } from "../../../../../utils/api";
import { followLink, hasLink } from "../../../../../utils/hal";
import { XPATH_SUGERIDO, formatarDataHora, formatarTamanho, type FonteMapa, type ResultadoTeste } from "../../../../../utils/mapa-salas";
import Alert from "../../../../components/ui/Alert";
import Card from "../../../../components/ui/Card";

const INPUT = "w-full rounded-lg border border-[var(--border)] bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";
const BOTAO = "inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm hover:bg-[var(--muted)] disabled:opacity-60";

/** Configuração da atualização automática: URL da página + XPath do PDF. */
export default function FonteMapaSalas({ fonte, onChanged }: Readonly<{ fonte: FonteMapa; onChanged: () => void | Promise<void> }>) {
  const [url, setUrl] = useState(fonte.url ?? "");
  const [xpath, setXpath] = useState(fonte.xpath ?? "");
  const [automatica, setAutomatica] = useState(fonte.atualizacaoAutomatica);
  const [ocupado, setOcupado] = useState<"" | "testar" | "salvar" | "sincronizar">("");
  const [teste, setTeste] = useState<ResultadoTeste | null>(null);
  const [erroTeste, setErroTeste] = useState<string | null>(null);

  useEffect(() => {
    setTeste(null);
    setErroTeste(null);
    setUrl(fonte.url ?? "");
    setXpath(fonte.xpath ?? "");
    setAutomatica(fonte.atualizacaoAutomatica);
  }, [fonte]);

  const alterou = url !== (fonte.url ?? "") || xpath !== (fonte.xpath ?? "") || automatica !== fonte.atualizacaoAutomatica;

  async function testar() {
    setTeste(null);
    setErroTeste(null);
    try {
      setOcupado("testar");
      const res = await followLink(fonte, "test", { body: JSON.stringify({ url: url.trim(), xpath: xpath.trim() }) });
      if (!res.ok) throw new Error(await extractApiError(res, "O teste falhou."));
      setTeste((await res.json()) as ResultadoTeste);
    } catch (e: unknown) {
      setErroTeste(e instanceof Error ? e.message : "O teste falhou.");
    } finally {
      setOcupado("");
    }
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    try {
      setOcupado("salvar");
      const res = await followLink(fonte, "update", {
        body: JSON.stringify({ url: url.trim() || null, xpath: xpath.trim() || null, atualizacaoAutomatica: automatica }),
      });
      if (!res.ok) throw new Error(await extractApiError(res, "Não foi possível salvar."));
      toast.success("Fonte salva.");
      await onChanged();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setOcupado("");
    }
  }

  async function sincronizar() {
    try {
      setOcupado("sincronizar");
      // Corpo "{}": o apiFetch manda Content-Type JSON, e o servidor recusa JSON vazio.
      const res = await followLink(fonte, "sync", { body: "{}" });
      if (!res.ok) throw new Error(await extractApiError(res, "Não foi possível atualizar."));
      const r = (await res.json()) as { nova: boolean; resultado: string };
      if (r.nova) toast.success(r.resultado);
      else toast.info(r.resultado);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar.");
    } finally {
      setOcupado("");
      await onChanged();
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <div className="text-sm font-semibold">Atualização pelo site institucional</div>
        <p className="text-xs text-muted-foreground">
          O sistema abre a página, acha o PDF pelo XPath e publica uma versão nova só quando o arquivo muda.
        </p>
      </div>

      <form onSubmit={salvar} className="space-y-4">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">URL da página</span>
          <input className={INPUT} type="url" inputMode="url" placeholder="https://fatec….cps.sp.gov.br/mapa-de-salas/" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">XPath do PDF</span>
          <input className={`${INPUT} font-mono text-xs`} placeholder={XPATH_SUGERIDO} value={xpath} onChange={(e) => setXpath(e.target.value)} spellCheck={false} />
          <span className="block text-xs text-muted-foreground">
            No Chrome: clique com o botão direito no mapa → Inspecionar → botão direito no elemento → Copiar → Copiar XPath, e
            acrescente <code>/@src</code> (iframe) ou <code>/@href</code> (link). Para o mapa embutido como no site da Fatec Cotia:{" "}
            <button type="button" className="font-mono text-primary underline" onClick={() => setXpath(XPATH_SUGERIDO)}>
              {XPATH_SUGERIDO}
            </button>
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" checked={automatica} onChange={(e) => setAutomatica(e.target.checked)} />
          Conferir automaticamente todo dia (06:00)
        </label>

        {teste && (
          <Alert variant="success" title="PDF encontrado">
            <div className="break-all">{teste.urlPdf}</div>
            <div>
              {teste.nomeArquivo} · {formatarTamanho(teste.tamanhoBytes)} · {teste.igualAoAtual ? "igual ao mapa publicado" : "diferente do mapa publicado"}
            </div>
          </Alert>
        )}
        {erroTeste && <Alert variant="error" title="O teste falhou">{erroTeste}</Alert>}

        <div className="flex flex-wrap gap-2">
          <button type="button" className={BOTAO} onClick={testar} disabled={!url.trim() || !xpath.trim() || !!ocupado}>
            {ocupado === "testar" ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />} Testar
          </button>
          <button type="submit" className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-60" disabled={!alterou || !!ocupado}>
            {ocupado === "salvar" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar
          </button>
          {hasLink(fonte, "sync") && (
            <button type="button" className={BOTAO} onClick={sincronizar} disabled={alterou || !!ocupado} title={alterou ? "Salve antes de atualizar" : undefined}>
              {ocupado === "sincronizar" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Atualizar agora
            </button>
          )}
        </div>
      </form>

      {fonte.ultimaVerificacaoEm && (
        <div className="border-t border-[var(--border)] pt-3 text-xs">
          <span className="text-muted-foreground">Última verificação: {formatarDataHora(fonte.ultimaVerificacaoEm)} · </span>
          {fonte.ultimoErro ? (
            <span className="text-destructive">{fonte.ultimoErro}</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[var(--success)]">
              <CheckCircle2 className="size-3.5" /> {fonte.ultimoResultado}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
