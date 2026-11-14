import type { HalResource } from "./hal";

/**
 * Pesquisa institucional (CPA) — funcionalidade em beta.
 * Tipos e textos compartilhados pelas telas do aluno e da equipe.
 */

export type StatusPesquisa = "RASCUNHO" | "ABERTA" | "ENCERRADA";
export type TipoPergunta = "ESCALA" | "MULTIPLA" | "TEXTO";

export type Pergunta = {
  id?: string;
  ordem?: number;
  secao?: string | null;
  texto: string;
  tipo: TipoPergunta;
  opcoes?: string[] | null;
  obrigatoria: boolean;
};

export type Pesquisa = HalResource & {
  id: string;
  titulo: string;
  descricao?: string | null;
  semestre: string;
  status: StatusPesquisa;
  cursos: string[] | null;
  fechaEm?: string | null;
  abertaEm?: string | null;
  encerradaEm?: string | null;
  aceitaRespostas: boolean;
  totalRespostas?: number;
  totalPerguntas?: number;
  respondida?: boolean;
  perguntas?: Pergunta[];
};

export type ResultadoPergunta = {
  id: string;
  ordem: number;
  secao: string | null;
  texto: string;
  tipo: TipoPergunta;
  respostas: number;
  media?: number | null;
  distribuicao?: Record<string, number>;
  naoSei?: number;
  opcoes?: { opcao: string; total: number }[];
  textos?: string[];
};

export type ParticipacaoCurso = { curso: string; elegiveis: number; respondentes: number };

export type Resultados = {
  pesquisaId: string;
  curso: string | null;
  minimo: number;
  totalRespostas: number;
  totalElegiveis: number;
  participacao: ParticipacaoCurso[];
  suprimido: boolean;
  perguntas: ResultadoPergunta[];
};

export type ValorResposta = number | string;

export const STATUS_PESQUISA_LABEL: Record<StatusPesquisa, string> = {
  RASCUNHO: "Rascunho",
  ABERTA: "Aberta",
  ENCERRADA: "Encerrada",
};

export const TIPO_PERGUNTA_LABEL: Record<TipoPergunta, string> = {
  ESCALA: "Nota de 1 a 5",
  MULTIPLA: "Múltipla escolha",
  TEXTO: "Resposta aberta",
};

/** Rótulos da escala; 0 é "não sei" e fica fora da média. */
export const ESCALA: readonly { valor: number; rotulo: string }[] = [
  { valor: 1, rotulo: "Péssimo" },
  { valor: 2, rotulo: "Ruim" },
  { valor: 3, rotulo: "Regular" },
  { valor: 4, rotulo: "Bom" },
  { valor: 5, rotulo: "Ótimo" },
];
export const ESCALA_NAO_SEI = 0;

export const ACAO_STATUS_LABEL: Record<StatusPesquisa, Partial<Record<StatusPesquisa, string>>> = {
  RASCUNHO: { ABERTA: "Abrir para os alunos" },
  ABERTA: { ENCERRADA: "Encerrar pesquisa" },
  ENCERRADA: { ABERTA: "Reabrir" },
};

const SEMESTRE_RE = /^(\d{4})-([12])$/;

export function semestreValido(s: string): boolean {
  return SEMESTRE_RE.test(s.trim());
}

export function semestreAtual(agora: Date = new Date()): string {
  return `${agora.getFullYear()}-${agora.getMonth() < 6 ? 1 : 2}`;
}

export function proximoSemestre(semestre: string): string {
  const m = SEMESTRE_RE.exec(semestre);
  if (!m) return semestreAtual();
  const ano = Number(m[1]);
  return m[2] === "1" ? `${ano}-2` : `${ano + 1}-1`;
}

/** "2026-2" → "2º semestre de 2026". */
export function semestreLegivel(semestre: string): string {
  const m = SEMESTRE_RE.exec(semestre);
  return m ? `${m[2]}º semestre de ${m[1]}` : semestre;
}

export function percentual(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0;
}

/** Agrupa mantendo a ordem em que as seções aparecem. */
export function agruparPorSecao<T extends { secao?: string | null }>(itens: readonly T[]): { secao: string; itens: T[] }[] {
  const grupos: { secao: string; itens: T[] }[] = [];
  for (const item of itens) {
    const secao = item.secao?.trim() || "Geral";
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.secao === secao) ultimo.itens.push(item);
    else grupos.push({ secao, itens: [item] });
  }
  return grupos;
}

/** Perguntas obrigatórias ainda sem resposta (0 = "não sei" conta como respondida). */
export function perguntasFaltando(perguntas: readonly Pergunta[], respostas: Record<string, ValorResposta>): string[] {
  return perguntas
    .filter((p) => p.obrigatoria && p.id)
    .filter((p) => {
      const v = respostas[p.id as string];
      return v === undefined || v === "";
    })
    .map((p) => p.id as string);
}

/** Problemas que impedem salvar o rascunho (mesmas regras da API). */
export function errosDasPerguntas(perguntas: readonly Pergunta[]): string[] {
  const erros: string[] = [];
  perguntas.forEach((p, i) => {
    const n = i + 1;
    if (p.texto.trim().length < 3) erros.push(`Pergunta ${n}: escreva o texto.`);
    if (p.tipo === "MULTIPLA") {
      const opcoes = (p.opcoes ?? []).map((o) => o.trim()).filter(Boolean);
      if (opcoes.length < 2) erros.push(`Pergunta ${n}: informe ao menos 2 opções.`);
      else if (new Set(opcoes).size !== opcoes.length) erros.push(`Pergunta ${n}: há opções repetidas.`);
    }
  });
  return erros;
}

/** Corpo das perguntas para a API: textos aparados, opções só na múltipla escolha. */
export function perguntasParaApi(perguntas: readonly Pergunta[]) {
  return perguntas.map((p) => ({
    secao: p.secao?.trim() || null,
    texto: p.texto.trim(),
    tipo: p.tipo,
    opcoes: p.tipo === "MULTIPLA" ? (p.opcoes ?? []).map((o) => o.trim()).filter(Boolean) : null,
    obrigatoria: p.obrigatoria,
  }));
}
