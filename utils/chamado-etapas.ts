import type { EstadoEtapas, Etapa } from "../app/components/shared/LinhaDeEtapas";
import type { Status } from "./types";

/**
 * Etapas do chamado na visão do aluno. O fluxo real vai e volta
 * (aguardando aluno, reabertura), então os desvios viram estado da etapa,
 * não etapas novas:
 *   ABERTO → 1 · EM_ATENDIMENTO → 2 · AGUARDANDO_USUARIO → 2 (pendente)
 *   RESOLVIDO → 3 · ENCERRADO → 4 (tudo concluído)
 */
export const ETAPAS_CHAMADO: readonly Etapa[] = [
  { chave: "ABERTO", titulo: "Recebido pela Fatec", quem: "Fatec" },
  { chave: "EM_ATENDIMENTO", titulo: "Em análise", quem: "Setor responsável" },
  { chave: "RESOLVIDO", titulo: "Respondido", quem: "Setor responsável" },
  { chave: "ENCERRADO", titulo: "Finalizado", quem: "Atendimento encerrado" },
];

export function etapaDoChamado(status: Status): { atual: number; estado: EstadoEtapas; legendaAtual?: string } {
  switch (status) {
    case "ABERTO":
      return { atual: 0, estado: "andamento", legendaAtual: "Aguardando triagem" };
    case "EM_ATENDIMENTO":
      return { atual: 1, estado: "andamento", legendaAtual: "Com o setor responsável" };
    case "AGUARDANDO_USUARIO":
      return { atual: 1, estado: "pendente", legendaAtual: "Aguardando você" };
    case "RESOLVIDO":
      return { atual: 2, estado: "andamento", legendaAtual: "Confira a resposta" };
    case "ENCERRADO":
      return { atual: 3, estado: "concluido" };
    default:
      return { atual: 0, estado: "andamento" };
  }
}

/** O que o aluno deve fazer (ou esperar) em cada status. */
export const ORIENTACAO_CHAMADO: Record<Status, string> = {
  ABERTO: "A Fatec recebeu a sua solicitação e vai encaminhá-la ao setor responsável.",
  EM_ATENDIMENTO: "O setor responsável está analisando. Você será avisado quando houver resposta ou se faltar algo.",
  AGUARDANDO_USUARIO:
    "O setor precisa de um documento ou de uma resposta sua. Veja a última mensagem na conversa abaixo e responda por lá.",
  RESOLVIDO:
    "O setor respondeu. Se a resposta resolveu, finalize o atendimento; se não, reabra a solicitação.",
  ENCERRADO: "Atendimento finalizado. A solicitação fica disponível para consulta.",
};

export const STATUS_CHAMADO_HISTORICO: Record<Status, string> = {
  ABERTO: "Solicitação aberta",
  EM_ATENDIMENTO: "Em análise pelo setor",
  AGUARDANDO_USUARIO: "Aguardando você",
  RESOLVIDO: "Respondida pelo setor",
  ENCERRADO: "Atendimento finalizado",
};

export type HistoricoChamado = {
  id: string;
  de?: Status | null;
  para: Status;
  criadoEm: string;
  porUsuarioId?: string | null;
  porUsuario?: { id?: string; nome?: string | null } | null;
};

/** Título de uma linha do histórico: reabertura ganha nome próprio. */
export function tituloHistoricoChamado(h: HistoricoChamado): string {
  const reabriu = (h.de === "RESOLVIDO" || h.de === "ENCERRADO") && h.para === "EM_ATENDIMENTO";
  if (reabriu) return "Solicitação reaberta";
  return STATUS_CHAMADO_HISTORICO[h.para] ?? h.para;
}
