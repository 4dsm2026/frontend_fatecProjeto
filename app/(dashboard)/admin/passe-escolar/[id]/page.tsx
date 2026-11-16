"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import { API_BASE, apiFetch, extractApiError } from "../../../../../utils/api";
import { STATUS_PASSE_LABEL, formatarDataHora, type PasseDetalhe } from "../../../../../utils/passe-escolar";
import BetaBadge from "../../../../components/shared/BetaBadge";
import PasseEscolarAcoes from "../../../../components/shared/PasseEscolarAcoes";
import PasseEscolarDados from "../../../../components/shared/PasseEscolarDados";
import PasseEscolarEtapas from "../../../../components/shared/PasseEscolarEtapas";
import PasseEscolarHistorico from "../../../../components/shared/PasseEscolarHistorico";
import PasseEscolarStatusBadge from "../../../../components/shared/PasseEscolarStatusBadge";
import Alert from "../../../../components/ui/Alert";
import Card from "../../../../components/ui/Card";

/** O que a Secretaria faz em cada etapa. */
const PROXIMO_PASSO: Partial<Record<PasseDetalhe["status"], string>> = {
  SOLICITADO:
    "Confira os dados com a matrícula (nome, RG, CPF, curso, período, ano de conclusão) e lance no Portal de Relacionamento da ARTESP/EMTU. Depois, marque como cadastrado. Se algo estiver errado, peça correção ao aluno.",
  PENDENTE_ALUNO: "Aguardando o aluno corrigir. Quando ele reenviar, o pedido volta para \"Aguardando a Fatec\".",
  CADASTRADO_PORTAL: "Nada a fazer por enquanto: o aluno requisita no site da EMTU. Se ele avisar por outro canal, você pode marcar a requisição por ele.",
  REQUISITADO_EMTU: "A EMTU analisa em até 10 dias úteis. O aluno registra o resultado; você também pode, se souber.",
  CONCLUIDO: "Benefício ativo. Se o aluno sair da Fatec, cancele e exclua o cadastro do portal.",
};

export default function DetalhePasseEscolarAdminPage() {
  const params = useParams();
  const id = params?.id as string;

  const [passe, setPasse] = useState<PasseDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/admin/passe-escolar" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ChevronLeft className="size-4" /> Passe Escolar
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-grotesk text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
              {passe?.nomeCompleto ?? "Pedido"} <BetaBadge />
            </h1>
            {passe && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {passe.usuario?.ra ? `R.A. ${passe.usuario.ra} · ` : ""}
                {passe.usuario?.emailPessoal ?? ""}
                {` · Pedido de ${passe.anoReferencia}`}
              </div>
            )}
          </div>
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
            <PasseEscolarEtapas status={passe.status} historico={passe.historico} pontoDeVista="equipe" />
            {PROXIMO_PASSO[passe.status] && <p className="text-sm text-muted-foreground">{PROXIMO_PASSO[passe.status]}</p>}
            {passe.cadastradoPortalEm && (
              <p className="text-xs text-muted-foreground">
                Cadastrado no portal em {formatarDataHora(passe.cadastradoPortalEm)}
                {passe.cadastradoPor?.nome ? ` por ${passe.cadastradoPor.nome}` : ""}.
              </p>
            )}
            {passe.orientacaoFatec && passe.status !== "SOLICITADO" && (
              <Alert variant={passe.status === "INDEFERIDO" ? "error" : "warning"} title={`Última orientação ao aluno (${STATUS_PASSE_LABEL[passe.status]})`}>
                <p className="whitespace-pre-wrap">{passe.orientacaoFatec}</p>
              </Alert>
            )}
            <PasseEscolarAcoes passe={passe} quem="equipe" onChanged={load} />
          </Card>

          <Card className="space-y-4">
            <div className="text-sm font-semibold">Dados para o portal</div>
            <PasseEscolarDados passe={passe} />
            {passe.usuario?.curso && passe.usuario.curso !== passe.curso && (
              <Alert variant="warning">
                No cadastro do aluno o curso é “{passe.usuario.curso}”, diferente do informado no pedido. Confira antes de lançar.
              </Alert>
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
