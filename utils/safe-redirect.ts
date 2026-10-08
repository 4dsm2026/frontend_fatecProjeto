/**
 * Valida um destino de redirecionamento vindo da URL (?redirect=...).
 * Só aceita caminhos DO MESMO SITE. A checagem antiga ("começa com / e não
 * com //") deixava passar "/\evil.com", "/<tab>/evil.com" e "/<enter>/evil.com":
 * o navegador remove tab/enter e trata "\" como "/", e acabava em outro site.
 * Aqui o destino é resolvido como o navegador resolveria e a origem é comparada.
 */
export function safeRedirect(
  redirect: string | null | undefined,
  fallback: string,
  origin: string = window.location.origin,
): string {
  if (!redirect) return fallback;
  try {
    const url = new URL(redirect, origin);
    if (url.origin !== origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
