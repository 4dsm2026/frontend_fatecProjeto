"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Button from "./Button";

type Variant = "default" | "danger";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  /** Modo prompt: quando definido, mostra um input e passa o valor ao onConfirm. */
  input?: {
    label?: string;
    placeholder?: string;
    defaultValue?: string;
    required?: boolean;
  };
  /** Pode ser async; enquanto resolve, o botão mostra loading. Lançar erro mantém o modal aberto. */
  onConfirm: (value?: string) => void | Promise<void>;
  onClose: () => void;
};

/**
 * Modal de confirmação reutilizável — substitui window.confirm/prompt nativos.
 * Usa <dialog> nativo para acessibilidade (focus trap, Escape, backdrop, inert).
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  input,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [value, setValue] = useState(input?.defaultValue ?? "");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sincroniza abertura/fechamento com o <dialog> nativo.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Reinicia o valor e foca o input a cada abertura (modo prompt).
  useEffect(() => {
    if (!open) return;
    setValue(input?.defaultValue ?? "");
    if (input) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open, input?.defaultValue]);

  // Fecha no cancel (Escape nativo do <dialog>).
  function handleCancel(e: React.SyntheticEvent<HTMLDialogElement>) {
    e.preventDefault();
    if (!loading) onClose();
  }

  const invalid = !!input?.required && value.trim().length === 0;

  async function handleConfirm() {
    if (invalid || loading) return;
    setLoading(true);
    try {
      await onConfirm(input ? value.trim() : undefined);
      onClose();
    } catch {
      setLoading(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      onCancel={handleCancel}
      className="w-[92%] max-w-md rounded-2xl border border-[var(--border)] bg-background p-5 shadow-xl backdrop:bg-black/40 backdrop:motion-safe:animate-[cd-fadeIn_120ms_ease-out] motion-safe:animate-[cd-popIn_140ms_ease-out] open:block"
    >
      <div className="flex items-start gap-3">
        {variant === "danger" && (
          <span className="mt-0.5 inline-grid size-9 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-grotesk text-lg font-semibold leading-tight">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>

      {input && (
        <div className="mt-4">
          {input.label && (
            <label htmlFor="confirm-prompt-input" className="mb-1 block text-sm text-muted-foreground">{input.label}</label>
          )}
          <input
            id="confirm-prompt-input"
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={input.placeholder}
            onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
            className="w-full h-10 rounded-lg border border-[var(--border)] bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === "danger" ? "destructive" : "primary"}
          onClick={handleConfirm}
          loading={loading}
          disabled={invalid}
          autoFocus={!input}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
