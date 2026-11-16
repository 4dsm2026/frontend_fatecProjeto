import { STATUS_LABEL, type HistoricoSolicitacao } from "../../../utils/matricula";
import HistoricoEtapas from "./HistoricoEtapas";

/** Histórico do pedido; `donoId` troca o nome do aluno por "Você" na visão dele. */
export default function MatriculaHistorico({
  historico,
  donoId,
}: Readonly<{ historico: HistoricoSolicitacao[]; donoId?: string }>) {
  return (
    <HistoricoEtapas
      itens={historico.map((h) => ({
        id: h.id,
        titulo: STATUS_LABEL[h.para] ?? h.para,
        comentario: h.comentario,
        criadoEm: h.criadoEm,
        autor: donoId && h.autorId === donoId ? "Você" : h.autor?.nome,
      }))}
    />
  );
}
