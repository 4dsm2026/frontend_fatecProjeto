"use client";

import { useEffect, useState } from "react";
import { AtSign, Plus, User as UserIcon, X } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, apiFetch, extractApiError } from "../../../../../utils/api";
import {
  NIVEIS,
  NIVEL_AJUDA,
  NIVEL_LABEL,
  contatosParaApi,
  emailValido,
  rotuloContato,
  type Contato,
  type Hierarquia,
  type Nivel,
  type SetorRef,
  type UsuarioContato,
} from "../../../../../utils/roteamento";
import Button from "../../../../components/ui/Button";
import Card from "../../../../components/ui/Card";
import { INPUT } from "./RegrasRoteamento";

type Props = { setores: SetorRef[]; equipe: UsuarioContato[] };

/** Hierarquia de e-mails de um setor: prazo de escalonamento e contatos por nível. */
export default function HierarquiaSetor({ setores, equipe }: Readonly<Props>) {
  const [setorId, setSetorId] = useState("");
  const [hierarquia, setHierarquia] = useState<Hierarquia | null>(null);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [prazo, setPrazo] = useState("");
  const [alterado, setAlterado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [nivel, setNivel] = useState<Nivel>("PRIMEIRO");
  const [tipo, setTipo] = useState<"usuario" | "email">("usuario");
  const [usuarioId, setUsuarioId] = useState("");
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");

  useEffect(() => {
    if (!setorId && setores.length) setSetorId(setores[0].id);
  }, [setores, setorId]);

  useEffect(() => {
    if (!setorId) return;
    let vivo = true;
    setHierarquia(null);
    apiFetch(`${API_BASE}/admin/sectors/${encodeURIComponent(setorId)}/routing`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(await extractApiError(r, "Não foi possível carregar a hierarquia."));
        return (await r.json()) as Hierarquia;
      })
      .then((h) => {
        if (!vivo) return;
        setHierarquia(h);
        setContatos(h.contatos);
        setPrazo(h.prazoEscalonamentoHoras == null ? "" : String(h.prazoEscalonamentoHoras));
        setAlterado(false);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Não foi possível carregar a hierarquia."));
    return () => {
      vivo = false;
    };
  }, [setorId]);

  function trocarSetor(id: string) {
    if (alterado && !globalThis.confirm("Há alterações não salvas neste setor. Descartar?")) return;
    setSetorId(id);
  }

  function adicionar() {
    if (tipo === "usuario") {
      const u = equipe.find((x) => x.id === usuarioId);
      if (!u) return void toast.error("Escolha um funcionário.");
      if (contatos.some((c) => c.nivel === nivel && c.usuarioId === u.id)) return void toast.info(`${u.nome} já está em ${NIVEL_LABEL[nivel]}.`);
      setContatos((cs) => [...cs, { nivel, usuarioId: u.id, email: null, nome: null, usuario: u }]);
      setUsuarioId("");
    } else {
      const e = email.trim().toLowerCase();
      if (!emailValido(e)) return void toast.error("Informe um e-mail válido.");
      if (contatos.some((c) => c.nivel === nivel && c.email === e)) return void toast.info(`${e} já está em ${NIVEL_LABEL[nivel]}.`);
      setContatos((cs) => [...cs, { nivel, usuarioId: null, email: e, nome: nome.trim() || null }]);
      setEmail("");
      setNome("");
    }
    setAlterado(true);
  }

  function remover(alvo: Contato) {
    setContatos((cs) => cs.filter((c) => c !== alvo));
    setAlterado(true);
  }

  async function salvar() {
    const horas = prazo.trim() === "" ? null : Number(prazo);
    if (horas !== null && (!Number.isInteger(horas) || horas < 1 || horas > 720)) {
      toast.error("O prazo é um número inteiro de horas entre 1 e 720 (ou vazio para não escalonar).");
      return;
    }
    try {
      setSalvando(true);
      const r = await apiFetch(`${API_BASE}/admin/sectors/${encodeURIComponent(setorId)}/routing`, {
        method: "PUT",
        body: JSON.stringify({ prazoEscalonamentoHoras: horas, contatos: contatosParaApi(contatos) }),
      });
      if (!r.ok) throw new Error(await extractApiError(r, "Não foi possível salvar a hierarquia."));
      const h = (await r.json()) as Hierarquia;
      setHierarquia(h);
      setContatos(h.contatos);
      setAlterado(false);
      toast.success(`Hierarquia de ${h.nome} salva.`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a hierarquia.");
    } finally {
      setSalvando(false);
    }
  }

  const semSegundo = prazo.trim() !== "" && !contatos.some((c) => c.nivel === "SEGUNDO");

  return (
    <Card>
      <div className="mb-3">
        <h2 className="font-grotesk text-lg font-semibold">Hierarquia de e-mails por setor</h2>
        <p className="text-sm text-muted-foreground">
          Funcionários recebem no sistema e por e-mail; e-mails avulsos (ex.: zeladoria@…) recebem só o e-mail.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Setor</span>
          <select className={INPUT} value={setorId} onChange={(e) => trocarSetor(e.target.value)}>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Prazo para escalonar (horas úteis)</span>
          <input
            className={INPUT}
            type="number"
            min={1}
            max={720}
            placeholder="Não escalona"
            value={prazo}
            onChange={(e) => {
              setPrazo(e.target.value);
              setAlterado(true);
            }}
          />
        </label>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Conta de segunda a sexta. Se o chamado continuar Aberto e sem responsável depois do prazo, o 2º nível é avisado uma vez.
      </p>

      {hierarquia === null ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {NIVEIS.map((n) => {
              const doNivel = contatos.filter((c) => c.nivel === n);
              return (
                <section key={n} aria-label={NIVEL_LABEL[n]} className="rounded-lg border border-[var(--border)] p-3">
                  <h3 className="text-sm font-semibold">{NIVEL_LABEL[n]}</h3>
                  <p className="mb-2 text-xs text-muted-foreground">{NIVEL_AJUDA[n]}</p>
                  {doNivel.length === 0 ? (
                    <p className="text-xs italic text-muted-foreground">Ninguém.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {doNivel.map((c) => {
                        const r = rotuloContato(c);
                        return (
                          <li key={c.id ?? `${c.nivel}-${c.usuarioId ?? c.email}`} className="flex items-center gap-2 rounded-md bg-[var(--muted)]/50 px-2 py-1.5 text-sm">
                            {r.avulso ? <AtSign className="size-3.5 shrink-0" aria-hidden /> : <UserIcon className="size-3.5 shrink-0" aria-hidden />}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{r.nome}</span>
                              <span className="block truncate text-xs text-muted-foreground">{r.email}</span>
                            </span>
                            <button type="button" className="rounded p-0.5 hover:bg-[var(--muted)]" aria-label={`Remover ${r.nome} de ${NIVEL_LABEL[n]}`} onClick={() => remover(c)}>
                              <X className="size-3.5" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>

          <div className="mt-4 grid gap-2 rounded-lg border border-dashed border-[var(--border)] p-3 sm:grid-cols-[140px_150px_1fr_auto] sm:items-end">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Nível</span>
              <select className={INPUT} value={nivel} onChange={(e) => setNivel(e.target.value as Nivel)}>
                {NIVEIS.map((n) => (
                  <option key={n} value={n}>
                    {NIVEL_LABEL[n]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Tipo</span>
              <select className={INPUT} value={tipo} onChange={(e) => setTipo(e.target.value as "usuario" | "email")}>
                <option value="usuario">Funcionário</option>
                <option value="email">E-mail avulso</option>
              </select>
            </label>
            {tipo === "usuario" ? (
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Funcionário</span>
                <select className={INPUT} value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
                  <option value="">Escolha…</option>
                  {equipe.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome} — {u.emailEducacional || u.emailPessoal}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">E-mail</span>
                  <input className={INPUT} type="email" placeholder="zeladoria@fatec.sp.gov.br" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Nome (opcional)</span>
                  <input className={INPUT} placeholder="Zeladoria" maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} />
                </label>
              </div>
            )}
            <Button type="button" variant="secondary" icon={<Plus className="size-4" />} onClick={adicionar}>
              Adicionar
            </Button>
          </div>

          {semSegundo && (
            <p className="mt-2 text-xs text-[var(--warning)]">Há prazo, mas ninguém no 2º nível: o escalonamento não vai avisar ninguém.</p>
          )}

          <div className="mt-4 flex items-center justify-end gap-3">
            {alterado && <span className="text-xs text-muted-foreground">Alterações não salvas</span>}
            <Button onClick={salvar} loading={salvando} disabled={!alterado}>
              Salvar hierarquia
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
