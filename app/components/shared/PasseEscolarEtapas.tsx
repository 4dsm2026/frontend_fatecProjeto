import { Check, X } from "lucide-react";
import { cx } from "../../../utils/cx";
import { ETAPAS, indiceEtapa, type PasseHistorico, type StatusPasse } from "../../../utils/passe-escolar";

type Props = Readonly<{
  status: StatusPasse;
  historico?: PasseHistorico[];
  /** "aluno" mostra "Você"; "equipe" mostra "Aluno". */
  pontoDeVista?: "aluno" | "equipe";
}>;

/**
 * Linha das quatro etapas do Passe Escolar, para o aluno ver de uma vez
 * o que já aconteceu, onde o pedido está e de quem é a próxima ação.
 */
export default function PasseEscolarEtapas({ status, historico = [], pontoDeVista = "aluno" }: Props) {
  const atual = indiceEtapa(status, historico);
  const encerradoMal = status === "INDEFERIDO" || status === "CANCELADO";
  const pendente = status === "PENDENTE_ALUNO";

  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Etapas do pedido">
      {ETAPAS.map((etapa, i) => {
        const concluida = !encerradoMal && (i < atual || status === "CONCLUIDO");
        const corrente = i === atual && status !== "CONCLUIDO";
        const falhou = encerradoMal && corrente;
        const quem = etapa.quem === "Você" && pontoDeVista === "equipe" ? "Aluno" : etapa.quem;

        let circulo = "border-[var(--border)] text-muted-foreground";
        if (concluida) circulo = "border-[var(--success)] bg-[var(--success)] text-white";
        else if (falhou) circulo = "border-[var(--destructive)] bg-[var(--destructive)] text-white";
        else if (corrente && pendente) circulo = "border-[var(--warning)] bg-[var(--warning)]/15 text-[var(--warning)]";
        else if (corrente) circulo = "border-primary bg-primary/10 text-primary";

        return (
          <li key={etapa.status} className="flex flex-col gap-2" aria-current={corrente ? "step" : undefined}>
            <div className="flex items-center gap-2">
              <span
                className={cx("inline-grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold", circulo)}
              >
                {concluida && <Check className="size-4" aria-label="concluída" />}
                {falhou && <X className="size-4" aria-label="encerrada" />}
                {!concluida && !falhou && i + 1}
              </span>
              <span className={cx("h-0.5 flex-1 rounded", concluida ? "bg-[var(--success)]" : "bg-[var(--border)]")} aria-hidden />
            </div>
            <div className="min-w-0">
              <div className={cx("text-sm font-medium leading-tight", corrente ? "text-foreground" : "text-muted-foreground")}>
                {etapa.titulo}
              </div>
              <div className="text-xs text-muted-foreground">{quem}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
