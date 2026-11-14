"use client";

import { useEffect, useState } from "react";
import { API_BASE, apiFetch } from "../../../../utils/api";
import type { HalCollection } from "../../../../utils/hal";

async function contar(status: string[]): Promise<number | null> {
  const qs = new URLSearchParams({ page: "0", size: "1" });
  status.forEach((s) => qs.append("status", s));
  const res = await apiFetch(`${API_BASE}/tickets?${qs}`, { cache: "no-store" });
  if (!res.ok) return null;
  const data: HalCollection = await res.json();
  return data.page?.totalElements ?? null;
}

/**
 * Contagens da barra lateral do aluno (#246): aguardando a ação dele e total de solicitações.
 * A API já devolve só os chamados do próprio aluno; basta pedir uma página de 1 item e ler o
 * total. Atualiza ao trocar de página e a cada minuto.
 */
export function useIndicadoresAluno(pathname: string) {
  const [aguardando, setAguardando] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let ativo = true;
    const atualizar = () =>
      Promise.all([contar(["AGUARDANDO_USUARIO"]), contar([])])
        .then(([a, t]) => {
          if (!ativo) return;
          setAguardando(a);
          setTotal(t);
        })
        .catch(() => {}); // indicador é auxiliar: falha de rede não pode quebrar a barra lateral
    atualizar();
    const intervalo = setInterval(atualizar, 60_000);
    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, [pathname]);

  return { aguardando, total };
}
