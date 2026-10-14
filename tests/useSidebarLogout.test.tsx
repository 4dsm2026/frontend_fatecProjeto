import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { push, logout } = vi.hoisted(() => ({ push: vi.fn(), logout: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../utils/logout", () => ({ logout }));

import { useSidebarLogout } from "../app/components/shared/useSidebarLogout";

beforeEach(() => {
  vi.clearAllMocks();
  logout.mockResolvedValue(undefined);
});

describe("useSidebarLogout (botão Sair das sidebars)", () => {
  it("revoga a sessão no servidor ANTES de ir para o login", async () => {
    const ordem: string[] = [];
    logout.mockImplementation(async () => void ordem.push("logout"));
    push.mockImplementation(() => void ordem.push("push"));
    const { result } = renderHook(() => useSidebarLogout());

    await result.current();

    expect(ordem).toEqual(["logout", "push"]);
    expect(push).toHaveBeenCalledWith("/login");
  });

  it("fecha a sidebar (onClose) depois de sair", async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useSidebarLogout(onClose));

    await result.current();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("mesmo que o logout falhe, o usuário vai para o login", async () => {
    logout.mockRejectedValue(new Error("inesperado"));
    const { result } = renderHook(() => useSidebarLogout());

    await expect(result.current()).rejects.toThrow("inesperado");

    expect(push).toHaveBeenCalledWith("/login");
  });
});
