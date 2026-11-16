"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, PauseCircle, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, apiFetch, extractApiError } from "../../../../utils/api";
import { embedded, followLink, type HalCollection } from "../../../../utils/hal";
import {
  MAX_TRANCAMENTOS,
  MOTIVOS,
  TIPO_LABEL,
  errosDoFormulario,
  proximoSemestre,
  semestreLegivel,
  type Elegibilidade,
  type FormularioSolicitacao,
  type Solicitacao,
  type TipoSolicitacao,
} from "../../../../utils/matricula";
import { formatDate } from "../../../../utils/types";
import { cx } from "../../../../utils/cx";
import BetaBadge from "../../../components/shared/BetaBadge";
import { SituacaoBadge, SolicitacaoStatusBadge } from "../../../components/shared/MatriculaBadges";
import Alert from "../../../components/ui/Alert";
import Card from "../../../components/ui/Card";

const INPUT = "w-full rounded-lg border border-[var(--border)] bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";

function OpcaoTipo({
  tipo,
  ativo,
  bloqueio,
  onClick,
}: Readonly<{ tipo: TipoSolicitacao; ativo: boolean; bloqueio: string | null; onClick: () => void }>) {
  const trancar = tipo === "TRANCAMENTO";
  const Icone = trancar ? PauseCircle : XCircle;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!!bloqueio}
      aria-pressed={ativo}
      className={cx(
        "flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
        ativo ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-[var(--border)] hover:bg-[var(--muted)]/60",
      )}
    >
      <span className="inline-flex items-center gap-2 font-medium">
        <Icone className={cx("size-4", trancar ? "text-[var(--warning)]" : "text-destructive")} /> {trancar ? "Trancar matrícula" : "Cancelar matrícula"}
      </span>
      <span className="text-xs text-muted-foreground">
        {trancar
          ? `Suspende o curso por um semestre e mantém a sua vaga. Limite de ${MAX_TRANCAMENTOS} trancamentos.`
          : "Encerra o vínculo com o curso. É definitivo: para voltar, só por novo vestibular."}
      </span>
      {bloqueio && <span className="text-xs font-medium text-destructive">{bloqueio}</span>}
    </button>
  );
}

export default function MatriculaAlunoPage() {
  const router = useRouter();
  const [eleg, setEleg] = useState<Elegibilidade | null>(null);
  const [pedidos, setPedidos] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormularioSolicitacao | null>(null);
  const [erros, setErros] = useState<Partial<Record<keyof FormularioSolicitacao, string>>>({});
  const [enviando, setEnviando] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [rE, rP] = await Promise.all([
        apiFetch(`${API_BASE}/enrollment-requests/eligibility`, { cache: "no-store" }),
        apiFetch(`${API_BASE}/enrollment-requests?page=0&size=50`, { cache: "no-store" }),
      ]);
      if (!rE.ok) throw new Error(await extractApiError(rE, "Não foi possível carregar sua situação."));
      if (!rP.ok) throw new Error(await extractApiError(rP, "Não foi possível carregar seus pedidos."));
      setEleg((await rE.json()) as Elegibilidade);
      setPedidos(embedded<Solicitacao>((await rP.json()) as HalCollection<Solicitacao>, "enrollment-requests"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function escolher(tipo: TipoSolicitacao) {
    if (!eleg) return;
    setErros({});
    setForm((f) => ({ tipo, semestre: f?.semestre ?? eleg.semestreLetivo, motivo: f?.motivo ?? "", justificativa: f?.justificativa ?? "", cienteDefinitivo: false }));
  }

  function set<K extends keyof FormularioSolicitacao>(campo: K, valor: FormularioSolicitacao[K]) {
    setForm((f) => (f ? { ...f, [campo]: valor } : f));
    setErros((e) => ({ ...e, [campo]: undefined }));
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!form || !eleg) return;
    const encontrados = errosDoFormulario(form);
    setErros(encontrados);
    if (Object.keys(encontrados).length) return;
    try {
      setEnviando(true);
      const res = await followLink(eleg, "create", {
        body: JSON.stringify({
          tipo: form.tipo,
          semestre: form.semestre,
          motivo: form.motivo,
          justificativa: form.justificativa.trim() || null,
          ...(form.tipo === "CANCELAMENTO" ? { cienteDefinitivo: form.cienteDefinitivo } : {}),
        }),
      });
      if (!res.ok) throw new Error(await extractApiError(res, "Não foi possível enviar o pedido."));
      const criado = (await res.json()) as Solicitacao;
      toast.success("Pedido enviado. A Secretaria foi avisada.");
      router.push(`/aluno/matricula/${criado.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o pedido.");
    } finally {
      setEnviando(false);
    }
  }

  const andamento = eleg?.pedidoEmAndamento;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-grotesk text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
          Trancamento e cancelamento <BetaBadge />
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Peça à Secretaria o trancamento ou o cancelamento da sua matrícula e acompanhe a decisão por aqui.
        </p>
      </div>

      {loading && !eleg && (
        <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      )}

      {eleg && (
        <Card className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">Situação da matrícula</div>
            <div className="mt-1">
              <SituacaoBadge situacao={eleg.situacaoAcademica} />
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Curso</div>
            <div className="text-sm font-medium">{eleg.curso ?? "Não informado"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Trancamentos usados</div>
            <div className="text-sm font-medium">
              {eleg.trancamentosDeferidos} de {MAX_TRANCAMENTOS}
            </div>
          </div>
        </Card>
      )}

      {andamento && (
        <Alert variant="info" title="Você já tem um pedido em andamento">
          {TIPO_LABEL[andamento.tipo]} —{" "}
          <Link href={`/aluno/matricula/${andamento.id}`} className="font-medium underline">
            acompanhar o pedido
          </Link>
          .
        </Alert>
      )}

      {eleg && !andamento && (eleg.podeTrancar || eleg.podeCancelar) && (
        <Card className="space-y-5">
          <div className="text-sm font-semibold">Novo pedido</div>
          <Alert variant="warning" title="Antes de decidir, converse com a coordenação">
            Muitas dificuldades (horário, disciplinas, transporte) têm alternativa sem sair do curso. Trancar mantém a
            sua vaga; cancelar não.
          </Alert>
          <div className="grid gap-3 sm:grid-cols-2">
            <OpcaoTipo tipo="TRANCAMENTO" ativo={form?.tipo === "TRANCAMENTO"} bloqueio={eleg.podeTrancar ? null : eleg.bloqueioTrancamento} onClick={() => escolher("TRANCAMENTO")} />
            <OpcaoTipo tipo="CANCELAMENTO" ativo={form?.tipo === "CANCELAMENTO"} bloqueio={eleg.podeCancelar ? null : eleg.bloqueioCancelamento} onClick={() => escolher("CANCELAMENTO")} />
          </div>

          {form && (
            <form onSubmit={enviar} className="space-y-4" noValidate>
              {form.tipo === "TRANCAMENTO" && eleg.avisosTrancamento.length > 0 && (
                <Alert variant="warning">
                  <ul className="list-disc pl-4">
                    {eleg.avisosTrancamento.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Semestre</span>
                  <select className={INPUT} value={form.semestre} onChange={(e) => set("semestre", e.target.value)}>
                    {[eleg.semestreLetivo, proximoSemestre(eleg.semestreLetivo)].map((s) => (
                      <option key={s} value={s}>
                        {semestreLegivel(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Motivo principal</span>
                  <select className={INPUT} value={form.motivo} onChange={(e) => set("motivo", e.target.value)} aria-invalid={!!erros.motivo}>
                    <option value="">Selecione…</option>
                    {MOTIVOS.map((m) => (
                      <option key={m.valor} value={m.valor}>
                        {m.rotulo}
                      </option>
                    ))}
                  </select>
                  {erros.motivo && <span className="block text-xs text-destructive" role="alert">{erros.motivo}</span>}
                </label>
              </div>

              <label className="space-y-1 text-sm block">
                <span className="font-medium">Conte mais (opcional{form.motivo === "OUTRO" ? ", obrigatório para “Outro”" : ""})</span>
                <textarea
                  className={`${INPUT} resize-none`}
                  rows={4}
                  maxLength={2000}
                  value={form.justificativa}
                  onChange={(e) => set("justificativa", e.target.value)}
                  placeholder="Ajuda a Secretaria a decidir e a coordenação a entender o que pode melhorar."
                />
                {erros.justificativa && <span className="block text-xs text-destructive" role="alert">{erros.justificativa}</span>}
              </label>

              {form.tipo === "CANCELAMENTO" && (
                <div className="space-y-1">
                  <label className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                    <input type="checkbox" className="mt-0.5 size-4" checked={form.cienteDefinitivo} onChange={(e) => set("cienteDefinitivo", e.target.checked)} />
                    <span>
                      Entendo que o cancelamento é <strong>definitivo</strong>: perco a vaga e, para voltar, preciso passar
                      por novo processo seletivo.
                    </span>
                  </label>
                  {erros.cienteDefinitivo && <span className="block text-xs text-destructive" role="alert">{erros.cienteDefinitivo}</span>}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setForm(null)} className="h-10 rounded-md border border-[var(--border)] px-4 text-sm hover:bg-[var(--muted)]">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviando}
                  className={cx(
                    "inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm text-white hover:opacity-90 disabled:opacity-60",
                    form.tipo === "CANCELAMENTO" ? "bg-destructive" : "bg-primary",
                  )}
                >
                  {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  {form.tipo === "CANCELAMENTO" ? "Pedir cancelamento" : "Pedir trancamento"}
                </button>
              </div>
            </form>
          )}
        </Card>
      )}

      {eleg && !andamento && !eleg.podeTrancar && !eleg.podeCancelar && (
        <Alert variant="info">{eleg.bloqueioCancelamento ?? eleg.bloqueioTrancamento}</Alert>
      )}

      {pedidos.length > 0 && (
        <Card className="space-y-3">
          <div className="text-sm font-semibold">Seus pedidos</div>
          <ul className="divide-y divide-[var(--border)]">
            {pedidos.map((p) => (
              <li key={p.id} className="py-3">
                <Link href={`/aluno/matricula/${p.id}`} className="flex items-center justify-between gap-3 hover:underline">
                  <span className="text-sm">
                    {TIPO_LABEL[p.tipo]} · {semestreLegivel(p.semestre)}
                    <span className="text-muted-foreground"> · {formatDate(p.criadoEm)}</span>
                  </span>
                  <SolicitacaoStatusBadge status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
