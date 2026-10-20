"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold, Italic, Underline, Heading2, List, ListOrdered, Link2, Unlink, Undo2, Redo2, Eye, PencilLine,
} from "lucide-react";
import { toast } from "sonner";
import { cx } from "../../../../utils/cx";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";

type Props = Readonly<{
  /** HTML do corpo do modelo. */
  value: string;
  onChange: (html: string) => void;
  /** Variáveis que podem ser inseridas, sem as chaves (ex.: "aluno.nome"). */
  variaveis: string[];
  /** Troca as variáveis por dados de exemplo, para a visualização. */
  aplicarExemplo: (html: string) => string;
}>;

const classeBotao =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs text-muted-foreground transition " +
  "hover:bg-[var(--muted)] disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)]";

const classeConteudo =
  "min-h-[220px] px-3 py-2 text-sm leading-relaxed outline-none break-words " +
  "[&_p]:mb-2 [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 " +
  "[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:my-1 [&_a]:text-blue-700 [&_a]:underline";

/**
 * Editor visual (WYSIWYG) do corpo dos modelos de e-mail.
 * Salva HTML simples (parágrafos, negrito, listas, links), compatível com clientes de e-mail.
 */
export default function ModeloEmailEditor({ value, onChange, variaveis, aplicarExemplo }: Props) {
  const [verExemplo, setVerExemplo] = useState(false);
  const [linkAberto, setLinkAberto] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2] },
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        link: { openOnClick: false, protocols: ["mailto"], HTMLAttributes: { rel: "noopener noreferrer nofollow" } },
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Corpo do comunicado",
        "aria-multiline": "true",
        class: classeConteudo,
      },
    },
    onUpdate: ({ editor: atual }) => onChange(atual.getHTML()),
  });

  // Troca de modelo: carrega o novo corpo sem marcar como alterado.
  useEffect(() => {
    if (editor && !editor.isDestroyed && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  const estado = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive("bold") ?? false,
      italic: e?.isActive("italic") ?? false,
      underline: e?.isActive("underline") ?? false,
      heading: e?.isActive("heading", { level: 2 }) ?? false,
      bullet: e?.isActive("bulletList") ?? false,
      ordered: e?.isActive("orderedList") ?? false,
      link: e?.isActive("link") ?? false,
      podeDesfazer: e?.can().undo() ?? false,
      podeRefazer: e?.can().redo() ?? false,
    }),
  });

  if (!editor) return null;

  // Mesma regra do editor da Caixa de Sugestões: só http, https e mailto.
  function aplicarLink(valor?: string) {
    const texto = (valor ?? "").trim();
    if (!texto) {
      editor!.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    let destino: URL;
    try {
      destino = new URL(texto);
    } catch {
      destino = new URL("invalido:");
    }
    if (!["https:", "http:", "mailto:"].includes(destino.protocol)) {
      toast.error("Informe um endereço completo: https://exemplo.com ou mailto:nome@exemplo.com");
      throw new Error("link inválido"); // mantém o diálogo aberto
    }
    editor!.chain().focus().extendMarkRange("link").setLink({ href: destino.href }).run();
  }

  const botoes = [
    { nome: "Negrito", Icone: Bold, ativo: estado?.bold, executar: () => editor.chain().focus().toggleBold().run() },
    { nome: "Itálico", Icone: Italic, ativo: estado?.italic, executar: () => editor.chain().focus().toggleItalic().run() },
    { nome: "Sublinhado", Icone: Underline, ativo: estado?.underline, executar: () => editor.chain().focus().toggleUnderline().run() },
    { nome: "Título", Icone: Heading2, ativo: estado?.heading, executar: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { nome: "Marcadores", Icone: List, ativo: estado?.bullet, executar: () => editor.chain().focus().toggleBulletList().run() },
    { nome: "Lista numerada", Icone: ListOrdered, ativo: estado?.ordered, executar: () => editor.chain().focus().toggleOrderedList().run() },
    { nome: "Link", Icone: Link2, ativo: estado?.link, executar: () => setLinkAberto(true) },
    { nome: "Remover link", Icone: Unlink, ativo: false, desabilitado: !estado?.link, executar: () => editor.chain().focus().unsetLink().run() },
    { nome: "Desfazer", Icone: Undo2, ativo: false, desabilitado: !estado?.podeDesfazer, executar: () => editor.chain().focus().undo().run() },
    { nome: "Refazer", Icone: Redo2, ativo: false, desabilitado: !estado?.podeRefazer, executar: () => editor.chain().focus().redo().run() },
  ];

  return (
    <div>
      <div className="mt-1 rounded-lg border border-[var(--border)] bg-input focus-within:ring-2 focus-within:ring-[var(--ring)]">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--border)] p-1.5">
          {botoes.map(({ nome, Icone, ativo, desabilitado, executar }) => (
            <button
              key={nome}
              type="button"
              title={nome}
              aria-label={nome}
              aria-pressed={ativo}
              disabled={verExemplo || desabilitado}
              onClick={executar}
              className={cx(classeBotao, ativo && "bg-[var(--muted)] text-foreground")}
            >
              <Icone className="size-4" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setVerExemplo((v) => !v)}
            aria-pressed={verExemplo}
            className={cx(classeBotao, "ml-auto gap-1.5", verExemplo && "bg-[var(--muted)] text-foreground")}
          >
            {verExemplo ? <PencilLine className="size-4" /> : <Eye className="size-4" />}
            {verExemplo ? "Voltar a editar" : "Ver com dados de exemplo"}
          </button>
        </div>

        {verExemplo ? (
          <div
            aria-label="Corpo com dados de exemplo"
            className={classeConteudo}
            // HTML gerado pelo próprio editor (esquema limitado) com dados de exemplo fixos.
            dangerouslySetInnerHTML={{ __html: aplicarExemplo(editor.getHTML()) }}
          />
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>

      <div className="mt-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
          Variáveis disponíveis <span className="normal-case tracking-normal">(clique para inserir)</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {variaveis.map((v) => (
            <button
              key={v}
              type="button"
              disabled={verExemplo}
              onClick={() => editor.chain().focus().insertContent(`{{${v}}}`).run()}
              className="text-xs rounded-md border border-[var(--border)] bg-background px-2 py-0.5 hover:bg-[var(--muted)] disabled:opacity-50"
            >
              {`{{${v}}}`}
            </button>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={linkAberto}
        title="Inserir link"
        description="Deixe em branco para remover o link do texto selecionado."
        confirmLabel="Aplicar"
        input={{
          label: "Endereço",
          placeholder: "https://… ou mailto:…",
          defaultValue: (editor.getAttributes("link").href as string | undefined) ?? "",
        }}
        onConfirm={aplicarLink}
        onClose={() => setLinkAberto(false)}
      />
    </div>
  );
}
