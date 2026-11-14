import type { HalResource } from "./hal";

/** Roteamento de chamados: tipos e regras puras da tela de administração. */

export type Nivel = "PRIMEIRO" | "SEGUNDO" | "COPIA";

export const NIVEIS: readonly Nivel[] = ["PRIMEIRO", "SEGUNDO", "COPIA"];

export const NIVEL_LABEL: Record<Nivel, string> = {
  PRIMEIRO: "1º nível",
  SEGUNDO: "2º nível",
  COPIA: "Cópia",
};

export const NIVEL_AJUDA: Record<Nivel, string> = {
  PRIMEIRO: "Recebe quando o chamado chega ao setor.",
  SEGUNDO: "Recebe se ninguém assumir o chamado dentro do prazo.",
  COPIA: "Recebe na chegada, marcado como cópia.",
};

export type SetorRef = { id: string; nome: string };

export type Regra = HalResource & {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
  categoriaChave: string | null;
  servicoChave: string | null;
  setorId: string;
  setorCopiaId: string | null;
  setor?: SetorRef | null;
  setorCopia?: SetorRef | null;
};

export type RegraForm = {
  nome: string;
  ordem: number;
  ativo: boolean;
  categoriaChave: string;
  servicoChave: string;
  setorId: string;
  setorCopiaId: string;
};

export const REGRA_VAZIA: RegraForm = { nome: "", ordem: 100, ativo: true, categoriaChave: "", servicoChave: "", setorId: "", setorCopiaId: "" };

export type UsuarioContato = { id: string; nome: string; emailEducacional?: string | null; emailPessoal?: string | null; papel?: string; ativo?: boolean };

export type Contato = {
  id?: string;
  nivel: Nivel;
  usuarioId: string | null;
  email: string | null;
  nome: string | null;
  usuario?: UsuarioContato | null;
};

export type Hierarquia = HalResource & {
  id: string;
  nome: string;
  prazoEscalonamentoHoras: number | null;
  contatos: Contato[];
};

export type Simulacao = {
  setorId: string | null;
  setorCopiaId: string | null;
  regraId: string | null;
  motivo: string;
  setor: (SetorRef & { prazoEscalonamentoHoras?: number | null }) | null;
  setorCopia: SetorRef | null;
  emails: { email: string; nome: string; emCopia: boolean }[];
  usuarios: number;
};

export type CategoriaOpcao = { id: string; nome: string; servicos: { id: string; nome: string }[] };

/** Mesmo critério do backend: um @, parte local, domínio com ponto, sem espaços nem <>",; */
export function emailValido(email: string): boolean {
  const e = email.trim();
  if (!e || e.length > 254 || /[\s<>",;]/.test(e)) return false;
  const partes = e.split("@");
  if (partes.length !== 2) return false;
  const [local, dominio] = partes;
  return local.length > 0 && dominio.includes(".") && !dominio.startsWith(".") && !dominio.endsWith(".");
}

/** "Quando" de uma regra em texto: "Manutenção › Equipamento com defeito". */
export function descreverGatilho(regra: Pick<Regra, "categoriaChave" | "servicoChave">, categorias: CategoriaOpcao[]): string {
  const cat = categorias.find((c) => c.id === regra.categoriaChave);
  const svc = categorias.flatMap((c) => c.servicos).find((s) => s.id === regra.servicoChave);
  const partes = [
    regra.categoriaChave ? cat?.nome ?? regra.categoriaChave : null,
    regra.servicoChave ? svc?.nome ?? regra.servicoChave : null,
  ].filter(Boolean);
  return partes.length ? partes.join(" › ") : "—";
}

export function regraParaForm(r: Regra): RegraForm {
  return {
    nome: r.nome,
    ordem: r.ordem,
    ativo: r.ativo,
    categoriaChave: r.categoriaChave ?? "",
    servicoChave: r.servicoChave ?? "",
    setorId: r.setorId,
    setorCopiaId: r.setorCopiaId ?? "",
  };
}

/** Erro de preenchimento da regra, ou null se dá para salvar. */
export function validarRegra(f: RegraForm): string | null {
  if (f.nome.trim().length < 2) return "Dê um nome à regra.";
  if (!f.categoriaChave && !f.servicoChave) return "Escolha a categoria ou o serviço.";
  if (!f.setorId) return "Escolha o setor de destino.";
  if (f.setorCopiaId && f.setorCopiaId === f.setorId) return "O setor em cópia deve ser outro.";
  return null;
}

export function regraParaApi(f: RegraForm) {
  return {
    nome: f.nome.trim(),
    ordem: f.ordem,
    ativo: f.ativo,
    categoriaChave: f.categoriaChave || null,
    servicoChave: f.servicoChave || null,
    setorId: f.setorId,
    setorCopiaId: f.setorCopiaId || null,
  };
}

/** Nome e e-mail que a tela mostra para um contato. */
export function rotuloContato(c: Contato): { nome: string; email: string; avulso: boolean } {
  if (c.usuario) return { nome: c.usuario.nome, email: c.usuario.emailEducacional || c.usuario.emailPessoal || "sem e-mail", avulso: false };
  return { nome: c.nome || c.email || "—", email: c.email ?? "", avulso: true };
}

export function contatosParaApi(contatos: Contato[]) {
  return contatos.map((c) =>
    c.usuarioId ? { nivel: c.nivel, usuarioId: c.usuarioId } : { nivel: c.nivel, email: c.email?.trim() ?? "", nome: c.nome?.trim() || null },
  );
}
