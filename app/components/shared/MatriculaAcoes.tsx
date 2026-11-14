"use client";

import { useState } from "react";
import { toast } from "sonner";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import { extractApiError } from "../../../utils/api";
import { followLink, getLinks, type HalResource } from "../../../utils/hal";
import type { StatusSolicitacao, TipoSolicitacao } from "../../../utils/matricula";

type Quem = "aluno" | "equipe";

const ROTULO: Record<Quem, Partial<Record<StatusSolicitacao, string>>> = {
  aluno: { CANCELADO: "Retirar pedido" },
  equipe: {
    EM_ANALISE: "Iniciar análise",
    PENDENTE_ALUNO: "Pedir resposta ao aluno",
    DEFERIDO: "Deferir",
    INDEFERIDO: "Indeferir",
  },
};

type Pendente = { status: StatusSolicitacao; rotulo: string };

/**
 * Botões de mudança de status: um por link `transition` que a API ofereceu.
 * Deferir explica o efeito na situação do aluno; pendência e indeferimento pedem motivo.
 */
export default function MatriculaAcoes({
  solicitacao,
  tipo,
  quem,
  onChanged,
}: Readonly<{ solicitacao: HalResource; tipo: TipoSolicitacao; quem: Quem; onChanged: () => void | Promise<void> }>) {
  const [pendente, setPendente] = useState<Pendente | null>(null);

  const transicoes = getLinks(solicitacao, "transition")
    .map((l) => l.name as StatusSolicitacao)
    .filter((s) => ROTULO[quem][s]);
  if (!transicoes.length) return null;

  async function executar(status: StatusSolicitacao, comentario?: string) {
    const corpo: Record<string, string> = { status };
    if (comentario?.trim()) corpo.comentario = comentario.trim();
    try {
      const res = await followLink(solicitacao, "transition", { name: status, body: JSON.stringify(corpo) });
      if (!res.ok) throw new Error(await extractApiError(res, "Não foi possível atualizar o pedido."));
      toast.success("Pedido atualizado.");
      await onChanged();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar o pedido.");
      throw e;
    }
  }

  function descricao(status: StatusSolicitacao): string {
    if (status === "DEFERIDO") {
      return tipo === "TRANCAMENTO"
        ? 'A situação acadêmica do aluno passa a "Trancada" e ele é avisado. Se quiser, deixe uma orientação (ex.: período de rematrícula).'
        : 'A situação acadêmica do aluno passa a "Cancelada" e ele é avisado. O cancelamento é definitivo.';
    }
    if (status === "INDEFERIDO") return "Explique ao aluno o motivo. O texto aparece para ele.";
    if (status === "PENDENTE_ALUNO") return "Diga o que o aluno precisa responder ou enviar. O texto aparece para ele.";
    if (status === "CANCELADO") return "O pedido é encerrado e sua matrícula continua como está. Se precisar, você pode fazer um novo pedido.";
    return "O aluno verá que o pedido está em análise.";
  }

  function input(status: StatusSolicitacao) {
    if (status === "PENDENTE_ALUNO" || status === "INDEFERIDO") return { label: "Motivo (obrigatório)", required: true };
    if (status === "DEFERIDO") return { label: "Orientação ao aluno (opcional)", required: false };
    return undefined;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {transicoes.map((status) => {
          let variant: "primary" | "secondary" | "destructive" = "secondary";
          if (status === "DEFERIDO") variant = "primary";
          if (status === "INDEFERIDO" || status === "CANCELADO") variant = "destructive";
          return (
            <Button key={status} variant={variant} onClick={() => setPendente({ status, rotulo: ROTULO[quem][status] as string })}>
              {ROTULO[quem][status]}
            </Button>
          );
        })}
      </div>
      {pendente && (
        <ConfirmDialog
          open
          title={pendente.rotulo}
          description={descricao(pendente.status)}
          confirmLabel={pendente.rotulo}
          variant={pendente.status === "INDEFERIDO" || pendente.status === "CANCELADO" || (pendente.status === "DEFERIDO" && tipo === "CANCELAMENTO") ? "danger" : "default"}
          input={input(pendente.status)}
          onConfirm={(valor) => executar(pendente.status, valor)}
          onClose={() => setPendente(null)}
        />
      )}
    </>
  );
}
