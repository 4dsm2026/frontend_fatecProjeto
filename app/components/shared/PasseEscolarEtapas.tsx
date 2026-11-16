import { ETAPAS, indiceEtapa, type PasseHistorico, type StatusPasse } from "../../../utils/passe-escolar";
import LinhaDeEtapas, { type EstadoEtapas } from "./LinhaDeEtapas";

type Props = Readonly<{
  status: StatusPasse;
  historico?: PasseHistorico[];
  /** "aluno" mostra "Você"; "equipe" mostra "Aluno". */
  pontoDeVista?: "aluno" | "equipe";
}>;

/** As quatro etapas do Passe Escolar sobre a `LinhaDeEtapas` genérica. */
export default function PasseEscolarEtapas({ status, historico = [], pontoDeVista = "aluno" }: Props) {
  let estado: EstadoEtapas = "andamento";
  if (status === "CONCLUIDO") estado = "concluido";
  else if (status === "INDEFERIDO" || status === "CANCELADO") estado = "falhou";
  else if (status === "PENDENTE_ALUNO") estado = "pendente";

  const etapas = ETAPAS.map((e) => ({
    chave: e.status,
    titulo: e.titulo,
    quem: e.quem === "Você" && pontoDeVista === "equipe" ? "Aluno" : e.quem,
  }));

  return <LinhaDeEtapas etapas={etapas} atual={indiceEtapa(status, historico)} estado={estado} aria-label="Etapas do pedido" />;
}
