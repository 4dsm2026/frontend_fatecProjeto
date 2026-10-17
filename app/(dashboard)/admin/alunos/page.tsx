"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  Mail,
  IdCard,
  User as UserIcon,
  Trash2,
} from "lucide-react";

import FormAlunoCreate from "./../_components/FormAlunoCreate";
import ImportAlunos from "./../_components/ImportAlunos";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import { toast } from "sonner";
import { API_BASE, apiFetch, extractApiError } from "../../../../utils/api";
import { getEntry } from "../../../../utils/entry";
import { embedded, followLink, getLink, hasLink } from "../../../../utils/hal";
import type { HalCollection, HalPage, HalResource } from "../../../../utils/hal";
import { Skeleton } from "../../../components/ui/Skeleton";

import { cx } from '../../../../utils/cx'

/* ========= Tipos ========= */
type Papel = "USUARIO" | "BACKOFFICE" | "TECNICO" | "ADMINISTRADOR";
type StatusAtivo = "ATIVO" | "INATIVO";

type Usuario = HalResource & {
  id: string;
  nome: string | null;
  emailPessoal: string;
  emailEducacional: string | null;
  ra: string | null;
  ativo: boolean;
  criadoEm: string;
  papel?: Papel | null;
};

type AlunoRow = {
  _links?: Usuario["_links"];
  id: string;
  ra: string;
  emailEducacional: string;
  nome?: string | null;
  status: StatusAtivo;
  criadoEm: string;
};

type UsersCollection = HalCollection<Usuario> & {
  _embedded: { users: Usuario[] };
  page: HalPage;
};

/* ========= ENV ========= */
const ALUNO_DETAIL_PREFIX = "/admin/alunos/";

const PAGE_SIZE = 20;

async function requestUsersPage(query: string, page: number, status: StatusAtivo | "ALL"): Promise<UsersCollection> {
  const entry = await getEntry();
  const usersHref = getLink(entry, "users")?.href;
  if (!usersHref) throw new Error("A lista de usuários não está disponível para esta conta.");

  const url = new URL(usersHref, API_BASE || window.location.origin);
  url.searchParams.set("page", String(page));
  url.searchParams.set("size", String(PAGE_SIZE));
  url.searchParams.set("papel", "USUARIO");
  if (status !== "ALL") url.searchParams.set("ativo", String(status === "ATIVO"));
  if (query.trim()) url.searchParams.set("q", query.trim());

  const response = await apiFetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await extractApiError(response, `Falha ao buscar alunos (${response.status})`));
  }
  return (await response.json()) as UsersCollection;
}

function toAlunoRows(usuarios: Usuario[]): AlunoRow[] {
  return usuarios
    .map((u) => ({
      _links: u._links,
      id: u.id,
      ra: u.ra ?? "",
      emailEducacional: u.emailEducacional ?? u.emailPessoal,
      nome: u.nome,
      status: u.ativo ? ("ATIVO" as const) : ("INATIVO" as const),
      criadoEm: u.criadoEm,
    }));
}

function baixarModeloCSV() {
  const headers = [
    "ra", "emailEducacional", "nome", "emailPessoal", "cursoNome", "cursoSigla",
    "unidadeFatec", "turno", "turma", "semestreAtual", "anoSemestreIngresso", "ativo",
  ];
  const exemploMinimo = ["123456", "joao.silva@fatec.sp.gov.br", "", "", "", "", "", "", "", "", "", ""];
  const exemploCompleto = [
    "654321", "maria.souza@fatec.sp.gov.br", "Maria Souza", "maria.souza@gmail.com",
    "Desenvolvimento de Software Multiplataforma", "DSM", "Fatec Cotia", "Manhã", "DSM-3A", "3", "2023/1", "TRUE",
  ];
  const csvRows = [headers, exemploMinimo, exemploCompleto]
    .map((row) => row.map((cell) => {
      const value = String(cell ?? "");
      return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(","))
    .join("\n");
  const blob = new Blob([`﻿${csvRows}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "modelo_alunos_primeiro_acesso.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

async function deleteSelectedUsers(rows: AlunoRow[], selectedIds: Set<string>) {
  const deletableUsers = rows.filter(
    (user) => selectedIds.has(user.id) && hasLink(user, "delete"),
  );
  const results = await Promise.allSettled(
    deletableUsers.map(async (user) => {
      const response = await followLink(user, "delete");
      if (!response.ok) {
        throw new Error(await extractApiError(response, `Falha ao excluir aluno (${response.status})`));
      }
    }),
  );
  return {
    deletedCount: deletableUsers.length,
    failedCount: results.filter((result) => result.status === "rejected").length,
  };
}

function StatusBadge({ status }: { status: StatusAtivo }) {
  const map: Record<StatusAtivo, string> = {
    ATIVO: "bg-[var(--success)]/12 text-[var(--success)] border-[var(--success)]/30",
    INATIVO: "bg-[var(--muted)] text-muted-foreground border-[var(--border)]",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium border",
        map[status],
      )}
    >
      {status === "ATIVO" ? "Ativo" : "Inativo"}
    </span>
  );
}

function AlunoRowsTable({
  loading,
  rows,
  selectedIds,
  allVisibleSelected,
  error,
  onToggleSelectAll,
  onToggleSelectOne,
}: {
  loading: boolean;
  rows: AlunoRow[];
  selectedIds: ReadonlySet<string>;
  allVisibleSelected: boolean;
  error: string | null;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleSelectOne: (id: string, checked: boolean) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-[var(--muted)] text-foreground/90">
          <tr>
            <th className="px-3 py-3 w-8">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[var(--border)]"
                checked={allVisibleSelected}
                onChange={(event) => onToggleSelectAll(event.target.checked)}
                aria-label="Selecionar todos desta página"
              />
            </th>
            <th className="text-left font-medium px-4 py-3 hidden xl:table-cell">RA</th>
            <th className="text-left font-medium px-4 py-3">E-mail educacional</th>
            <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Nome</th>
            <th className="text-left font-medium px-4 py-3">Status</th>
            <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Criado em</th>
            <th className="text-right font-medium px-4 py-3">Ações</th>
          </tr>
        </thead>
        <tbody>
          {loading && Array.from({ length: 6 }).map((_, rowIndex) => (
            <tr key={`sk-${rowIndex}`} className="border-t border-[var(--border)]">
              {Array.from({ length: 7 }).map((__, columnIndex) => (
                <td key={columnIndex} className="px-4 py-3"><Skeleton className="h-3.5 w-full" /></td>
              ))}
            </tr>
          ))}
          {!loading && rows.map((aluno) => (
            <tr key={aluno.id} className="border-t border-[var(--border)]">
              <td className="px-3 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[var(--border)]"
                  checked={selectedIds.has(aluno.id)}
                  disabled={!hasLink(aluno, "delete")}
                  onChange={(event) => onToggleSelectOne(aluno.id, event.target.checked)}
                  aria-label={`Selecionar aluno RA ${aluno.ra}`}
                />
              </td>
              <td className="px-4 py-3 hidden xl:table-cell">
                <div className="inline-flex items-center gap-2">
                  <IdCard className="size-4 text-muted-foreground" />
                  <span className="font-medium">{aluno.ra || "—"}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" />
                  <span>{aluno.emailEducacional}</span>
                </div>
                <div className="md:hidden text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <UserIcon className="size-3" />
                  <span>{aluno.nome || "—"}</span>
                </div>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <div className="inline-flex items-center gap-2">
                  <UserIcon className="size-4 text-muted-foreground" />
                  <span>{aluno.nome || "—"}</span>
                </div>
              </td>
              <td className="px-4 py-3"><StatusBadge status={aluno.status} /></td>
              <td className="px-4 py-3 hidden lg:table-cell">
                {new Date(aluno.criadoEm).toLocaleDateString("pt-BR", {
                  day: "2-digit", month: "2-digit", year: "numeric",
                })}
              </td>
              <td className="px-4 py-3 text-right">
                <Link href={`${ALUNO_DETAIL_PREFIX}${aluno.id}`} className="h-9 px-3 rounded-md hover:bg-[var(--muted)]">
                  Ver
                </Link>
              </td>
            </tr>
          ))}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                {error ? "Falha ao carregar dados." : "Nenhum aluno encontrado com os filtros atuais."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ========= Página ========= */
export default function AdminAlunosPage() {
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusAtivo | "ALL">("ALL");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AlunoRow[]>([]);
  const [collection, setCollection] = useState<UsersCollection | null>(null);
  const [error, setError] = useState<null | string>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [page, setPage] = useState(0);

  async function fetchAlunos(requestedPage = 0) {
    try {
      setLoading(true);
      setError(null);
      const result = await requestUsersPage(q, requestedPage, status);
      setCollection(result);
      setPage(result.page.number);
      setRows(toAlunoRows(embedded(result, "users")));
      setSelectedIds(new Set());
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : String(e);
      setRows([]);
      setCollection(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchAlunos(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  async function movePage(rel: "prev" | "next") {
    if (!collection || !hasLink(collection, rel)) return;
    try {
      setLoading(true);
      const response = await followLink(collection, rel, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await extractApiError(response, `Falha ao buscar alunos (${response.status})`));
      }
      const result = (await response.json()) as UsersCollection;
      setCollection(result);
      setPage(result.page.number);
      setRows(toAlunoRows(embedded(result, "users")));
      setSelectedIds(new Set());
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao carregar alunos.");
    } finally {
      setLoading(false);
    }
  }

  const total = collection?.page.totalElements ?? 0;
  const totalPages = collection?.page.totalPages ?? 0;
  const pageSize = collection?.page.size ?? PAGE_SIZE;
  const prevEnabled = hasLink(collection, "prev");
  const nextEnabled = hasLink(collection, "next");
  const canCreate = hasLink(collection, "create");

  const visibleRows = rows;

  const hasSelected = selectedIds.size > 0;
  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((r) => selectedIds.has(r.id));

  function toggleSelectAllVisible(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) visibleRows.forEach((r) => next.add(r.id));
      else visibleRows.forEach((r) => next.delete(r.id));
      return next;
    });
  }

  function toggleSelectOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function doDeleteSelected() {
    try {
      setDeleting(true);
      const result = await deleteSelectedUsers(rows, selectedIds);
      const okCount = result.deletedCount - result.failedCount;
      if (result.failedCount) {
        toast.warning(`${okCount} excluído(s), ${result.failedCount} com erro.`);
      } else {
        toast.success(okCount === 1 ? "Aluno excluído." : `${okCount} alunos excluídos.`);
      }

      setSelectedIds(new Set());
      setPage(0);
      await fetchAlunos(0);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao excluir alunos selecionados.");
      throw e;
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-[var(--border)] bg-red-50 text-red-800 px-4 py-3">
          <div className="font-medium">Erro ao carregar alunos</div>
          <div className="text-sm">{error}</div>
        </div>
      )}

      {/* Modal: Importar CSV */}
          {showImport && collection && (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/30" onClick={() => setShowImport(false)} />
          <div className="absolute left-1/2 top-1/2 w-[92%] max-w-[960px] -translate-x-1/2 -translate-y-1/2 bg-background rounded-xl shadow-xl border border-[var(--border)] p-4">
            <ImportAlunos
              collection={collection}
              onClose={() => setShowImport(false)}
              onDone={() => { setShowImport(false); setPage(0); void fetchAlunos(0); }}
            />
          </div>
        </div>
      )}

      {/* Form inline */}
      {showForm && canCreate && collection ? (
        <div className="rounded-xl border border-[var(--border)] bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Cadastrar novo aluno</h2>
            <button type="button"
              onClick={() => setShowForm(false)}
              className="text-sm border px-3 h-8 rounded-md hover:bg-[var(--muted)]"
            >
              ← Voltar
            </button>
          </div>
          <FormAlunoCreate
            collection={collection}
            onSuccess={() => { setShowForm(false); setPage(0); void fetchAlunos(0); }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="rounded-xl border border-[var(--border)] bg-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {canCreate && (
                  <>
                    <button type="button"
                      onClick={() => setShowForm(true)}
                      className="inline-flex items-center gap-2 h-10 px-3 rounded-lg bg-primary text-primary-foreground text-sm hover:brightness-95"
                    >
                      <Plus className="size-4" />
                      Cadastrar aluno
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowImport(true)}
                      className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-[var(--border)] bg-background text-sm hover:bg-[var(--muted)]"
                    >
                      <Upload className="size-4" />
                      Importar planilha
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={baixarModeloCSV}
                  className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-[var(--border)] bg-background text-sm hover:bg-[var(--muted)]"
                  title="Baixar modelo CSV com todos os campos"
                >
                  <Download className="size-4" />
                  Modelo CSV
                </button>
                {rows.some((user) => hasLink(user, "delete")) && (
                  <button
                    type="button"
                    onClick={() => hasSelected && setConfirmDelete(true)}
                    disabled={!hasSelected || deleting}
                    className={cx(
                      "inline-flex items-center gap-2 h-10 px-3 rounded-lg border text-sm",
                      hasSelected && !deleting
                        ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                        : "border-[var(--border)] text-muted-foreground opacity-60 cursor-not-allowed",
                    )}
                  >
                    <Trash2 className="size-4" />
                    {deleting ? "Excluindo..." : "Excluir selecionados"}
                  </button>
                )}
              </div>

              <div className="flex w-full sm:w-auto flex-col gap-2 sm:flex-row">
                <div className="relative sm:w-[320px]">
                  <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    placeholder="Buscar por RA, e-mail ou nome"
                    className="w-full h-10 rounded-lg border border-[var(--border)] bg-input px-9 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    value={q}
                    onChange={(e) => { setPage(0); setQ(e.target.value); }}
                  />
                </div>
                <div className="relative">
                  <Filter className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    className="h-10 w-[160px] pl-9 pr-8 rounded-lg border border-[var(--border)] bg-background focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                    value={status}
                    onChange={(e) => {
                      setPage(0);
                      setStatus(e.target.value as StatusAtivo | "ALL");
                    }}
                  >
                    <option value="ALL">Todos</option>
                    <option value="ATIVO">Ativos</option>
                    <option value="INATIVO">Inativos</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Tabela */}
          <div className="rounded-xl border border-[var(--border)] bg-card overflow-hidden">
            <AlunoRowsTable
              loading={loading}
              rows={visibleRows}
              selectedIds={selectedIds}
              allVisibleSelected={allVisibleSelected}
              error={error}
              onToggleSelectAll={toggleSelectAllVisible}
              onToggleSelectOne={toggleSelectOne}
            />

            {/* Footer paginação */}
            <div className="flex items-center justify-between p-3 text-xs text-muted-foreground border-t border-[var(--border)]">
              <div>
                {total ? (
                  <>Mostrando {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} de {total}</>
                ) : (
                  <>Mostrando {visibleRows.length}</>
                )}
                {" · "}Página {page + 1} de {Math.max(totalPages, 1)}
              </div>
              <div className="inline-flex items-center gap-1">
                <button type="button"
                  className={cx("h-8 px-2 rounded-md", prevEnabled ? "hover:bg-[var(--muted)]" : "opacity-50 cursor-not-allowed")}
                  disabled={!prevEnabled || loading}
                  onClick={() => void movePage("prev")}
                >
                  Anterior
                </button>
                <button type="button"
                  className={cx("h-8 px-2 rounded-md", nextEnabled ? "hover:bg-[var(--muted)]" : "opacity-50 cursor-not-allowed")}
                  disabled={!nextEnabled || loading}
                  onClick={() => void movePage("next")}
                >
                  Próximo
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={selectedIds.size === 1 ? "Excluir aluno?" : `Excluir ${selectedIds.size} alunos?`}
        description="Os registros serão removidos (soft delete). Você pode confirmar para prosseguir."
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={doDeleteSelected}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
