"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardList, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, apiFetch, extractApiError } from "../../../../utils/api";
import { embedded, hasLink, type HalCollection } from "../../../../utils/hal";
import { semestreLegivel, type Pesquisa } from "../../../../utils/pesquisas";
import { formatDate } from "../../../../utils/types";
import BetaBadge from "../../../components/shared/BetaBadge";
import Card from "../../../components/ui/Card";
import EmptyState from "../../../components/ui/EmptyState";

export default function PesquisasAlunoPage() {
  const [pesquisas, setPesquisas] = useState<Pesquisa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`${API_BASE}/surveys`, { cache: "no-store" });
        if (!res.ok) throw new Error(await extractApiError(res, "Não foi possível carregar as pesquisas."));
        setPesquisas(embedded<Pesquisa>((await res.json()) as HalCollection<Pesquisa>, "surveys"));
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Não foi possível carregar as pesquisas.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-grotesk text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
          Pesquisa institucional <BetaBadge />
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          A cada semestre, a CPA (Comissão Própria de Avaliação) ouve os alunos sobre o curso, os professores e a
          estrutura da Fatec. As respostas orientam as melhorias.
        </p>
      </div>

      <Card className="flex items-start gap-3">
        <ShieldCheck className="size-5 shrink-0 text-[var(--success)] mt-0.5" />
        <div className="text-sm">
          <div className="font-medium">Sua resposta é anônima</div>
          <p className="text-muted-foreground">
            O sistema registra apenas <em>que</em> você respondeu, para não contar duas vezes. As respostas são
            guardadas sem o seu nome, RA ou horário, e os resultados só aparecem quando há respostas suficientes para
            ninguém ser identificado.
          </p>
        </div>
      </Card>

      {loading && (
        <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      )}

      {!loading && pesquisas.length === 0 && (
        <Card padding="none">
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            title="Nenhuma pesquisa aberta para o seu curso"
            description="Quando a CPA abrir a pesquisa do semestre, você recebe um aviso e ela aparece aqui."
          />
        </Card>
      )}

      {!loading &&
        pesquisas.map((p) => {
          const podeResponder = hasLink(p, "respond");
          return (
            <Card key={p.id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{p.titulo}</div>
                  <div className="text-xs text-muted-foreground">
                    {semestreLegivel(p.semestre)}
                    {p.totalPerguntas ? ` · ${p.totalPerguntas} perguntas` : ""}
                    {p.fechaEm ? ` · até ${formatDate(p.fechaEm)}` : ""}
                  </div>
                </div>
                {p.respondida && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-[var(--success)]/30 bg-[var(--success)]/12 px-2.5 py-1 text-xs font-medium text-[var(--success)]">
                    <CheckCircle2 className="size-3.5" /> Respondida
                  </span>
                )}
              </div>
              {p.descricao && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{p.descricao}</p>}
              {podeResponder && (
                <div className="flex justify-end">
                  <Link
                    href={`/aluno/pesquisas/${p.id}`}
                    className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground hover:opacity-90"
                  >
                    Responder agora
                  </Link>
                </div>
              )}
              {p.respondida && <p className="text-sm text-muted-foreground">Obrigado por participar!</p>}
              {!p.respondida && !podeResponder && <p className="text-sm text-muted-foreground">O prazo para responder terminou.</p>}
            </Card>
          );
        })}
    </div>
  );
}
