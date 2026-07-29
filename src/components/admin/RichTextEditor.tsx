import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  value: string;
  onChange: (html: string) => void;
}

const FONT_SIZES = [
  { label: "Título", level: 2 as const },
  { label: "Subtítulo", level: 3 as const },
  { label: "Normal", level: 0 as const },
];

const COLORS = ["#262626", "#dc2626", "#ea580c", "#16a34a", "#2563eb", "#7c3aed", "#db2777", "#6b7280"];

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`min-w-[28px] h-7 px-1.5 rounded text-xs font-semibold border transition-colors ${
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-background border-border hover:bg-secondary"
      } disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function LinkDialog({
  editor,
  onClose,
}: {
  editor: Editor;
  onClose: () => void;
}) {
  const prev = editor.getAttributes("link").href as string | undefined;
  const { from, to, empty } = editor.state.selection;
  const selectedText = empty ? "" : editor.state.doc.textBetween(from, to, " ");
  const [url, setUrl] = useState(prev ?? "https://");
  const [text, setText] = useState(selectedText);

  const apply = () => {
    const href = url.trim();
    if (!/^https?:\/\//.test(href)) {
      alert("URL deve começar com http:// ou https://");
      return;
    }
    if (empty) {
      const label = text.trim() || href;
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: label,
          marks: [{ type: "link", attrs: { href } }],
        })
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-card p-4 shadow-xl space-y-3 border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold">Inserir link</p>
        {empty && (
          <label className="block text-xs">
            <span className="mb-1 block font-semibold">Texto do link</span>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              placeholder="Clique aqui"
            />
          </label>
        )}
        <label className="block text-xs">
          <span className="mb-1 block font-semibold">URL</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            placeholder="https://..."
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          {prev && (
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                onClose();
              }}
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
            >
              Remover
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={apply}
            className="rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RichTextEditor({ value, onChange }: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
    ],
    content: value || "<p></p>",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[220px] rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync external value when it changes and editor exists
  useEffect(() => {
    if (!editor) return;
    if (value && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  const setHeading = useCallback(
    (level: 0 | 2 | 3) => {
      if (!editor) return;
      if (level === 0) editor.chain().focus().setParagraph().run();
      else editor.chain().focus().toggleHeading({ level }).run();
    },
    [editor],
  );

  if (!editor) return null;

  const currentLevel = editor.isActive("heading", { level: 2 })
    ? 2
    : editor.isActive("heading", { level: 3 })
      ? 3
      : 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/40 p-1.5">
        <select
          value={currentLevel}
          onChange={(e) => setHeading(Number(e.target.value) as 0 | 2 | 3)}
          className="h-7 rounded border border-border bg-background px-1 text-xs"
          title="Tamanho da fonte"
        >
          {FONT_SIZES.map((s) => (
            <option key={s.level} value={s.level}>
              {s.label}
            </option>
          ))}
        </select>

        <span className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          title="Negrito"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          title="Itálico"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          title="Sublinhado"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <span className="underline">U</span>
        </ToolbarButton>
        <ToolbarButton
          title="Tachado"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <span className="line-through">S</span>
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          title="Inserir link"
          active={editor.isActive("link")}
          onClick={() => setLinkOpen(true)}
        >
          🔗
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          title="Lista com marcadores"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          •≡
        </ToolbarButton>
        <ToolbarButton
          title="Lista numerada"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          title="Alinhar à esquerda"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          ⬅
        </ToolbarButton>
        <ToolbarButton
          title="Centralizar"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          ⬌
        </ToolbarButton>
        <ToolbarButton
          title="Alinhar à direita"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          ➡
        </ToolbarButton>
        <ToolbarButton
          title="Justificar texto"
          active={editor.isActive({ textAlign: "justify" })}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        >
          ≡
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-border" />

        <div className="relative">
          <ToolbarButton title="Cor do texto" onClick={() => setColorOpen((v) => !v)}>
            A🎨
          </ToolbarButton>
          {colorOpen && (
            <div className="absolute z-20 mt-1 flex gap-1 rounded-md border border-border bg-card p-2 shadow-lg">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().setColor(c).run();
                    setColorOpen(false);
                  }}
                  className="h-5 w-5 rounded border border-border"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().unsetColor().run();
                  setColorOpen(false);
                }}
                className="h-5 rounded border border-border px-1 text-[10px]"
                title="Remover cor"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <span className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          title="Quebra de linha"
          onClick={() => editor.chain().focus().setHardBreak().run()}
        >
          ↵
        </ToolbarButton>
        <ToolbarButton
          title="Novo parágrafo"
          onClick={() => editor.chain().focus().splitBlock().run()}
        >
          ¶
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          title="Limpar formatação"
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
        >
          ⌫T
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />

      {linkOpen && <LinkDialog editor={editor} onClose={() => setLinkOpen(false)} />}
    </div>
  );
}
