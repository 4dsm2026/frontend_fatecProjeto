import {
  MODALIDADE_LABEL,
  TIPO_PEDIDO_LABEL,
  formatarCep,
  formatarConclusao,
  formatarCpf,
  type PasseDetalhe,
} from "../../../utils/passe-escolar";

/** Os dados do pedido, como a secretaria os lança no portal. */
export default function PasseEscolarDados({ passe }: Readonly<{ passe: PasseDetalhe }>) {
  const linhas: [string, string][] = [
    ["Ano de referência", String(passe.anoReferencia)],
    ["Tipo", TIPO_PEDIDO_LABEL[passe.tipo]],
    ["Modalidade", MODALIDADE_LABEL[passe.modalidade]],
    ["Nome completo", passe.nomeCompleto],
    ["RG", passe.rg],
    ["CPF", formatarCpf(passe.cpf)],
    ["CEP", formatarCep(passe.cep)],
    ["Município de residência", passe.municipioResidencia],
    ["Curso", passe.curso],
    ["Período", passe.periodo],
    ["Conclusão prevista", formatarConclusao(passe.mesConclusao, passe.anoConclusao)],
    ["Renda familiar per capita até 1,5 salário mínimo", passe.declaraBaixaRenda ? "Sim, declarado" : "Não"],
  ];
  if (passe.protocoloEmtu) linhas.push(["Nº do formulário na EMTU", passe.protocoloEmtu]);
  if (passe.observacaoAluno) linhas.push(["Observação do aluno", passe.observacaoAluno]);

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
      {linhas.map(([rotulo, valor]) => (
        <div key={rotulo} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{rotulo}</dt>
          <dd className="font-medium break-words">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}
