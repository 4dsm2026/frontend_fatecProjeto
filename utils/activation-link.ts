export const PASSWORD_CHANGE_REQUIRED_TYPE = "/errors/password-change-required";
export const EMAIL_IN_USE_TYPE = "/errors/email-already-in-use";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** true se o corpo do erro é o "primeiro acesso pendente" do backend. */
export function isPasswordChangeRequired(problem: unknown): boolean {
  return isRecord(problem) && problem.type === PASSWORD_CHANGE_REQUIRED_TYPE;
}

/** true se o `409` é "e-mail pessoal já em uso" (e não "token já utilizado"). */
export function isEmailInUse(problem: unknown): boolean {
  return isRecord(problem) && problem.type === EMAIL_IN_USE_TYPE;
}

/** Extrai o token de `_links.activate.href` quando o link tem o formato esperado. */
export function activationTokenFromProblem(problem: unknown): string | null {
  try {
    if (!isRecord(problem)) return null;
    const links = problem._links;
    if (!isRecord(links)) return null;
    const activate = links.activate;
    if (!isRecord(activate) || typeof activate.href !== "string") return null;

    const match = /^\/account-activations\/([^/?#]+)$/.exec(activate.href);
    if (!match) return null;

    const token = decodeURIComponent(match[1]);
    if (!token || token.includes("/") || token.includes("\\")) return null;
    return token;
  } catch {
    return null;
  }
}
