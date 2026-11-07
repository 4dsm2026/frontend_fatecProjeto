"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "../../../../../utils/api";
import { hasLink } from "../../../../../utils/hal";
import type { HalResource } from "../../../../../utils/hal";
import SugestaoDetalheLayout from "../../../../components/shared/SugestaoDetalheLayout";
import FormRespostaSugestao from "../../_components/FormRespostaSugestao";
import type { SugestaoEditorValor } from "../../../../components/shared/SugestaoEditor";
import type { JSONContent } from "@tiptap/react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

type StatusSugestao = "NAO_RESPONDIDO" | "RESPONDIDO";

type SugestaoDetalhe = HalResource & {
  id: string;
  conteudo: string;
  emailContato: string;
  status: StatusSugestao;
  resposta: string | null;
  respostaDocumento: JSONContent | null;
  criadoEm: string;
  usuario?: { nome?: string | null; ra?: string | null } | null;
};

export default function DetalheSugestaoAdminPage() {
  const params = useParams();
  const id = params?.id as string;

  const [sugestao, setSugestao] = useState<SugestaoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [resposta, setResposta] = useState("");
  const [respostaDocumento, setRespostaDocumento] = useState<JSONContent | null>(null);

  const load = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);

      const res = await apiFetch(`${API}/suggestions/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        setErro(
          res.status === 404
            ? "Sugestão não encontrada."
            : "Não foi possível carregar a sugestão.",
        );
        return;
      }

      const data: SugestaoDetalhe = await res.json();
      setSugestao(data);
      setResposta(data.resposta ?? "");
      setRespostaDocumento(data.respostaDocumento ?? null);
    } catch {
      setErro("Não foi possível carregar a sugestão.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const statusFinal = sugestao?.status === "RESPONDIDO";
  const respostaJaSalva = !!sugestao?.resposta;
  const respostaBloqueada = !hasLink(sugestao, "answer");
  const statusBloqueado = !hasLink(sugestao, "answer");

  return (
    <SugestaoDetalheLayout
      voltarHref="/admin/sugestoes"
      loading={loading}
      erro={erro}
      sugestao={sugestao}
      identificacao={
        sugestao && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {sugestao.usuario?.nome ?? "Aluno"}
            {sugestao.usuario?.ra ? ` · R.A. ${sugestao.usuario.ra}` : ""}
            {sugestao.emailContato ? ` · ${sugestao.emailContato}` : ""}
          </div>
        )
      }
    >
      <FormRespostaSugestao
        sugestao={sugestao}
        resposta={resposta}
        respostaDocumento={respostaDocumento}
        onRespostaChange={(valor: SugestaoEditorValor) => {
          setResposta(valor.texto);
          setRespostaDocumento(valor.documento);
        }}
        status={sugestao?.status ?? "NAO_RESPONDIDO"}
        respostaBloqueada={respostaBloqueada}
        statusBloqueado={statusBloqueado}
        statusFinal={statusFinal}
        respostaJaSalva={respostaJaSalva}
        onSaved={load}
      />
    </SugestaoDetalheLayout>
  );
}
