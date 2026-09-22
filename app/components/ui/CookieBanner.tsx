"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";

type Consent = "accepted" | "essential" | null;

const STORAGE_KEY = "cookie_consent";

function injectClarity() {
  if (typeof window === "undefined" || (window as unknown as Record<string, unknown>)["clarity"]) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.clarity.ms/tag/ueh2hk6os4";
  document.head.appendChild(script);
  // @ts-expect-error — Clarity global bootstrap
  window.clarity = window.clarity || function (...args: unknown[]) {
    // @ts-expect-error — Clarity queue init
    if (!window.clarity.q) window.clarity.q = [];
    // @ts-expect-error — Clarity queue push
    window.clarity.q.push(args);
  };
}

export default function CookieBanner() {
  const [consent, setConsent] = useState<Consent | "loading">("loading");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Consent | null;
    setConsent(stored);
    if (stored === "accepted") injectClarity();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (consent === null && !dialog.open) {
      dialog.show();
    }
  }, [consent]);

  function accept() {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setConsent("accepted");
    dialogRef.current?.close();
    injectClarity();
  }

  function essential() {
    localStorage.setItem(STORAGE_KEY, "essential");
    setConsent("essential");
    dialogRef.current?.close();
  }

  if (consent !== null) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-label="Consentimento de cookies"
      className="bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm rounded-xl border border-[var(--border)] bg-card shadow-xl p-4 flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-lg bg-primary/10 grid place-items-center text-primary shrink-0 mt-0.5">
          <Cookie className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Uso de cookies</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Usamos cookies essenciais para o funcionamento do portal e, com seu
            consentimento, cookies analíticos (Microsoft Clarity) para melhorar a
            experiência.{" "}
            <Link href="/privacidade" className="text-[var(--brand-cyan)] hover:underline">
              Saiba mais
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={essential}
          className="h-8 px-3 rounded-lg border border-[var(--border)] text-xs font-medium text-muted-foreground hover:bg-[var(--muted)] transition"
        >
          Somente essenciais
        </button>
        <button
          onClick={accept}
          className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition"
        >
          Aceitar todos
        </button>
      </div>
    </dialog>
  );
}
