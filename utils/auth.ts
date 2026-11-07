import { clearSession } from "./session";

/**
 * Encerra a sessão SÓ no navegador (limpa os tokens e vai para o login).
 * É o que o apiFetch chama quando a renovação falha: nesse ponto a sessão já
 * está morta no servidor, então não há o que revogar e NÃO pode haver chamada
 * de rede aqui (senão um refresh falho entraria em laço com o próprio apiFetch).
 * Para sair de verdade (revogar no servidor), use logout() de utils/logout.
 */
export function logoutAndRedirect(): void {
  clearSession();
  if (typeof window !== "undefined") {
    window.location.replace("/login");
  }
}
