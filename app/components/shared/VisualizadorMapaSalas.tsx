"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, Loader2, Map as MapIcon } from "lucide-react";
import { getLink } from "../../../utils/hal";
import { ORIGEM_LABEL, carregarPdf, formatarDataHora, formatarTamanho, telaPequena, type MapaAtual } from "../../../utils/mapa-salas";
import Alert from "../ui/Alert";
import Card from "../ui/Card";
import EmptyState from "../ui/EmptyState";

/**
 * Mostra o PDF do mapa de salas atual. O arquivo é protegido: baixa com o token e
 * exibe por um endereço local (blob:). No celular, onde o navegador costuma não
 * mostrar PDF dentro da página, destaca o botão de abrir.
 */
export default function VisualizadorMapaSalas({ mapa }: Readonly<{ mapa: MapaAtual | null }>) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [pequena, setPequena] = useState(false);
  const href = getLink(mapa, "file")?.href;
  // O endereço do mapa atual é sempre o mesmo: o id da versão diz quando ele mudou.
  const versaoId = mapa?.atual?.id;

  useEffect(() => setPequena(telaPequena()), []);

  useEffect(() => {
    if (!href) return;
    let ativo = true;
    let criado: string | null = null;
    setCarregando(true);
    setErro(null);
    carregarPdf(href)
      .then((url) => {
        criado = url;
        if (ativo) setPdfUrl(url);
        else URL.revokeObjectURL(url);
      })
      .catch((e: unknown) => ativo && setErro(e instanceof Error ? e.message : "Não foi possível carregar o mapa."))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
      if (criado) URL.revokeObjectURL(criado);
    };
  }, [href, versaoId]);

  if (mapa && !mapa.atual) {
    return (
      <Card padding="none">
        <EmptyState
          icon={<MapIcon className="size-5" />}
          title="O mapa de salas ainda não foi publicado"
          description="Assim que a Fatec publicar o mapa do semestre, ele aparece aqui."
        />
      </Card>
    );
  }
  if (erro) return <Alert variant="error">{erro}</Alert>;
  const atual = mapa?.atual;

  return (
    <Card className="space-y-3">
      {atual && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{atual.nomeArquivo}</div>
            <div className="text-xs text-muted-foreground">
              Atualizado em {formatarDataHora(atual.publicadoEm)} · {ORIGEM_LABEL[atual.origem]} · {formatarTamanho(atual.tamanhoBytes)}
            </div>
          </div>
          {pdfUrl && (
            <div className="flex flex-wrap gap-2">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  pequena
                    ? "inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm text-primary-foreground hover:opacity-90"
                    : "inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm hover:bg-[var(--muted)]"
                }
              >
                <ExternalLink className="size-4" /> Abrir em nova aba
              </a>
              <a href={pdfUrl} download={atual.nomeArquivo} className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm hover:bg-[var(--muted)]">
                <Download className="size-4" /> Baixar
              </a>
            </div>
          )}
        </div>
      )}

      {carregando && (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Carregando o mapa…
        </div>
      )}
      {pdfUrl && !pequena && (
        <iframe title="Mapa de salas" src={pdfUrl} className="h-[75vh] w-full rounded-lg border border-[var(--border)] bg-white" />
      )}
      {pdfUrl && pequena && (
        <p className="text-sm text-muted-foreground">No celular, toque em “Abrir em nova aba” para ver o mapa em tela cheia.</p>
      )}
    </Card>
  );
}
