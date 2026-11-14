import type { EstadoEtapas, Etapa } from "../app/components/shared/LinhaDeEtapas";
import type { HalResource } from "./hal";

/**
 * Trancamento e cancelamento de matrícula (beta). Tipos e textos das telas do
 * aluno, da Secretaria e de Gerenciar Alunos.
 */

export type TipoSolicitacao = "TRANCAMENTO" | "CANCELAMENTO";
export type StatusSolicitacao = "SOLICITADO" | "EM_ANALISE" | "PENDENTE_ALUNO" | "DEFERIDO" | "INDEFERIDO" | "CANCELADO";
export type Situacao = "Regular" | "Trancada" | "Cancelada";

export type HistoricoSolicitacao = {
  id: string;
  de: StatusSolicitacao | null;
  para: StatusSolicitacao;
  comentario: string | null;
  criadoEm: string;
  autorId?: string | null;
  autor?: { id: string; nome?: string | null; papel?: string | null } | null;
};

export type Solicitacao = HalResource & {
  id: string;
  usuarioId: string;
  tipo: TipoSolicitacao;
  status: StatusSolicitacao;
  semestre: string;
  motivo: string;
  justificativa?: string | null;
  curso: string;
  orientacaoFatec?: string | null;
  decididoEm?: string | null;
  criadoEm: string;
  alertas?: string[];
  usuario?: {
    id: string;
    nome?: string | null;
    ra?: string | null;
    emailPessoal?: string | null;
    turno?: string | null;
    semestreAtual?: string | null;
    situacaoAcademica?: string | null;
  } | null;
  decididoPor?: { id: string; nome?: string | null } | null;
  historico?: HistoricoSolicitacao[];
};

export type Elegibilidade = HalResource & {
  situacaoAcademica: string | null;
  curso: string | null;
  semestreAtual: string | null;
  semestreLetivo: string;
  trancamentosDeferidos: number;
  pedidoEmAndamento: { id: string; tipo: TipoSolicitacao; status: StatusSolicitacao } | null;
  podeTrancar: boolean;
  podeCancelar: boolean;
  bloqueioTrancamento: string | null;
  bloqueioCancelamento: string | null;
  avisosTrancamento: string[];
};

export type ResumoMatricula = {
  semestre: string;
  emAberto: Partial<Record<StatusSolicitacao, number>>;
  totalEmAberto: number;
  deferidos: Record<TipoSolicitacao, number>;
  porMotivo: { motivo: string; rotulo: string; TRANCAMENTO: number; CANCELAMENTO: number }[];
  porCurso: { curso: string; TRANCAMENTO: number; CANCELAMENTO: number }[];
};

export const MAX_TRANCAMENTOS = 2;

export const MOTIVOS: readonly { valor: string; rotulo: string }[] = [
  { valor: "TRABALHO_HORARIO", rotulo: "Trabalho ou horário" },
  { valor: "FINANCEIRO", rotulo: "Dificuldade financeira" },
  { valor: "SAUDE", rotulo: "Saúde" },
  { valor: "FAMILIA", rotulo: "Questões familiares" },
  { valor: "MUDANCA_CIDADE", rotulo: "Mudança de cidade" },
  { valor: "TRANSPORTE", rotulo: "Transporte ou distância" },
  { valor: "DIFICULDADE_DISCIPLINAS", rotulo: "Dificuldade com as disciplinas" },
  { valor: "NAO_SE_IDENTIFICOU", rotulo: "Não se identificou com o curso" },
  { valor: "TRANSFERENCIA", rotulo: "Transferência para outra instituição" },
  { valor: "OUTRO", rotulo: "Outro" },
];

export function rotuloMotivo(valor: string): string {
  return MOTIVOS.find((m) => m.valor === valor)?.rotulo ?? valor;
}

export const TIPO_LABEL: Record<TipoSolicitacao, string> = {
  TRANCAMENTO: "Trancamento",
  CANCELAMENTO: "Cancelamento",
};

export const STATUS_LABEL: Record<StatusSolicitacao, string> = {
  SOLICITADO: "Recebido",
  EM_ANALISE: "Em análise",
  PENDENTE_ALUNO: "Precisa de resposta",
  DEFERIDO: "Deferido",
  INDEFERIDO: "Indeferido",
  CANCELADO: "Retirado",
};

export const STATUS_FINAIS: readonly StatusSolicitacao[] = ["DEFERIDO", "INDEFERIDO", "CANCELADO"];
export const isFinal = (s: StatusSolicitacao) => STATUS_FINAIS.includes(s);

/** O que o aluno deve fazer (ou esperar) em cada status. */
export function orientacaoAluno(s: Pick<Solicitacao, "tipo" | "status">): string {
  const trancar = s.tipo === "TRANCAMENTO";
  switch (s.status) {
    case "SOLICITADO":
      return "A Secretaria recebeu o seu pedido e vai analisá-lo. Até a decisão, continue frequentando as aulas.";
    case "EM_ANALISE":
      return "A Secretaria está analisando. Você será avisado da decisão por aqui.";
    case "PENDENTE_ALUNO":
      return "A Secretaria precisa de uma resposta sua. Leia a orientação e responda abaixo; o pedido volta para análise.";
    case "DEFERIDO":
      return trancar
        ? "Matrícula trancada por um semestre. Para voltar, faça a rematrícula no período indicado pelo calendário acadêmico."
        : "Matrícula cancelada. O vínculo com o curso foi encerrado.";
    case "INDEFERIDO":
      return "O pedido foi indeferido. Veja o motivo abaixo; se tiver dúvidas, procure a Secretaria.";
    case "CANCELADO":
      return "Você retirou este pedido. Sua matrícula continua como estava.";
  }
}

export const ETAPAS_MATRICULA: readonly Etapa[] = [
  { chave: "SOLICITADO", titulo: "Pedido enviado", quem: "Você" },
  { chave: "EM_ANALISE", titulo: "Análise", quem: "Secretaria" },
  { chave: "DECISAO", titulo: "Decisão", quem: "Secretaria" },
  { chave: "SITUACAO", titulo: "Situação atualizada", quem: "Sistema" },
];

/** Em que etapa o pedido está. Desistência fica onde parou. */
export function etapaDaSolicitacao(
  status: StatusSolicitacao,
  historico: HistoricoSolicitacao[] = [],
): { atual: number; estado: EstadoEtapas; legendaAtual?: string } {
  switch (status) {
    case "SOLICITADO":
      return { atual: 1, estado: "andamento", legendaAtual: "Aguardando a Secretaria" };
    case "EM_ANALISE":
      return { atual: 1, estado: "andamento", legendaAtual: "Com a Secretaria" };
    case "PENDENTE_ALUNO":
      return { atual: 1, estado: "pendente", legendaAtual: "Aguardando você" };
    case "DEFERIDO":
      return { atual: 3, estado: "concluido" };
    case "INDEFERIDO":
      return { atual: 2, estado: "falhou", legendaAtual: "Indeferido" };
    case "CANCELADO": {
      const analisou = historico.some((h) => h.para === "EM_ANALISE" || h.para === "PENDENTE_ALUNO");
      return { atual: analisou ? 1 : 0, estado: "falhou", legendaAtual: "Pedido retirado" };
    }
  }
}

export const SITUACOES: readonly Situacao[] = ["Regular", "Trancada", "Cancelada"];

/** Mesmo critério do backend: o campo é texto livre. */
export function situacaoNormalizada(s?: string | null): Situacao {
  const t = s?.trim().toLowerCase() ?? "";
  if (t.startsWith("tranc")) return "Trancada";
  if (t.startsWith("cancel")) return "Cancelada";
  return "Regular";
}

export function semestreLegivel(semestre: string): string {
  const m = /^(\d{4})-([12])$/.exec(semestre);
  return m ? `${m[2]}º semestre de ${m[1]}` : semestre;
}

export function proximoSemestre(semestre: string): string {
  const m = /^(\d{4})-([12])$/.exec(semestre);
  if (!m) return semestre;
  const ano = Number(m[1]);
  return m[2] === "1" ? `${ano}-2` : `${ano + 1}-1`;
}

/**
 * Serviços do catálogo que tratam de trancar/cancelar matrícula. O catálogo pode
 * vir da lista fixa (id "secretaria-trancamento-destrancamento") ou do banco
 * (ids próprios), então olha também o nome.
 */
export function ehServicoDeTrancamento(servico: { id: string; nome?: string | null }): boolean {
  if (servico.id === "secretaria-trancamento-destrancamento") return true;
  const nome = (servico.nome ?? "").toLowerCase();
  return /tranc/.test(nome) || /cancelamento de matr/.test(nome);
}

export type FormularioSolicitacao = {
  tipo: TipoSolicitacao;
  semestre: string;
  motivo: string;
  justificativa: string;
  cienteDefinitivo: boolean;
};

export function errosDoFormulario(f: FormularioSolicitacao): Partial<Record<keyof FormularioSolicitacao, string>> {
  const erros: Partial<Record<keyof FormularioSolicitacao, string>> = {};
  if (!f.motivo) erros.motivo = "Escolha o motivo principal.";
  if (f.motivo === "OUTRO" && f.justificativa.trim().length < 5) erros.justificativa = 'Explique o motivo quando escolher "Outro".';
  if (f.tipo === "CANCELAMENTO" && !f.cienteDefinitivo) erros.cienteDefinitivo = "Confirme que entende que o cancelamento é definitivo.";
  return erros;
}
