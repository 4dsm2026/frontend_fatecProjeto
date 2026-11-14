"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, apiFetch, extractApiError } from "../../../../../utils/api";
import type { CategoriaOpcao, Simulacao } from "../../../../../utils/roteamento";
import Button from "../../../../components/ui/Button";
import Card from "../../../../components/ui/Card";
import { INPUT } from "./RegrasRoteamento";

/** Para onde iria um chamado deste serviço e quem receberia e-mail. Não envia nada. */
export default function SimularRoteamento({ categorias }: Readonly<{ categorias: CategoriaOpcao[] }>) {
  const [categoria, setCategoria] = useState("");
  const [servico, setServico] = useState("");
  const [resultado, setResultado] = useState<Simulacao | null>(null);
  const [carregando, setCarregando] = useState(false);

  const servicos = categoria ? categorias.find((c) => c.id === categoria)?.servicos ?? [] : [];

  async function simular() {
    try {
      setCarregando(true);
      const r = await apiFetch(`${API_BASE}/admin/routing-preview`, {
        method: "POST",
        body: JSON.stringify({ categoria: categoria || null, servico: servico || null }),
      });
      if (!r.ok) throw new Error(await extractApiError(r, "Não foi possível simular."));
      setResultado((await r.json()) as Simulacao);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível simular.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Card>
      <h2 className="font-grotesk text-lg font-semibold">Simular</h2>
      <p className="mb-3 text-sm text-muted-foreground">Escolha um serviço para ver o setor de destino e quem receberia o e-mail. Nada é enviado.</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Categoria</span>
          <select
            className={INPUT}
            value={categoria}
            onChange={(e) => {
              setCategoria(e.target.value);
              setServico("");
              setResultado(null);
            }}
          >
            <option value="">Escolha…</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Serviço</span>
          <select
            className={INPUT}
            value={servico}
            disabled={!categoria}
            onChange={(e) => {
              setServico(e.target.value);
              setResultado(null);
            }}
          >
            <option value="">Qualquer serviço</option>
            {servicos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" icon={<FlaskConical className="size-4" />} onClick={simular} loading={carregando} disabled={!categoria}>
          Simular
        </Button>
      </div>

      {resultado && (
        <div role="status" className="mt-4 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3 text-sm">
          <p>
            Vai para <b>{resultado.setor?.nome ?? "nenhum setor"}</b>
            {resultado.setorCopia && (
              <>
                , com cópia para <b>{resultado.setorCopia.nome}</b>
              </>
            )}
            .
          </p>
          <p className="text-muted-foreground">{resultado.motivo}</p>
          {resultado.setor?.prazoEscalonamentoHoras ? (
            <p className="text-muted-foreground">Escalona ao 2º nível depois de {resultado.setor.prazoEscalonamentoHoras} h úteis sem responsável.</p>
          ) : null}
          {resultado.emails.length ? (
            <ul className="list-inside list-disc">
              {resultado.emails.map((e) => (
                <li key={e.email}>
                  {e.nome} &lt;{e.email}&gt;{e.emCopia ? " (cópia)" : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[var(--warning)]">Ninguém recebe e-mail na chegada: cadastre o 1º nível desse setor.</p>
          )}
        </div>
      )}
    </Card>
  );
}
