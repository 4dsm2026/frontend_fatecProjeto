"use client";

import { FormEvent, useState } from "react";
import { Loader2, Send } from "lucide-react";
import Alert from "../../../../components/ui/Alert";
import {
  MODALIDADE_LABEL,
  PERIODOS,
  TIPO_PEDIDO_LABEL,
  validarFormulario,
  type PasseFormulario,
} from "../../../../../utils/passe-escolar";

type Erros = Partial<Record<keyof PasseFormulario, string>>;

type Props = Readonly<{
  valorInicial: PasseFormulario;
  /** Texto do botão: "Enviar pedido" ou "Reenviar com correções". */
  rotuloEnvio: string;
  enviando: boolean;
  onSubmit: (f: PasseFormulario) => void | Promise<void>;
  onCancel?: () => void;
}>;

const INPUT =
  "w-full rounded-lg border border-[var(--border)] bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";

function Campo({
  id,
  label,
  erro,
  ajuda,
  children,
}: Readonly<{ id: string; label: string; erro?: string; ajuda?: string; children: React.ReactNode }>) {
  return (
    <div className="space-y-1 text-sm">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {children}
      {erro ? (
        <p className="text-xs text-destructive" role="alert">
          {erro}
        </p>
      ) : (
        ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>
      )}
    </div>
  );
}

/** Formulário do pedido: os dados que a Secretaria lança no portal da EMTU. */
export default function FormPasseEscolar({ valorInicial, rotuloEnvio, enviando, onSubmit, onCancel }: Props) {
  const [f, setF] = useState<PasseFormulario>(valorInicial);
  const [erros, setErros] = useState<Erros>({});

  function set<K extends keyof PasseFormulario>(campo: K, valor: PasseFormulario[K]) {
    setF((atual) => ({ ...atual, [campo]: valor }));
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const encontrados = validarFormulario(f);
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) return;
    await onSubmit(f);
  }

  const anoAtual = new Date().getFullYear();

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">O benefício</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="tipo" label="Tipo de pedido">
            <select id="tipo" className={INPUT} value={f.tipo} onChange={(e) => set("tipo", e.target.value as PasseFormulario["tipo"])}>
              {Object.entries(TIPO_PEDIDO_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="modalidade" label="Modalidade">
            <select
              id="modalidade"
              className={INPUT}
              value={f.modalidade}
              onChange={(e) => set("modalidade", e.target.value as PasseFormulario["modalidade"])}
            >
              {Object.entries(MODALIDADE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        {f.modalidade === "PASSE_LIVRE" && (
          <div className="space-y-1">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                checked={f.declaraBaixaRenda}
                onChange={(e) => set("declaraBaixaRenda", e.target.checked)}
              />
              <span>
                Declaro que a renda familiar <strong>por pessoa</strong> é de até 1,5 salário mínimo. A EMTU vai pedir o
                comprovante de renda no envio dos documentos.
              </span>
            </label>
            {erros.declaraBaixaRenda && (
              <p className="text-xs text-destructive" role="alert">
                {erros.declaraBaixaRenda}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Seus dados, como estão no RG</h2>
        <Alert variant="info">
          Estes dados vão para o Portal de Relacionamento da ARTESP/EMTU exatamente como você digitar. Um dígito errado
          no CPF ou no CEP trava a sua requisição lá.
        </Alert>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Campo id="nomeCompleto" label="Nome completo" erro={erros.nomeCompleto}>
              <input id="nomeCompleto" className={INPUT} value={f.nomeCompleto} onChange={(e) => set("nomeCompleto", e.target.value)} autoComplete="name" />
            </Campo>
          </div>
          <Campo id="rg" label="RG" erro={erros.rg} ajuda="Com dígito, se houver. Ex.: 12.345.678-9">
            <input id="rg" className={INPUT} value={f.rg} onChange={(e) => set("rg", e.target.value)} inputMode="text" />
          </Campo>
          <Campo id="cpf" label="CPF" erro={erros.cpf}>
            <input id="cpf" className={INPUT} value={f.cpf} onChange={(e) => set("cpf", e.target.value)} inputMode="numeric" placeholder="000.000.000-00" />
          </Campo>
          <Campo id="cep" label="CEP da sua residência" erro={erros.cep} ajuda="O passe vale só para quem mora em outro município que o da Fatec.">
            <input id="cep" className={INPUT} value={f.cep} onChange={(e) => set("cep", e.target.value)} inputMode="numeric" placeholder="00000-000" autoComplete="postal-code" />
          </Campo>
          <Campo id="municipioResidencia" label="Município onde mora" erro={erros.municipioResidencia}>
            <input id="municipioResidencia" className={INPUT} value={f.municipioResidencia} onChange={(e) => set("municipioResidencia", e.target.value)} autoComplete="address-level2" />
          </Campo>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Seu curso</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Campo id="curso" label="Curso" erro={erros.curso}>
              <input id="curso" className={INPUT} value={f.curso} onChange={(e) => set("curso", e.target.value)} />
            </Campo>
          </div>
          <Campo id="periodo" label="Período" erro={erros.periodo}>
            <select id="periodo" className={INPUT} value={f.periodo} onChange={(e) => set("periodo", e.target.value)}>
              <option value="">Selecione…</option>
              {PERIODOS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo id="mesConclusao" label="Mês de conclusão" erro={erros.mesConclusao}>
              <select id="mesConclusao" className={INPUT} value={f.mesConclusao} onChange={(e) => set("mesConclusao", e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={String(m)}>
                    {String(m).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="anoConclusao" label="Ano" erro={erros.anoConclusao}>
              <input
                id="anoConclusao"
                className={INPUT}
                type="number"
                min={anoAtual}
                max={anoAtual + 10}
                value={f.anoConclusao}
                onChange={(e) => set("anoConclusao", e.target.value)}
              />
            </Campo>
          </div>
        </div>
        <Campo id="observacaoAluno" label="Observação para a Secretaria (opcional)">
          <textarea
            id="observacaoAluno"
            className={`${INPUT} resize-none`}
            rows={3}
            maxLength={500}
            value={f.observacaoAluno}
            onChange={(e) => set("observacaoAluno", e.target.value)}
          />
        </Campo>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="h-10 rounded-md border border-[var(--border)] px-4 text-sm hover:bg-[var(--muted)]">
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={enviando}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {rotuloEnvio}
        </button>
      </div>
    </form>
  );
}
