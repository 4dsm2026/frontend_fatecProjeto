"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Search, Filter, Plus, Upload, Download,
  BadgeCheck, Building2, User as UserIcon
} from "lucide-react";
import { API_BASE, apiFetch, extractApiError } from "../../../../utils/api";
import { getEntry } from "../../../../utils/entry";
import { embedded, followLink, getLink, hasLink } from "../../../../utils/hal";
import type { HalCollection, HalPage, HalResource } from "../../../../utils/hal";
import { Skeleton } from "../../../components/ui/Skeleton";
import { cx } from '../../../../utils/cx';
import { toast } from "sonner";

/* ========= Tipos ========= */
type Papel = "BACKOFFICE" | "TECNICO" | "ADMINISTRADOR" | "USUARIO";
type StatusAtivo = "ATIVO" | "INATIVO";

type UsuarioApi = HalResource & {
  id: string;
  nome: string | null;
  emailPessoal: string | null;
  emailEducacional: string | null;
  ra: string | null;
  papel?: Papel | null;
  papeis?: Papel[] | null;
  setores?: Array<{ nome: string }> | string[] | null;
  ativo: boolean;
  criadoEm: string;
};

type FuncionarioRow = Omit<UsuarioApi, "ra" | "ativo"> & {
  id: string;
  emailEducacional: string;
  emailPessoal?: string | null;
  nome?: string | null;
  papel: Exclude<Papel, "USUARIO">;
  setores: string[];
  status: StatusAtivo;
  criadoEm: string;
};

const FUNC_DETAIL_PREFIX = "/admin/funcionarios";
const PAGE_SIZE = 20;

type UsersCollection = HalCollection<UsuarioApi> & {
  _embedded: { users: UsuarioApi[] };
  page: HalPage;
};

async function requestUsersPage(
  query: string,
  page: number,
  status: StatusAtivo | "ALL",
): Promise<UsersCollection> {
  const entry = await getEntry();
  const usersHref = getLink(entry, "users")?.href;
  if (!usersHref) throw new Error("A lista de usuários não está disponível para esta conta.");

  const url = new URL(usersHref, API_BASE || window.location.origin);
  url.searchParams.set("page", String(page));
  url.searchParams.set("size", String(PAGE_SIZE));
  if (status !== "ALL") url.searchParams.set("ativo", String(status === "ATIVO"));
  if (query.trim()) url.searchParams.set("q", query.trim());

  const response = await apiFetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await extractApiError(response, `Falha ao buscar funcionários (${response.status})`));
  }
  return (await response.json()) as UsersCollection;
}

function paginationSummary(page: HalPage | undefined, visibleCount: number): string {
  if (!page || page.totalElements === 0) return `Mostrando ${visibleCount}`;
  const first = page.number * page.size + 1;
  const last = Math.min((page.number + 1) * page.size, page.totalElements);
  return `Mostrando ${first}-${last} de ${page.totalElements}`;
}

function StatusBadge({ status }: { status: StatusAtivo }) {
  const map: Record<StatusAtivo, string> = {
    ATIVO: "bg-[var(--success)]/12 text-[var(--success)] border-[var(--success)]/30",
    INATIVO: "bg-[var(--muted)] text-muted-foreground border-[var(--border)]",
  };
  return (
    <span className={cx("inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium border", map[status])}>
      {status === "ATIVO" ? "Ativo" : "Inativo"}
    </span>
  );
}

function normalizarSetores(s?: UsuarioApi["setores"]): string[] {
  if (!s) return [];
  if (!Array.isArray(s) || s.length === 0) return [];
  if (typeof s[0] === "string") return s as string[];
  return (s as Array<{ nome: string }>).map((x) => x?.nome).filter(Boolean) as string[];
}

function extrairPapel(u: UsuarioApi): Papel | null {
  if (u.papel) return u.papel;
  if (u.papeis && u.papeis.length) return u.papeis[0]!;
  return null;
}

function mapRow(u: UsuarioApi): FuncionarioRow | null {
  const p = extrairPapel(u);
  if (!p || p === "USUARIO") return null;
  return {
    _links: u._links,
    id: u.id,
    emailEducacional: u.emailEducacional ?? u.emailPessoal ?? "",
    emailPessoal: u.emailPessoal ?? null,
    nome: u.nome ?? null,
    papel: p,
    setores: normalizarSetores(u.setores),
    status: u.ativo ? "ATIVO" : "INATIVO",
    criadoEm: u.criadoEm,
  };
}

export default function AdminFuncionariosPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusAtivo | "ALL">("ALL");
  const [papel, setPapel] = useState<Exclude<Papel, "USUARIO"> | "ALL">("ALL");

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FuncionarioRow[]>([]);
  const [collection, setCollection] = useState<UsersCollection | null>(null);
  const [error, setError] = useState<null | string>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  async function fetchFuncionarios(requestedPage = 0) {
    try {
      setLoading(true);
      setError(null);
      const result = await requestUsersPage(q, requestedPage, status);
      const mapped = embedded(result, "users")
        .map(mapRow)
        .filter((user): user is FuncionarioRow => user !== null);
      setCollection(result);
      setRows(mapped);
    } catch (e: unknown) {
      setRows([]);
      setCollection(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchFuncionarios(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  async function movePage(rel: "prev" | "next") {
    if (!collection || !hasLink(collection, rel)) return;
    try {
      setLoading(true);
      const response = await followLink(collection, rel, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await extractApiError(response, `Falha ao buscar funcionários (${response.status})`));
      }
      const result = (await response.json()) as UsersCollection;
      const mapped = embedded(result, "users")
        .map(mapRow)
        .filter((user): user is FuncionarioRow => user !== null);
      setCollection(result);
      setRows(mapped);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao carregar funcionários.");
    } finally {
      setLoading(false);
    }
  }

  // /users accepts one papel value; keep the three-role selector local, so totals include every staff role.
  const visibleRows = useMemo(() => {
    return rows.filter((f) => {
      const matchPapel = papel === "ALL" || f.papel === papel;
      return matchPapel;
    });
  }, [rows, papel]);

  const page = collection?.page.number ?? 0;
  const totalPages = collection?.page.totalPages ?? 0;
  const prevEnabled = hasLink(collection, "prev");
  const nextEnabled = hasLink(collection, "next");
  const canCreate = hasLink(collection, "create");

  function onImportClick() { fileRef.current?.click(); }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    toast.success(`Planilha selecionada: ${file.name}`);
    e.target.value = "";
  }

  function baixarModeloCSV() {
    const headers = ["emailEducacional", "emailPessoal", "nome", "papel", "setores", "status"];
    const exemplo = ["nome.sobrenome@fatec.sp.gov.br", "nome.sobrenome@gmail.com", "Nome Sobrenome", "TECNICO", "TI Acadêmica", "ATIVO"];
    const csv = [headers.join(","), exemplo.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "modelo_funcionarios.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-[var(--border)] bg-red-50 text-red-800 px-4 py-3">
          <div className="font-medium">Erro ao carregar funcionários</div>
          <div className="text-sm">{error}</div>
        </div>
      )}

      {/* Toolbar */}
      <div className="rounded-xl border border-[var(--border)] bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {canCreate && (
              <Link
                href="/admin/funcionarios/novo"
                className="inline-flex items-center gap-2 h-10 px-3 rounded-lg bg-primary text-primary-foreground text-sm hover:brightness-95"
              >
                <Plus className="size-4" /> Cadastrar funcionário
              </Link>
            )}
            <button type="button" onClick={onImportClick}
              className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-[var(--border)] bg-background text-sm hover:bg-[var(--muted)]">
              <Upload className="size-4" /> Importar planilha
            </button>
            <button type="button" onClick={baixarModeloCSV}
              className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-[var(--border)] bg-background text-sm hover:bg-[var(--muted)]">
              <Download className="size-4" /> Modelo CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" className="hidden" onChange={onFileChange} />
          </div>

          <div className="flex w-full sm:w-auto flex-col gap-2 sm:flex-row">
            <div className="relative sm:w-[320px]">
              <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                placeholder="Buscar por e-mail, nome, setor…"
                className="w-full h-10 rounded-lg border border-[var(--border)] bg-input px-9 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Filter className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  className="h-10 w-[200px] pl-9 pr-8 rounded-lg border border-[var(--border)] bg-background focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  value={papel}
                  onChange={(e) => setPapel(e.target.value as Exclude<Papel, "USUARIO"> | "ALL")}
                >
                  <option value="ALL">Todos os papéis</option>
                  <option value="BACKOFFICE">Backoffice</option>
                  <option value="TECNICO">Técnico</option>
                  <option value="ADMINISTRADOR">Administrador</option>
                </select>
              </div>
              <select
                className="h-10 w-[160px] px-3 rounded-lg border border-[var(--border)] bg-background focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusAtivo | "ALL")}
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
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--muted)] text-foreground/90">
              <tr>
                <th className="text-left font-medium px-4 py-3">Nome</th>
                <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">E-mail pessoal</th>
                <th className="text-left font-medium px-4 py-3 hidden xl:table-cell">Papéis / Setores</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
                <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Criado em</th>
                <th className="text-right font-medium px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 6 }).map((_, r) => (
                <tr key={`sk-${r}`} className="border-t border-[var(--border)]">
                  {Array.from({ length: 6 }).map((_, c) => (
                    <td key={c} className="px-4 py-3"><Skeleton className="h-3.5 w-full" /></td>
                  ))}
                </tr>
              ))}
              {!loading && visibleRows.map((f) => (
                <tr key={f.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserIcon className="size-4 text-muted-foreground" />
                      <span className="font-medium">{f.nome || "—"}</span>
                    </div>
                    <div className="lg:hidden text-xs text-muted-foreground mt-0.5">{f.emailPessoal || "—"}</div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">{f.emailPessoal || "—"}</td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-background px-2 py-0.5 text-xs">
                        <BadgeCheck className="size-3" /> {f.papel}
                      </span>
                      {f.setores.map((s) => (
                        <span key={s} className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-background px-2 py-0.5 text-xs">
                          <Building2 className="size-3" /> {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {new Date(f.criadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`${FUNC_DETAIL_PREFIX}/${encodeURIComponent(f.id)}`} className="h-9 px-3 rounded-md hover:bg-[var(--muted)]">Ver</Link>
                  </td>
                </tr>
              ))}
              {!loading && visibleRows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  {error ? "Falha ao carregar dados." : "Nenhum funcionário encontrado com os filtros atuais."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-3 text-xs text-muted-foreground border-t border-[var(--border)]">
          <div>
            {paginationSummary(collection?.page, visibleRows.length)}
            {" · "}Página {page + 1} de {Math.max(totalPages, 1)}
          </div>
          <div className="inline-flex items-center gap-1">
            <button type="button" className={cx("h-8 px-2 rounded-md", prevEnabled ? "hover:bg-[var(--muted)]" : "opacity-50 cursor-not-allowed")}
              disabled={!prevEnabled || loading} onClick={() => void movePage("prev")}>Anterior</button>
            <button type="button" className={cx("h-8 px-2 rounded-md", nextEnabled ? "hover:bg-[var(--muted)]" : "opacity-50 cursor-not-allowed")}
              disabled={!nextEnabled || loading} onClick={() => void movePage("next")}>Próximo</button>
          </div>
        </div>
      </div>
    </div>
  );
}
