/**
 * Confere o formato de um e-mail em tempo linear: exatamente um "@", nada de espaços e um
 * ponto no domínio que não esteja na ponta. Substitui regex como /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
 * que fazem backtracking super-linear com entradas longas (SonarCloud, #258).
 */
export function isEmailAddress(value: string): boolean {
  const parts = value.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  const dotIndex = domain.indexOf(".", 1);
  return Boolean(
    local &&
      domain &&
      !/\s/.test(local) &&
      !/\s/.test(domain) &&
      dotIndex > 0 &&
      dotIndex < domain.length - 1,
  );
}
