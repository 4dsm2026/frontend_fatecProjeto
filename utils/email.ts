/**
 * Valida e-mail de forma simples e em tempo linear (sem regex com backtracking).
 * Mesma regra de antes: `local@dominio`, sem espaços nem outro "@", e o domínio
 * precisa ter um "." que não esteja no começo nem no fim.
 */
export function isEmailValido(valor: string): boolean {
  if (/\s/.test(valor)) return false;
  const partes = valor.split("@");
  if (partes.length !== 2) return false;
  const [local, dominio] = partes;
  if (local.length === 0) return false;
  return dominio.slice(1, -1).includes(".");
}
