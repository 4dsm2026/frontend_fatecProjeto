"use client";

import { useRouter } from "next/navigation";
import Cookies from "js-cookie";

export function useSidebarLogout(onClose?: () => void) {
  const router = useRouter();

  return function handleLogout() {
    try {
      Cookies.remove("accessToken");
      Cookies.remove("refreshToken");

      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("userId");
    } catch (e) {
      console.error("Erro ao fazer logout:", e);
    }

    router.push("/login");
    onClose?.();
  };
}
