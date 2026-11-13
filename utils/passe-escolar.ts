import type { HalResource } from "./hal";

/**
 * Passe Escolar (EMTU/ARTESP) — funcionalidade em beta.
 * Textos e etapas compartilhados pelas telas do aluno e da secretaria.
 */

export type StatusPasse =
  | "SOLICITADO"
  | "PENDENTE_ALUNO"
  | "CADASTRADO_PORTAL"
  | "REQUISITADO_EMTU"
  | "CONCLUIDO"
  | "INDEFERIDO"
  | "CANCELADO";

export type ModalidadePasse = "PASSE_LIVRE" | "MEIA_TARIFA";
export type TipoPedidoPasse = "NOVO" | "REVALIDACAO";

export type PasseHistorico = {
  id: string;
  de: StatusPasse | null;
  para: StatusPasse;
  comentario: string | null;
  criadoEm: string;
  autor?: { id: string; nome?: string | null; papel?: string | null } | null;
};

export type PasseResumo = HalResource & {
  id: string;
  usuarioId: string;
  anoReferencia: number;
  tipo: TipoPedidoPasse;
  modalidade: ModalidadePasse;
  status: StatusPasse;
  nomeCompleto: string;
  curso: string;
  periodo: string;
  mesConclusao: number;
  anoConclusao: number;
  cadastradoPortalEm?: string | null;
  protocoloEmtu?: string | null;
  encerradoEm?: string | null;
  criadoEm: string;
  atualizadoEm?: string;
  usuario?: { id: string; nome?: string | null; ra?: string | null } | null;
};

export type PasseDetalhe = PasseResumo & {
  rg: string;
  cpf: string;
  cep: string;
  municipioResidencia: string;
  declaraBaixaRenda: boolean;
  observacaoAluno?: string | null;
  orientacaoFatec?: string | null;
  cadastradoPor?: { id: string; nome?: string | null } | null;
  historico?: PasseHistorico[];
  usuario?: {
    id: string;
    nome?: string | null;
    ra?: string | null;
    emailPessoal?: string | null;
    curso?: string | null;
    turno?: string | null;
  } | null;
};

/** Dados que o aluno preenche (mesmos nomes da API). */
export type PasseFormulario = {
  tipo: TipoPedidoPasse;
  modalidade: ModalidadePasse;
  nomeCompleto: string;
  rg: string;
  cpf: string;
  cep: string;
  municipioResidencia: string;
  curso: string;
  periodo: string;
  mesConclusao: string;
  anoConclusao: string;
  declaraBaixaRenda: boolean;
  observacaoAluno: string;
};

export const STATUS_PASSE_LABEL: Record<StatusPasse, string> = {
  SOLICITADO: "Aguardando a Fatec",
  PENDENTE_ALUNO: "Precisa de correção",
  CADASTRADO_PORTAL: "Cadastrado no portal da EMTU",
  REQUISITADO_EMTU: "Em análise na EMTU",
  CONCLUIDO: "Passe aprovado",
  INDEFERIDO: "Recusado",
  CANCELADO: "Cancelado",
};

/** O que o aluno deve fazer (ou esperar) em cada etapa. */
export const STATUS_PASSE_ORIENTACAO: Record<StatusPasse, string> = {
  SOLICITADO:
    "A Secretaria vai conferir os seus dados e lançá-los no Portal de Relacionamento da ARTESP/EMTU. Você será avisado aqui quando isso acontecer.",
  PENDENTE_ALUNO:
    "A Secretaria encontrou algo a corrigir. Leia a orientação, ajuste os dados e reenvie: o pedido volta para a fila automaticamente.",
  CADASTRADO_PORTAL:
    "Seus dados já estão no portal da EMTU. Agora é com você: preencha o formulário no site da EMTU, pague o boleto e envie os documentos por lá. Depois, marque aqui que já requisitou.",
  REQUISITADO_EMTU:
    "A EMTU analisa em até 10 dias úteis depois do pagamento e do envio correto dos documentos. Acompanhe pelo CPF na página \"Acompanhe\" da EMTU e, quando sair o resultado, registre aqui.",
  CONCLUIDO:
    "Passe aprovado. Ative o benefício no cartão da sua região (na Grande São Paulo, o Cartão TOP) e valide no site da EMTU. Em janeiro do ano que vem, faça a revalidação.",
  INDEFERIDO: "O pedido foi recusado. Veja o motivo abaixo. Se o problema for corrigível, abra um novo pedido.",
  CANCELADO: "Este pedido foi cancelado. Se ainda precisar do passe, abra um novo pedido.",
};

export const MODALIDADE_LABEL: Record<ModalidadePasse, string> = {
  PASSE_LIVRE: "Passe Livre (isenção total)",
  MEIA_TARIFA: "Meia Tarifa (50% de desconto)",
};

export const TIPO_PEDIDO_LABEL: Record<TipoPedidoPasse, string> = {
  NOVO: "Primeiro pedido",
  REVALIDACAO: "Revalidação anual",
};

export const PERIODOS = ["Manhã", "Tarde", "Noite", "Integral"] as const;

export const STATUS_FINAIS: readonly StatusPasse[] = ["CONCLUIDO", "INDEFERIDO", "CANCELADO"];

export function isFinal(status: StatusPasse): boolean {
  return STATUS_FINAIS.includes(status);
}

/** As quatro etapas do caminho feliz, na ordem em que acontecem. */
export const ETAPAS: readonly { status: StatusPasse; titulo: string; quem: "Você" | "Fatec" | "EMTU" }[] = [
  { status: "SOLICITADO", titulo: "Pedido enviado à Fatec", quem: "Você" },
  { status: "CADASTRADO_PORTAL", titulo: "Cadastro no portal da EMTU", quem: "Fatec" },
  { status: "REQUISITADO_EMTU", titulo: "Formulário e boleto na EMTU", quem: "Você" },
  { status: "CONCLUIDO", titulo: "Passe aprovado", quem: "EMTU" },
];

/** Em que etapa (0 a 3) o pedido está. Pendência fica na etapa 0; recusa/cancelamento ficam onde pararam. */
export function indiceEtapa(status: StatusPasse, historico: PasseHistorico[] = []): number {
  const ordem = ETAPAS.map((e) => e.status);
  const direto = ordem.indexOf(status);
  if (direto >= 0) return direto;
  if (status === "PENDENTE_ALUNO") return 0;
  // INDEFERIDO / CANCELADO: a última etapa do caminho feliz pela qual o pedido passou
  let ultimo = 0;
  for (const h of historico) {
    const i = ordem.indexOf(h.para);
    if (i > ultimo) ultimo = i;
  }
  return ultimo;
}

/** Rótulo do botão de cada mudança de etapa, por quem clica. */
export const ACAO_LABEL: Record<"aluno" | "equipe", Partial<Record<StatusPasse, string>>> = {
  aluno: {
    REQUISITADO_EMTU: "Já requisitei na EMTU",
    CONCLUIDO: "A EMTU aprovou meu passe",
    INDEFERIDO: "A EMTU recusou meu pedido",
    CANCELADO: "Cancelar pedido",
  },
  equipe: {
    CADASTRADO_PORTAL: "Marcar como cadastrado no portal",
    PENDENTE_ALUNO: "Pedir correção ao aluno",
    INDEFERIDO: "Indeferir",
    REQUISITADO_EMTU: "Marcar requisição na EMTU",
    CONCLUIDO: "Marcar como aprovado pela EMTU",
    CANCELADO: "Cancelar / excluir do portal",
  },
};

/** Mudanças que pedem um texto: obrigatório quando a Fatec recusa ou pede correção. */
export function pedeComentario(status: StatusPasse, quem: "aluno" | "equipe"): "obrigatorio" | "opcional" | "nao" {
  if (quem === "equipe" && (status === "PENDENTE_ALUNO" || status === "INDEFERIDO")) return "obrigatorio";
  if (status === "CANCELADO" || status === "INDEFERIDO") return "opcional";
  return "nao";
}

export function formatarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "").slice(0, 11);
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatarCep(cep: string): string {
  const d = cep.replace(/\D/g, "").slice(0, 8);
  if (d.length !== 8) return cep;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function formatarConclusao(mes: number, ano: number): string {
  return `${String(mes).padStart(2, "0")}/${ano}`;
}

export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formularioVazio(ano = new Date().getFullYear()): PasseFormulario {
  return {
    tipo: "NOVO",
    modalidade: "MEIA_TARIFA",
    nomeCompleto: "",
    rg: "",
    cpf: "",
    cep: "",
    municipioResidencia: "",
    curso: "",
    periodo: "",
    mesConclusao: "12",
    anoConclusao: String(ano + 2),
    declaraBaixaRenda: false,
    observacaoAluno: "",
  };
}

export function formularioDoPasse(p: PasseDetalhe): PasseFormulario {
  return {
    tipo: p.tipo,
    modalidade: p.modalidade,
    nomeCompleto: p.nomeCompleto,
    rg: p.rg,
    cpf: formatarCpf(p.cpf),
    cep: formatarCep(p.cep),
    municipioResidencia: p.municipioResidencia,
    curso: p.curso,
    periodo: p.periodo,
    mesConclusao: String(p.mesConclusao),
    anoConclusao: String(p.anoConclusao),
    declaraBaixaRenda: p.declaraBaixaRenda,
    observacaoAluno: p.observacaoAluno ?? "",
  };
}

/** Validação local, com as mesmas regras da API, para avisar antes de enviar. */
export function validarFormulario(f: PasseFormulario): Partial<Record<keyof PasseFormulario, string>> {
  const erros: Partial<Record<keyof PasseFormulario, string>> = {};
  if (f.nomeCompleto.trim().length < 3) erros.nomeCompleto = "Informe o nome completo, como está no RG.";
  if (f.rg.trim().length < 5) erros.rg = "Informe o RG.";
  if (!cpfValido(f.cpf)) erros.cpf = "CPF inválido.";
  if (f.cep.replace(/\D/g, "").length !== 8) erros.cep = "CEP deve ter 8 dígitos.";
  if (f.municipioResidencia.trim().length < 2) erros.municipioResidencia = "Informe o município onde mora.";
  if (f.curso.trim().length < 2) erros.curso = "Informe o curso.";
  if (f.periodo.trim().length < 2) erros.periodo = "Escolha o período.";
  const mes = Number(f.mesConclusao);
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) erros.mesConclusao = "Mês inválido.";
  const ano = Number(f.anoConclusao);
  if (!Number.isInteger(ano) || ano < new Date().getFullYear()) erros.anoConclusao = "Informe o ano previsto de conclusão.";
  if (f.modalidade === "PASSE_LIVRE" && !f.declaraBaixaRenda) {
    erros.declaraBaixaRenda = "O Passe Livre exige a declaração de renda familiar.";
  }
  return erros;
}

export function cpfValido(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (fim: number) => {
    let soma = 0;
    for (let i = 0; i < fim; i++) soma += Number(d[i]) * (fim + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/** Corpo para a API: números como número, CPF/CEP só dígitos. */
export function corpoDoFormulario(f: PasseFormulario) {
  return {
    tipo: f.tipo,
    modalidade: f.modalidade,
    nomeCompleto: f.nomeCompleto.trim(),
    rg: f.rg.trim(),
    cpf: f.cpf.replace(/\D/g, ""),
    cep: f.cep.replace(/\D/g, ""),
    municipioResidencia: f.municipioResidencia.trim(),
    curso: f.curso.trim(),
    periodo: f.periodo.trim(),
    mesConclusao: Number(f.mesConclusao),
    anoConclusao: Number(f.anoConclusao),
    declaraBaixaRenda: f.declaraBaixaRenda,
    observacaoAluno: f.observacaoAluno.trim() || null,
  };
}

export const EMTU_PASSE_URL = "https://www.emtu.sp.gov.br/emtu/servicos/passe-escolar/passe-escolar.fss";
