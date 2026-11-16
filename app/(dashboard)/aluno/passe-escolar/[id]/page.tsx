"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, ExternalLink, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, apiFetch, extractApiError } from "../../../../../utils/api";
import { followLink, hasLink } from "../../../../../utils/hal";
import {
  EMTU_PASSE_URL,
  STATUS_PASSE_ORIENTACAO,
  corpoDoFormulario,
  formularioDoPasse,
  type PasseDetalhe,
  type PasseFormulario,
} from "../../../../../utils/passe-escolar";
import BetaBadge from "../../../../components/shared/BetaBadge";
import PasseEscolarAcoes from "../../../../components/shared/PasseEscolarAcoes";
import PasseEscolarDados from "../../../../components/shared/PasseEscolarDados";
import PasseEscolarEtapas from "../../../../components/shared/PasseEscolarEtapas";
import PasseEscolarHistorico from "../../../../components/shared/PasseEscolarHistorico";
import PasseEscolarStatusBadge from "../../../../components/shared/PasseEscolarStatusBadge";
import Alert from "../../../../components/ui/Alert";
import Card from "../../../../components/ui/Card";
import FormPasseEscolar from "../_components/FormPasseEscolar";

export default function DetalhePasseEscolarAlunoPage() {
  const params = useParams();
  const id = params?.id as string;

  const [passe, setPasse] = useState<PasseDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await apiFetch(`${API_BASE}/school-passes/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!res.ok) {
        setErro(res.status === 404 ? "Pedido não encontrado." : await extractApiError(res, "Não foi possível carregar o pedido."));
        return;
      }
      setPasse((await res.json()) as PasseDetalhe);
      setErro(null);
    } catch {
      setErro("Não foi possível carregar o pedido.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function salvarCorrecao(f: PasseFormulario) {
    if (!passe) return;
    try {
      setSalvando(true);
      const res = await followLink(passe, "update", { body: JSON.stringify(corpoDoFormulario(f)) });
      if (!res.ok) throw new Error(await extractApiError(res, "Não foi possível salvar."));
      toast.success(passe.status === "PENDENTE_ALUNO" ? "Dados reenviados à Secretaria." : "Dados atualizados.");
      setEditando(false);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  const podeEditar = hasLink(passe, "update");
  const pendente = passe?.status === "PENDENTE_ALUNO";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/aluno/passe-escolar" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ChevronLeft className="size-4" /> Passe Escolar
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-grotesk text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
            {passe ? `Pedido de ${passe.anoReferencia}` : "Pedido"} <BetaBadge />
          </h1>
          {passe && <PasseEscolarStatusBadge status={passe.status} />}
        </div>
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      )}
      {erro && <Alert variant="error">{erro}</Alert>}

      {passe && !loading && (
        <>
          <Card className="space-y-5">
            <PasseEscolarEtapas status={passe.status} historico={passe.historico} />

            {pendente && passe.orientacaoFatec && (
              <Alert variant="warning" title="O que a Secretaria pediu">
                <p className="whitespace-pre-wrap">{passe.orientacaoFatec}</p>
              </Alert>
            )}
            {passe.status === "INDEFERIDO" && passe.orientacaoFatec && (
              <Alert variant="error" title="Motivo">
                <p className="whitespace-pre-wrap">{passe.orientacaoFatec}</p>
              </Alert>
            )}

            <p className="text-sm text-muted-foreground">{STATUS_PASSE_ORIENTACAO[passe.status]}</p>

            {passe.status === "CADASTRADO_PORTAL" && (
              <Alert variant="info" title="Passo a passo na EMTU">
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Confira pelo CPF, em “Acompanhe sua solicitação”, se o seu cadastro já aparece.</li>
                  <li>Preencha o formulário (“Requisite aqui”) da sua região e pague o boleto.</li>
                  <li>Envie os documentos pelo site, em .jpg ou .pdf de até 500 KB cada.</li>
                  <li>Volte aqui e clique em “Já requisitei na EMTU”.</li>
                </ol>
                <a href={EMTU_PASSE_URL} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 font-medium hover:underline">
                  Abrir o site da EMTU <ExternalLink className="size-3.5" />
                </a>
              </Alert>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              {podeEditar && !editando && (
                <button type="button" onClick={() => setEditando(true)} className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm hover:bg-[var(--muted)]">
                  <Pencil className="size-4" /> {pendente ? "Corrigir e reenviar" : "Corrigir dados"}
                </button>
              )}
              <div className="ml-auto">
                <PasseEscolarAcoes passe={passe} quem="aluno" onChanged={load} />
              </div>
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="text-sm font-semibold">{editando ? "Corrigir dados" : "Dados enviados"}</div>
            {editando ? (
              <FormPasseEscolar
                valorInicial={formularioDoPasse(passe)}
                rotuloEnvio={pendente ? "Reenviar com correções" : "Salvar"}
                enviando={salvando}
                onSubmit={salvarCorrecao}
                onCancel={() => setEditando(false)}
              />
            ) : (
              <PasseEscolarDados passe={passe} />
            )}
          </Card>

          <Card className="space-y-3">
            <div className="text-sm font-semibold">Histórico</div>
            <PasseEscolarHistorico historico={passe.historico ?? []} />
          </Card>
        </>
      )}
    </div>
  );
}
