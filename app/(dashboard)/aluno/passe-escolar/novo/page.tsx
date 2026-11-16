"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, apiFetch, extractApiError } from "../../../../../utils/api";
import { getCurrentUser } from "../../../../../utils/current-user";
import { corpoDoFormulario, formularioVazio, type PasseFormulario } from "../../../../../utils/passe-escolar";
import BetaBadge from "../../../../components/shared/BetaBadge";
import Card from "../../../../components/ui/Card";
import FormPasseEscolar from "../_components/FormPasseEscolar";

export default function NovoPasseEscolarPage() {
  const router = useRouter();
  const [inicial, setInicial] = useState<PasseFormulario | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Pré-preenche com o que já sabemos do aluno; ele confere e completa.
  useEffect(() => {
    let ativo = true;
    getCurrentUser<{ nome?: string | null; curso?: string | null; turno?: string | null }>()
      .then((u) => {
        if (!ativo) return;
        setInicial({ ...formularioVazio(), nomeCompleto: u.nome ?? "", curso: u.curso ?? "", periodo: u.turno ?? "" });
      })
      .catch(() => ativo && setInicial(formularioVazio()));
    return () => {
      ativo = false;
    };
  }, []);

  async function enviar(f: PasseFormulario) {
    try {
      setEnviando(true);
      const res = await apiFetch(`${API_BASE}/school-passes`, { method: "POST", body: JSON.stringify(corpoDoFormulario(f)) });
      if (!res.ok) throw new Error(await extractApiError(res, "Não foi possível enviar o pedido."));
      const criado = (await res.json()) as { id: string };
      toast.success("Pedido enviado! A Secretaria foi avisada.");
      router.push(`/aluno/passe-escolar/${criado.id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar o pedido.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/aluno/passe-escolar" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ChevronLeft className="size-4" /> Passe Escolar
        </Link>
        <h1 className="font-grotesk text-2xl font-semibold tracking-tight inline-flex items-center gap-2 mt-1">
          Pedir cadastro no portal da EMTU <BetaBadge />
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          A Secretaria usa estes dados para incluir você no Portal de Relacionamento da ARTESP/EMTU. Só depois disso
          você consegue requisitar o passe no site da EMTU.
        </p>
      </div>

      <Card>
        {inicial ? (
          <FormPasseEscolar valorInicial={inicial} rotuloEnvio="Enviar pedido" enviando={enviando} onSubmit={enviar} onCancel={() => router.push("/aluno/passe-escolar")} />
        ) : (
          <p className="text-sm text-muted-foreground">Carregando seus dados…</p>
        )}
      </Card>
    </div>
  );
}
