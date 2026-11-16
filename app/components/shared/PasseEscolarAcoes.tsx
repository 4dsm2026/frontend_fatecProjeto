"use client";

import { useState } from "react";
import { toast } from "sonner";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import { extractApiError } from "../../../utils/api";
import { followLink, getLinks, type HalResource } from "../../../utils/hal";
import { ACAO_LABEL, STATUS_PASSE_LABEL, pedeComentario, type StatusPasse } from "../../../utils/passe-escolar";

type Props = Readonly<{
  passe: HalResource;
  quem: "aluno" | "equipe";
  onChanged: () => void | Promise<void>;
}>;

const DESTRUTIVAS: readonly StatusPasse[] = ["CANCELADO", "INDEFERIDO"];
const PRINCIPAL: Record<"aluno" | "equipe", StatusPasse> = { aluno: "REQUISITADO_EMTU", equipe: "CADASTRADO_PORTAL" };

type Pendente = { status: StatusPasse; label: string };

/**
 * Botões de mudança de etapa. Cada botão vem de um link `transition` do pedido:
 * a API já filtrou o que este papel pode fazer neste estado.
 */
export default function PasseEscolarAcoes({ passe, quem, onChanged }: Props) {
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [salvando, setSalvando] = useState(false);

  const transicoes = getLinks(passe, "transition")
    .map((l) => l.name as StatusPasse | undefined)
    .filter((s): s is StatusPasse => !!s && !!ACAO_LABEL[quem][s]);

  if (transicoes.length === 0) return null;

  async function executar(status: StatusPasse, texto?: string) {
    const comentarioOuProtocolo = texto?.trim() || undefined;
    const corpo: Record<string, string> = { status };
    if (comentarioOuProtocolo) {
      if (quem === "aluno" && status === "REQUISITADO_EMTU") corpo.protocoloEmtu = comentarioOuProtocolo;
      else corpo.comentario = comentarioOuProtocolo;
    }
    try {
      setSalvando(true);
      const res = await followLink(passe, "transition", { name: status, body: JSON.stringify(corpo) });
      if (!res.ok) throw new Error(await extractApiError(res, "Não foi possível mudar a etapa."));
      toast.success(`Etapa atualizada: ${STATUS_PASSE_LABEL[status]}.`);
      await onChanged();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível mudar a etapa.");
      throw e; // mantém o diálogo aberto
    } finally {
      setSalvando(false);
    }
  }

  function dialogo(p: Pendente) {
    const precisa = pedeComentario(p.status, quem);
    const pedeProtocolo = quem === "aluno" && p.status === "REQUISITADO_EMTU";
    const perigo = DESTRUTIVAS.includes(p.status);

    let descricao = "Confirma a mudança de etapa?";
    if (p.status === "CANCELADO" && quem === "aluno") descricao = "O pedido será encerrado. Se precisar do passe depois, abra um novo pedido.";
    if (p.status === "CANCELADO" && quem === "equipe") descricao = "Use quando o aluno saiu da Fatec ou desistiu: lembre-se de excluir o cadastro no portal.";
    if (p.status === "PENDENTE_ALUNO") descricao = "Explique o que o aluno precisa corrigir. O texto aparece para ele.";
    if (p.status === "INDEFERIDO") descricao = quem === "equipe" ? "Explique ao aluno o motivo da recusa." : "Se quiser, conte o motivo que a EMTU informou.";
    if (pedeProtocolo) descricao = "Se tiver em mãos, informe o número do formulário/requisição da EMTU para facilitar o acompanhamento.";

    let input: { label: string; placeholder?: string; required: boolean } | undefined;
    if (pedeProtocolo) input = { label: "Nº do formulário na EMTU (opcional)", placeholder: "Ex.: 2026-123456", required: false };
    else if (precisa !== "nao") input = { label: precisa === "obrigatorio" ? "Motivo (obrigatório)" : "Motivo (opcional)", required: precisa === "obrigatorio" };

    return (
      <ConfirmDialog
        open
        title={p.label}
        description={descricao}
        confirmLabel={p.label}
        variant={perigo ? "danger" : "default"}
        input={input}
        onConfirm={(valor) => executar(p.status, valor)}
        onClose={() => setPendente(null)}
      />
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {transicoes.map((status) => {
          const label = ACAO_LABEL[quem][status] ?? STATUS_PASSE_LABEL[status];
          let variant: "primary" | "secondary" | "destructive" = "secondary";
          if (status === PRINCIPAL[quem]) variant = "primary";
          if (DESTRUTIVAS.includes(status)) variant = "destructive";
          return (
            <Button key={status} variant={variant} disabled={salvando} onClick={() => setPendente({ status, label })}>
              {label}
            </Button>
          );
        })}
      </div>
      {pendente && dialogo(pendente)}
    </>
  );
}
