"use client";

import { useRouter } from "next/navigation";
import { logout } from "../../../utils/auth";

export function useSidebarLogout(onClose?: () => void) {
  const router = useRouter();

  return async function handleLogout() {
    try {
      // Revoga a sessão no servidor e limpa o estado local. Antes só limpava o
      // navegador e o refresh token seguia válido no servidor por 7 dias.
      // `logout()` nunca lança e tem tempo limite.
      await logout();
    } finally {
      router.push("/login");
      onClose?.();
    }
  };
}
