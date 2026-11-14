"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE, apiFetch, extractApiError } from "../../../../utils/api";
import { embedded, type HalCollection } from "../../../../utils/hal";
import type { CategoriaOpcao, Regra, SetorRef, UsuarioContato } from "../../../../utils/roteamento";
import BetaBadge from "../../../components/shared/BetaBadge";
import Alert from "../../../components/ui/Alert";
import HierarquiaSetor from "./_components/HierarquiaSetor";
import RegrasRoteamento from "./_components/RegrasRoteamento";
import SimularRoteamento from "./_components/SimularRoteamento";

const PAPEIS_EQUIPE = ["BACKOFFICE", "TECNICO", "ADMINISTRADOR"] as const;

async function json<T>(caminho: string, erro: string): Promise<T> {
  const r = await apiFetch(`${API_BASE}${caminho}`, { cache: "no-store" });
  if (!r.ok) throw Object.assign(new Error(await extractApiError(r, erro)), { status: r.status });
  return (await r.json()) as T;
}

/**
 * Roteamento de chamados (admin): regras que levam cada serviço do catálogo ao setor
 * certo e, por setor, quem recebe e-mail na chegada e depois do prazo.
 */
export default function AdminRoteamentoPage() {
  const [regras, setRegras] = useState<Regra[] | null>(null);
  const [setores, setSetores] = useState<SetorRef[]>([]);
  const [categorias, setCategorias] = useState<CategoriaOpcao[]>([]);
  const [equipe, setEquipe] = useState<UsuarioContato[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);

  const carregarRegras = useCallback(async () => {
    try {
      const r = await json<HalCollection<Regra>>("/admin/routing-rules", "Não foi possível carregar as regras.");
      setRegras(embedded<Regra>(r, "routing-rules"));
    } catch (e: unknown) {
      if ((e as { status?: number }).status === 403) setSemPermissao(true);
      else setErro(e instanceof Error ? e.message : "Não foi possível carregar as regras.");
    }
  }, []);

  useEffect(() => {
    void carregarRegras();
    json<HalCollection<SetorRef>>("/admin/sectors?page=0&size=100", "Não foi possível carregar os setores.")
      .then((r) => setSetores(embedded<SetorRef>(r, "sectors").map((s) => ({ id: s.id, nome: s.nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))))
      .catch(() => {});
    json<{ categorias: CategoriaOpcao[] }>("/catalog", "Não foi possível carregar o catálogo.")
      .then((r) => setCategorias((r.categorias ?? []).map((c) => ({ id: c.id, nome: c.nome, servicos: (c.servicos ?? []).map((s) => ({ id: s.id, nome: s.nome })) }))))
      .catch(() => {});
    Promise.all(
      PAPEIS_EQUIPE.map((papel) =>
        json<HalCollection<UsuarioContato>>(`/users?papel=${papel}&ativo=true&page=0&size=100`, "").then((r) => embedded<UsuarioContato>(r, "users")).catch(() => []),
      ),
    ).then((listas) => {
      const porId = new Map(listas.flat().map((u) => [u.id, u]));
      setEquipe([...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
    }).catch(() => {});
  }, [carregarRegras]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="font-grotesk text-2xl font-semibold tracking-tight">Roteamento de chamados</h1>
          <BetaBadge />
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Defina para qual setor vai cada tipo de chamado e quem é avisado por e-mail. Chamados sem regra seguem como antes
          (setor provável do serviço e, por último, a Secretaria).
        </p>
      </header>

      {semPermissao && <Alert variant="warning">Somente administradores configuram o roteamento.</Alert>}
      {erro && <Alert>{erro}</Alert>}

      {!semPermissao && (
        <>
          <RegrasRoteamento regras={regras} setores={setores} categorias={categorias} onMudou={carregarRegras} />
          <HierarquiaSetor setores={setores} equipe={equipe} />
          <SimularRoteamento categorias={categorias} />
        </>
      )}
    </div>
  );
}
