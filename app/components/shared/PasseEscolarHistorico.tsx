import { STATUS_PASSE_LABEL, type PasseHistorico } from "../../../utils/passe-escolar";
import HistoricoEtapas from "./HistoricoEtapas";

/** Histórico do Passe Escolar sobre o `HistoricoEtapas` genérico. */
export default function PasseEscolarHistorico({ historico }: Readonly<{ historico: PasseHistorico[] }>) {
  return (
    <HistoricoEtapas
      itens={historico.map((h) => ({
        id: h.id,
        titulo: STATUS_PASSE_LABEL[h.para] ?? h.para,
        comentario: h.comentario,
        criadoEm: h.criadoEm,
        autor: h.autor?.nome,
      }))}
    />
  );
}
