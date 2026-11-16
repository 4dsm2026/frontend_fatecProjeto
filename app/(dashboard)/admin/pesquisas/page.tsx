"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, apiFetch, extractApiError } from "../../../../utils/api";
import { embedded, followLink, hasLink, type HalCollection } from "../../../../utils/hal";
import { proximoSemestre, semestreAtual, semestreLegivel, semestreValido, type Pesquisa } from "../../../../utils/pesquisas";
import BetaBadge from "../../../components/shared/BetaBadge";
import PesquisaStatusBadge from "../../../components/shared/PesquisaStatusBadge";
import Alert from "../../../components/ui/Alert";
import Card from "../../../components/ui/Card";

const INPUT = "h-10 w-full rounded-lg border border-[var(--border)] bg-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";
const MODELO = "__modelo__";
const EM_BRANCO = "__branco__";

/**
 * Edições da pesquisa institucional, uma por semestre. A edição nova nasce da
 * cópia da anterior (ou do modelo da CPA), como rascunho.
 */
export default function AdminPesquisasPage() {
  const router = useRouter();
  const [colecao, setColecao] = useState<HalCollection<Pesquisa> | null>(null);
  const [loading, setLoading] = useState(true);
  const [semestre, setSemestre] = useState(semestreAtual());
  const [origem, setOrigem] = useState(MODELO);
  const [criando, setCriando] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`${API_BASE}/surveys?page=0&size=100`, { cache: "no-store" });
      if (!res.ok) throw new Error(await extractApiError(res, "Não foi possível carregar as pesquisas."));
      const dados = (await res.json()) as HalCollection<Pesquisa>;
      setColecao(dados);
      // Sugestão: copiar a edição mais recente para o semestre que ainda não tem pesquisa.
      const lista = embedded<Pesquisa>(dados, "surveys");
      if (lista.length) {
        setOrigem(lista[0].id);
        const atual = semestreAtual();
        setSemestre(lista.some((p) => p.semestre === atual) ? proximoSemestre(lista[0].semestre) : atual);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar as pesquisas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pesquisas = embedded<Pesquisa>(colecao, "surveys");
  const podeCriar = hasLink(colecao, "create");
  const atual = semestreAtual();
  const semPesquisaNoSemestre = !loading && !pesquisas.some((p) => p.semestre === atual);

  async function criar(e: FormEvent) {
    e.preventDefault();
    if (!semestreValido(semestre)) {
      toast.error('Semestre no formato AAAA-1 ou AAAA-2 (ex.: "2026-2").');
      return;
    }
    try {
      setCriando(true);
      const copiarDe = pesquisas.find((p) => p.id === origem);
      const res = copiarDe
        ? await followLink(copiarDe, "copy", { body: JSON.stringify({ semestre: semestre.trim() }) })
        : await followLink(colecao, "create", {
            body: JSON.stringify({ titulo: `Pesquisa CPA ${semestre.trim()}`, semestre: semestre.trim(), modelo: origem === MODELO }),
          });
      if (!res.ok) throw new Error(await extractApiError(res, "Não foi possível criar a pesquisa."));
      const criada = (await res.json()) as Pesquisa;
      toast.success("Rascunho criado. Revise as perguntas antes de abrir.");
      router.push(`/admin/pesquisas/${criada.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar a pesquisa.");
    } finally {
      setCriando(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-grotesk text-2xl font-semibold tracking-tight inline-flex items-center gap-2">
          Pesquisa institucional <BetaBadge />
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Autoavaliação da CPA, uma edição por semestre. Os alunos de cada curso respondem de forma anônima e os
          resultados aparecem por curso.
        </p>
      </div>

      {semPesquisaNoSemestre && (
        <Alert variant="info" title={`Ainda não há pesquisa do ${semestreLegivel(atual)}`}>
          {podeCriar
            ? "Crie a edição deste semestre abaixo. Ela nasce como rascunho, com as perguntas da edição anterior ou do modelo da CPA."
            : "A administração ainda não criou a edição deste semestre."}
        </Alert>
      )}

      {podeCriar && (
        <Card>
          <form onSubmit={criar} className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Semestre</span>
              <input className={INPUT} value={semestre} onChange={(e) => setSemestre(e.target.value)} placeholder="2026-2" maxLength={6} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Começar a partir de</span>
              <select className={INPUT} value={origem} onChange={(e) => setOrigem(e.target.value)}>
                {pesquisas.map((p) => (
                  <option key={p.id} value={p.id}>
                    Cópia de “{p.titulo}” ({p.semestre})
                  </option>
                ))}
                <option value={MODELO}>Modelo da CPA (16 perguntas)</option>
                <option value={EM_BRANCO}>Em branco</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={criando}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {criando ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Nova edição
            </button>
          </form>
        </Card>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-card overflow-hidden">
        {loading && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin inline-block mr-2" /> Carregando…
          </div>
        )}
        {!loading && pesquisas.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground inline-flex items-center gap-2 justify-center w-full">
            <ClipboardList className="size-4" /> Nenhuma pesquisa criada ainda.
          </div>
        )}
        {!loading && pesquisas.length > 0 && (
          <ul className="divide-y divide-[var(--border)]">
            {pesquisas.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/pesquisas/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--muted)]/60 transition">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.titulo}</div>
                    <div className="text-xs text-muted-foreground">
                      {semestreLegivel(p.semestre)} · {p.totalPerguntas ?? 0} perguntas
                      {p.status !== "RASCUNHO" ? ` · ${p.totalRespostas ?? 0} respostas` : ""}
                      {p.cursos?.length ? ` · ${p.cursos.length} curso(s)` : " · todos os cursos"}
                    </div>
                  </div>
                  <PesquisaStatusBadge status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
