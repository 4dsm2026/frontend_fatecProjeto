"use client";

import { type ChangeEvent, useEffect, useRef } from "react";
import {
  EditorContent,
  useEditor,
  type JSONContent,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { toast } from "sonner";

export type SugestaoEditorValor = {
  texto: string;
  documento: JSONContent;
};

type Props = Readonly<{
  disabled?: boolean;
  onChange: (valor: SugestaoEditorValor) => void;
}>;

const MAX_IMAGENS = 3;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
const TIPOS_PERMITIDOS = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function contarImagens(doc?: JSONContent): number {
  return (doc?.content ?? []).filter((no) => no.type === "image").length;
}

function lerArquivoComoDataUrl(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      if (typeof leitor.result === "string") {
        resolve(leitor.result);
      } else {
        reject(new Error("Falha ao ler a imagem."));
      }
    };
    leitor.onerror = () => reject(new Error("Falha ao ler a imagem."));
    leitor.readAsDataURL(arquivo);
  });
}

export default function SugestaoEditor({
  disabled = false,
  onChange,
}: Props) {
  const inputArquivoRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        link: false,
        orderedList: false,
        strike: false,
        underline: false,
      }),
      Image.configure({
        allowBase64: true,
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Texto da sugestão",
        "aria-multiline": "true",
        class:
          "min-h-40 px-3 py-2 text-sm outline-none " +
          "whitespace-pre-wrap break-words " +
          "[&_p]:mb-2 [&_strong]:font-bold [&_em]:italic " +
          "[&_img]:my-2 [&_img]:max-h-64 [&_img]:rounded-md",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange({
        texto: currentEditor.getText(),
        documento: currentEditor.getJSON(),
      });
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  async function handleSelecionarImagem(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";

    if (!arquivo || !editor) return;

    if (!TIPOS_PERMITIDOS.has(arquivo.type)) {
      toast.error("Envie uma imagem PNG, JPEG, WEBP ou GIF.");
      return;
    }

    if (arquivo.size > MAX_IMAGE_BYTES) {
      toast.error("A imagem deve ter no máximo 2 MB.");
      return;
    }

    if (contarImagens(editor.getJSON()) >= MAX_IMAGENS) {
      toast.error(`Você pode adicionar no máximo ${MAX_IMAGENS} imagens.`);
      return;
    }

    try {
           const src = await lerArquivoComoDataUrl(arquivo);

      if (editor.isDestroyed || !editor.isEditable) return;

      if (contarImagens(editor.getJSON()) >= MAX_IMAGENS) {
        toast.error(`Você pode adicionar no máximo ${MAX_IMAGENS} imagens.`);
        return;
      }

      const posicao = editor.state.selection.to;

      editor
        .chain()
        .focus()
        .insertContentAt(
          posicao,
          [
            {
              type: "image",
              attrs: { src, alt: arquivo.name },
            },
            {
              type: "paragraph",
            },
          ],
          { updateSelection: true },
        )
        .run();
    } catch {
      toast.error("Não foi possível carregar a imagem selecionada.");
    }
  }

  const buttonClass =
    "rounded-md border border-[var(--border)] px-3 py-1 text-sm " +
    "hover:bg-[var(--muted)] disabled:cursor-not-allowed " +
    "disabled:opacity-50 focus-visible:outline " +
    "focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-input">
      <div
        role="group"
        aria-label="Formatação da sugestão"
        className="flex flex-wrap gap-2 border-b border-[var(--border)] p-2"
      >
        <button
          type="button"
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={buttonClass}
        >
          Negrito
        </button>

        <button
          type="button"
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={buttonClass}
        >
          Itálico
        </button>

        <button
          type="button"
          disabled={disabled || !editor}
          onClick={() => inputArquivoRef.current?.click()}
          className={buttonClass}
        >
          Adicionar imagem
        </button>

        <input
          ref={inputArquivoRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleSelecionarImagem}
          className="hidden"
          aria-label="Selecionar imagem da sugestão"
        />
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}