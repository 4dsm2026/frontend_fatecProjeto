"use client";

import { useState } from "react";
import { ArrowRight, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, apiFetch, extractApiError } from "../../../../../utils/api";
import { getLink } from "../../../../../utils/hal";
import {
  REGRA_VAZIA,
  descreverGatilho,
  regraParaApi,
  regraParaForm,
  validarRegra,
  type CategoriaOpcao,
  type Regra,
  type RegraForm,
  type SetorRef,
} from "../../../../../utils/roteamento";
import Button from "../../../../components/ui/Button";
import Card from "../../../../components/ui/Card";
import ConfirmDialog from "../../../../components/ui/ConfirmDialog";

export const INPUT =
  "w-full rounded-lg border border-[var(--border)] bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";

type Props = {
  regras: Regra[] | null;
  setores: SetorRef[];
  categorias: CategoriaOpcao[];
  onMudou: () => void | Promise<void>;
};

export default function RegrasRoteamento({ regras, setores, categorias, onMudou }: Readonly<Props>) {
  const [editando, setEditando] = useState<Regra | "nova" | null>(null);
  const [form, setForm] = useState<RegraForm>(REGRA_VAZIA);
  const [salvando, setSalvando] = useState(false);
  const [excluir, setExcluir] = useState<Regra | null>(null);

  const servicosDaCategoria = form.categoriaChave
    ? categorias.find((c) => c.id === form.categoriaChave)?.servicos ?? []
    : categorias.flatMap((c) => c.servicos);

  function abrir(regra: Regra | "nova") {
    setEditando(regra);
    setForm(regra === "nova" ? REGRA_VAZIA : regraParaForm(regra));
  }

  function mudar<K extends keyof RegraForm>(campo: K, valor: RegraForm[K]) {
    setForm((f) => {
      const novo = { ...f, [campo]: valor };
      // Trocou a categoria: o serviço escolhido pode não ser dela.
      if (campo === "categoriaChave" && valor && !categorias.find((c) => c.id === valor)?.servicos.some((s) => s.id === f.servicoChave)) {
        novo.servicoChave = "";
      }
      return novo;
    });
  }

  async function salvar() {
    const problema = validarRegra(form);
    if (problema) {
      toast.error(problema);
      return;
    }
    const nova = editando === "nova";
    const href = nova ? "/admin/routing-rules" : getLink(editando, "update")?.href;
    try {
      setSalvando(true);
      const r = await apiFetch(`${API_BASE}${href}`, { method: nova ? "POST" : "PATCH", body: JSON.stringify(regraParaApi(form)) });
      if (!r.ok) throw new Error(await extractApiError(r, "Não foi possível salvar a regra."));
      toast.success(nova ? "Regra criada." : "Regra salva.");
      setEditando(null);
      await onMudou();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a regra.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(regra: Regra) {
    const r = await apiFetch(`${API_BASE}${getLink(regra, "update")?.href}`, { method: "PATCH", body: JSON.stringify({ ativo: !regra.ativo }) });
    if (!r.ok) toast.error(await extractApiError(r, "Não foi possível alterar a regra."));
    await onMudou();
  }

  async function confirmarExclusao() {
    if (!excluir) return;
    const r = await apiFetch(`${API_BASE}${getLink(excluir, "delete")?.href}`, { method: "DELETE" });
    if (r.ok) toast.success("Regra excluída.");
    else toast.error(await extractApiError(r, "Não foi possível excluir a regra."));
    setExcluir(null);
    await onMudou();
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-grotesk text-lg font-semibold">Regras</h2>
          <p className="text-sm text-muted-foreground">
            A regra do serviço vence a da categoria. Se duas regras servem, vale a de menor ordem.
          </p>
        </div>
        <Button size="sm" icon={<Plus className="size-4" />} onClick={() => abrir("nova")} disabled={editando !== null}>
          Nova regra
        </Button>
      </div>

      {editando && (
        <form
          aria-label={editando === "nova" ? "Nova regra" : "Editar regra"}
          className="mb-4 grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            salvar();
          }}
        >
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="font-medium">Nome</span>
            <input className={INPUT} value={form.nome} maxLength={120} placeholder="Ex.: Manutenção de equipamentos" onChange={(e) => mudar("nome", e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Categoria</span>
            <select className={INPUT} value={form.categoriaChave} onChange={(e) => mudar("categoriaChave", e.target.value)}>
              <option value="">Qualquer categoria</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Serviço</span>
            <select className={INPUT} value={form.servicoChave} onChange={(e) => mudar("servicoChave", e.target.value)}>
              <option value="">Todos os serviços da categoria</option>
              {servicosDaCategoria.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Vai para o setor</span>
            <select className={INPUT} value={form.setorId} onChange={(e) => mudar("setorId", e.target.value)}>
              <option value="">Escolha…</option>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Setor em cópia (opcional)</span>
            <select className={INPUT} value={form.setorCopiaId} onChange={(e) => mudar("setorCopiaId", e.target.value)}>
              <option value="">Nenhum</option>
              {setores
                .filter((s) => s.id !== form.setorId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
            </select>
            <span className="block text-xs text-muted-foreground">O 1º nível desse setor também recebe o e-mail, marcado como cópia.</span>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Ordem</span>
            <input className={INPUT} type="number" min={0} max={9999} value={form.ordem} onChange={(e) => mudar("ordem", Number(e.target.value) || 0)} />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" className="size-4" checked={form.ativo} onChange={(e) => mudar("ativo", e.target.checked)} />
            Regra ativa
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button type="submit" loading={salvando}>
              Salvar regra
            </Button>
          </div>
        </form>
      )}

      {regras === null && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {regras?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma regra. Todos os chamados seguem o setor provável do serviço.</p>}
      {!!regras?.length && (
        <ul className="divide-y divide-[var(--border)]">
          {regras.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.nome}</span>
                  {!r.ativo && (
                    <span className="rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      Desligada
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">ordem {r.ordem}</span>
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                  <span>{descreverGatilho(r, categorias)}</span>
                  <ArrowRight className="size-3.5" aria-hidden />
                  <span className="font-medium text-foreground">{r.setor?.nome ?? r.setorId}</span>
                  {r.setorCopia && <span>· cópia: {r.setorCopia.nome}</span>}
                </p>
              </div>
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" className="size-4" checked={r.ativo} onChange={() => alternar(r)} aria-label={`Regra ${r.nome} ativa`} />
                Ativa
              </label>
              <Button size="icon" variant="ghost" aria-label={`Editar ${r.nome}`} onClick={() => abrir(r)} disabled={editando !== null}>
                <Pencil className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" aria-label={`Excluir ${r.nome}`} onClick={() => setExcluir(r)}>
                <Trash2 className="size-4 text-[var(--destructive)]" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={excluir !== null}
        title="Excluir regra?"
        description={excluir ? `"${excluir.nome}" deixa de valer para os próximos chamados. Os já abertos continuam onde estão.` : undefined}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={confirmarExclusao}
        onClose={() => setExcluir(null)}
      />
    </Card>
  );
}
