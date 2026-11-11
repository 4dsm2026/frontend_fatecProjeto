import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("../utils/api", () => ({ API_BASE: "", apiFetch }));

import { useIndicadoresAluno } from "../app/(dashboard)/aluno/_components/useIndicadoresAluno";

const pagina = (total: number) => ({ ok: true, json: async () => ({ page: { size: 1, number: 0, totalElements: total, totalPages: total } }) });

describe("useIndicadoresAluno (#246)", () => {
  beforeEach(() => apiFetch.mockReset());

  it("lê o total da API: aguardando o aluno e todas as solicitações", async () => {
    apiFetch.mockImplementation(async (url?: string) => (String(url).includes("status=AGUARDANDO_USUARIO") ? pagina(1) : pagina(3)));
    const { result } = renderHook(() => useIndicadoresAluno("/aluno/home"));
    await waitFor(() => expect(result.current).toEqual({ aguardando: 1, total: 3 }));
    const urls = apiFetch.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain("/tickets?page=0&size=1&status=AGUARDANDO_USUARIO");
    expect(urls).toContain("/tickets?page=0&size=1");
  });

  it("sem resposta da API, mostra vazio em vez de zero", async () => {
    apiFetch.mockResolvedValue({ ok: false, json: async () => ({}) });
    const { result } = renderHook(() => useIndicadoresAluno("/aluno/home"));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    expect(result.current).toEqual({ aguardando: null, total: null });
  });
});
