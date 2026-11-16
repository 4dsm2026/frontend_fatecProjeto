"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BusFront, ExternalLink, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, apiFetch, extractApiError } from "../../../../utils/api";
import { embedded, hasLink, type HalCollection } from "../../../../utils/hal";
import {
  EMTU_PASSE_URL,
  ETAPAS,
  STATUS_PASSE_ORIENTACAO,
  isFinal,
  type PasseResumo,
} from "../../../../utils/passe-escolar";
import { formatDate } from "../../../../utils/types";
import BetaBadge from "../../../components/shared/BetaBadge";
import PasseEscolarEtapas from "../../../components/shared/PasseEscolarEtapas";
import PasseEscolarStatusBadge from "../../../components/shared/PasseEscolarStatusBadge";
import Card from "../../../components/ui/Card";
import EmptyState from "../../../components/ui/EmptyState";

const QUEM_FAZ = { Você: "você", Fatec: "a Secretaria da Fatec", EMTU: "a EMTU/ARTESP" } as const;

export default function PasseEscolarAlunoPage() {
  const [colecao, setColecao] = useState<HalCollection<PasseResumo> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`${API_BASE}/school-passes?page=0&size=20`, { cache: "no-store" });
      if (!res.ok) throw new Error(await extractApiError(res, "Não foi possível carregar seus pedidos."));
      setColecao((await res.json()) as HalCollection<PasseResumo>);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar seus pedidos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pedidos = embedded<PasseResumo>(colecao, "school-passes");
  const emAndamento = pedidos.find((p) => !isFinal(p.status));
  const anteriores = pedidos.filter((p) => p.id !== emAndamento?.id);
  const podePedir = hasLink(colecao, "create") && !emAndamento;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-grotesk text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
            Passe Escolar <BetaBadge />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Passe Livre ou Meia Tarifa nos ônibus intermunicipais da EMTU/ARTESP. Peça aqui o cadastro à Fatec e
            acompanhe cada etapa.
          </p>
        </div>
        {podePedir && (
          <Link
            href="/aluno/passe-escolar/novo"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-primary px-4 text-sm text-primary-foreground hover:opacity-90"
          >
            <Plus className="size-4" /> Pedir cadastro
          </Link>
        )}
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      )}

      {!loading && emAndamento && (
        <Card className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold">Pedido de {emAndamento.anoReferencia}</div>
            <PasseEscolarStatusBadge status={emAndamento.status} />
          </div>
          <PasseEscolarEtapas status={emAndamento.status} />
          <p className="text-sm text-muted-foreground">{STATUS_PASSE_ORIENTACAO[emAndamento.status]}</p>
          <div className="flex justify-end">
            <Link href={`/aluno/passe-escolar/${emAndamento.id}`} className="text-sm font-medium text-primary hover:underline">
              Ver detalhes e agir →
            </Link>
          </div>
        </Card>
      )}

      {!loading && !emAndamento && (
        <Card padding="none">
          <EmptyState
            icon={<BusFront className="size-5" />}
            title="Você não tem pedido em andamento"
            description="Se mora em outro município e usa ônibus intermunicipal para vir à Fatec, pode pedir o Passe Escolar."
            action={
              podePedir && (
                <Link href="/aluno/passe-escolar/novo" className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm text-primary-foreground hover:opacity-90">
                  <Plus className="size-4" /> Pedir cadastro
                </Link>
              )
            }
          />
        </Card>
      )}

      <Card className="space-y-3">
        <div className="text-sm font-semibold">Como funciona</div>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-5">
          {ETAPAS.map((e) => (
            <li key={e.status}>
              <span className="font-medium text-foreground">{e.titulo}</span> — {QUEM_FAZ[e.quem]}
              {e.status === "SOLICITADO" && ": informe aqui os dados que a Fatec lança no portal."}
              {e.status === "CADASTRADO_PORTAL" && " lança seu nome, RG, CPF, CEP, curso e período no Portal de Relacionamento (até 30/11)."}
              {e.status === "REQUISITADO_EMTU" && ": preencha o formulário no site da EMTU, pague o boleto (sete tarifas-piso) e envie os documentos por lá."}
              {e.status === "CONCLUIDO" && " analisa em até 10 dias úteis e libera o benefício no cartão da sua região."}
            </li>
          ))}
        </ol>
        <a href={EMTU_PASSE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          Regras, prazos e formulário no site da EMTU <ExternalLink className="size-3.5" />
        </a>
      </Card>

      {!loading && anteriores.length > 0 && (
        <Card className="space-y-3">
          <div className="text-sm font-semibold">Pedidos anteriores</div>
          <ul className="divide-y divide-[var(--border)]">
            {anteriores.map((p) => (
              <li key={p.id} className="py-3">
                <Link href={`/aluno/passe-escolar/${p.id}`} className="flex items-center justify-between gap-3 hover:underline">
                  <span className="text-sm">
                    {p.anoReferencia} · {p.modalidade === "PASSE_LIVRE" ? "Passe Livre" : "Meia Tarifa"}
                    <span className="text-muted-foreground"> · {formatDate(p.criadoEm)}</span>
                  </span>
                  <PasseEscolarStatusBadge status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
