"use client";

import { useEffect, useState } from "react";
import { API_BASE, apiFetch, extractApiError } from "../../../../utils/api";
import type { MapaAtual } from "../../../../utils/mapa-salas";
import BetaBadge from "../../../components/shared/BetaBadge";
import VisualizadorMapaSalas from "../../../components/shared/VisualizadorMapaSalas";
import Alert from "../../../components/ui/Alert";

export default function MapaDeSalasAlunoPage() {
  const [mapa, setMapa] = useState<MapaAtual | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`${API_BASE}/room-maps/current`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(await extractApiError(r, "Não foi possível carregar o mapa de salas."));
        setMapa((await r.json()) as MapaAtual);
      })
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : "Não foi possível carregar o mapa de salas."));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-grotesk text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
          Mapa de salas <BetaBadge />
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Em que sala é cada aula, conforme o mapa publicado pela Fatec.</p>
      </div>
      {erro ? <Alert variant="error">{erro}</Alert> : <VisualizadorMapaSalas mapa={mapa} />}
    </div>
  );
}
