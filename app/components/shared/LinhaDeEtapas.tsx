import { Check, X } from "lucide-react";
import { cx } from "../../../utils/cx";

export type Etapa = Readonly<{
  chave: string;
  titulo: string;
  /** Quem faz a etapa ("Você", "Fatec", "EMTU"…). Opcional. */
  quem?: string;
}>;

/**
 * - `andamento`: a etapa atual está em curso.
 * - `pendente`: a etapa atual espera uma ação de quem está lendo (bolinha amarela).
 * - `concluido`: todas as etapas feitas.
 * - `falhou`: o processo parou na etapa atual (recusado, cancelado).
 */
export type EstadoEtapas = "andamento" | "pendente" | "concluido" | "falhou";

type Props = Readonly<{
  etapas: readonly Etapa[];
  /** Índice (base 0) da etapa atual. */
  atual: number;
  estado?: EstadoEtapas;
  /** Texto sob a etapa atual no lugar de `quem` (ex.: "Aguardando você"). */
  legendaAtual?: string;
  "aria-label"?: string;
}>;

/**
 * Linha de etapas com bolinhas: mostra de uma vez o que já aconteceu, onde o
 * processo está e de quem é a próxima ação. Usada no Passe Escolar e no chamado.
 */
export default function LinhaDeEtapas({
  etapas,
  atual,
  estado = "andamento",
  legendaAtual,
  "aria-label": ariaLabel = "Etapas",
}: Props) {
  const tudoFeito = estado === "concluido";

  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={ariaLabel}>
      {etapas.map((etapa, i) => {
        const concluida = tudoFeito || i < atual;
        const corrente = !tudoFeito && i === atual;
        const falhou = estado === "falhou" && corrente;
        const pendente = estado === "pendente" && corrente;
        const legenda = corrente && legendaAtual ? legendaAtual : etapa.quem;

        let circulo = "border-[var(--border)] text-muted-foreground";
        if (concluida) circulo = "border-[var(--success)] bg-[var(--success)] text-white";
        else if (falhou) circulo = "border-[var(--destructive)] bg-[var(--destructive)] text-white";
        else if (pendente) circulo = "border-[var(--warning)] bg-[var(--warning)]/15 text-[var(--warning)]";
        else if (corrente) circulo = "border-primary bg-primary/10 text-primary";

        return (
          <li key={etapa.chave} className="flex flex-col gap-2" aria-current={corrente ? "step" : undefined}>
            <div className="flex items-center gap-2">
              <span className={cx("inline-grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold", circulo)}>
                {concluida && <Check className="size-4" aria-label="concluída" />}
                {falhou && <X className="size-4" aria-label="encerrada" />}
                {!concluida && !falhou && i + 1}
              </span>
              {i < etapas.length - 1 && (
                <span className={cx("h-0.5 flex-1 rounded", concluida ? "bg-[var(--success)]" : "bg-[var(--border)]")} aria-hidden />
              )}
            </div>
            <div className="min-w-0">
              <div className={cx("text-sm font-medium leading-tight", corrente ? "text-foreground" : "text-muted-foreground")}>
                {etapa.titulo}
              </div>
              {legenda && (
                <div className={cx("text-xs", pendente ? "font-medium text-[var(--warning)]" : "text-muted-foreground")}>{legenda}</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
