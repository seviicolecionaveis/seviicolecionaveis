import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { PopupPreview, PopupPreviewModal } from "@/components/admin/PopupPreview";

export const Route = createFileRoute("/admin/popups")({
  head: () => ({ meta: [{ title: "Admin · Pop-ups" }] }),
  component: PopupsAdminPage,
});

type Popup = {
  id: string;
  title: string;
  body_html: string;
  image_url: string | null;
  link_url: string | null;
  active: boolean;
  show_on_notices: boolean;
  sort_order: number;
  created_at: string;
};

type Draft = {
  id?: string;
  title: string;
  body_html: string;
  image_url: string;
  link_url: string;
  active: boolean;
  show_on_notices: boolean;
};

const EMPTY: Draft = {
  title: "",
  body_html: "<p>Escreva o conteúdo do pop-up aqui.</p>",
  image_url: "",
  link_url: "",
  active: true,
  show_on_notices: false,
};

function PopupsAdminPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const dragId = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("site_popups")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data ?? []) as Popup[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const persistOrder = async (list: Popup[]) => {
    setRows(list);
    await Promise.all(
      list.map((p, i) => supabase.from("site_popups").update({ sort_order: i }).eq("id", p.id)),
    );
  };

  const onDrop = (targetId: string) => {
    const from = rows.findIndex((r) => r.id === dragId.current);
    const to = rows.findIndex((r) => r.id === targetId);
    dragId.current = null;
    if (from < 0 || to < 0 || from === to) return;
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    void persistOrder(next);
  };

  const toggle = async (p: Popup, field: "active" | "show_on_notices") => {
    const value = !p[field];
    setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, [field]: value } : r)));
    const patch =
      field === "active" ? { active: value } : { show_on_notices: value };
    const { error } = await supabase.from("site_popups").update(patch).eq("id", p.id);
    if (error) {
      toast.error(error.message);
      void load();
    }
  };

  const remove = async (p: Popup) => {
    if (!window.confirm(`Excluir o pop-up "${p.title}"?`)) return;
    const { error } = await supabase.from("site_popups").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Pop-up excluído.");
    void load();
  };

  const uploadImage = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error("Imagem acima de 5 MB.");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `popups/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("card-images")
        .upload(path, file, { cacheControl: "31536000", upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("card-images").getPublicUrl(path);
      setDraft((d) => (d ? { ...d, image_url: data.publicUrl } : d));
      toast.success("Imagem enviada.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim()) return toast.error("Informe um título.");
    if (draft.link_url.trim() && !/^(https?:\/\/|\/)/.test(draft.link_url.trim()))
      return toast.error("O link deve começar com http://, https:// ou /");
    setSaving(true);
    const payload = {
      title: draft.title.trim(),
      body_html: draft.body_html,
      image_url: draft.image_url.trim() || null,
      link_url: draft.link_url.trim() || null,
      active: draft.active,
      show_on_notices: draft.show_on_notices,
    };
    const res = draft.id
      ? await supabase.from("site_popups").update(payload).eq("id", draft.id)
      : await supabase
          .from("site_popups")
          .insert({ ...payload, sort_order: rows.length });
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(draft.id ? "Pop-up atualizado." : "Pop-up criado.");
    setDraft(null);
    void load();
  };

  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Link to="/admin" search={{}} className="text-sm font-bold uppercase tracking-widest">
            Sevii Colecionáveis · Admin
          </Link>
          <Link to="/admin" search={{}} className="text-xs text-muted-foreground hover:text-foreground">
            ← Pedidos
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Pop-ups do site</h1>
            <p className="text-xs text-muted-foreground">
              Arraste para reordenar — os ativos aparecem nessa ordem para o visitante.
            </p>
          </div>
          <button
            onClick={() => setDraft({ ...EMPTY })}
            className="rounded-md bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90"
          >
            + Novo pop-up
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum pop-up cadastrado ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((p) => (
              <li
                key={p.id}
                draggable
                onDragStart={() => (dragId.current = p.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(p.id)}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                <span className="cursor-grab select-none px-1 text-muted-foreground" title="Arrastar">
                  ⠿
                </span>
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="h-14 w-14 rounded-md object-cover" />
                ) : (
                  <div className="grid h-14 w-14 place-items-center rounded-md bg-secondary text-[10px] text-muted-foreground">
                    sem img
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {p.link_url ?? "sem link"}
                  </p>
                </div>
                <label className="flex items-center gap-1 text-[11px]">
                  <input type="checkbox" checked={p.active} onChange={() => toggle(p, "active")} />
                  Ativo
                </label>
                <label className="flex items-center gap-1 text-[11px]">
                  <input
                    type="checkbox"
                    checked={p.show_on_notices}
                    onChange={() => toggle(p, "show_on_notices")}
                  />
                  Em /avisos
                </label>
                <button
                  onClick={() =>
                    setDraft({
                      id: p.id,
                      title: p.title,
                      body_html: p.body_html || "",
                      image_url: p.image_url ?? "",
                      link_url: p.link_url ?? "",
                      active: p.active,
                      show_on_notices: p.show_on_notices,
                    })
                  }
                  className="rounded-md border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-secondary"
                >
                  Editar
                </button>
                <button
                  onClick={() => remove(p)}
                  className="rounded-md border border-border px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                >
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
          <div className="my-8 w-full max-w-2xl rounded-xl bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {draft.id ? "Editar pop-up" : "Novo pop-up"}
              </h2>
              <button
                onClick={() => setDraft(null)}
                className="text-xs text-muted-foreground hover:underline"
              >
                Fechar ✕
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-xs">
                <span className="mb-1 block font-semibold">Título *</span>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  maxLength={200}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Ex: Pré-venda Parceiro Inicial Série 3"
                />
              </label>

              <div className="text-xs">
                <span className="mb-1 block font-semibold">
                  Conteúdo{" "}
                  <span className="font-normal text-muted-foreground">
                    — mesmas ferramentas do compositor de e-mails
                  </span>
                </span>
                <RichTextEditor
                  value={draft.body_html}
                  onChange={(html) => setDraft((d) => (d ? { ...d, body_html: html } : d))}
                />
              </div>

              <div className="text-xs">
                <span className="mb-1 block font-semibold">Imagem do pop-up (opcional)</span>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={draft.image_url}
                    onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                    className="min-w-[220px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                    placeholder="https://..."
                  />
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadImage(f);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="rounded-md border border-border px-3 py-2 text-[11px] font-semibold hover:bg-secondary disabled:opacity-50"
                  >
                    {uploading ? "Enviando..." : "Enviar arquivo"}
                  </button>
                </div>
                {draft.image_url && (
                  <img
                    src={draft.image_url}
                    alt=""
                    className="mt-2 max-h-48 rounded-md border border-border object-contain"
                  />
                )}
              </div>

              <label className="block text-xs">
                <span className="mb-1 block font-semibold">
                  Link ao clicar na imagem (opcional)
                </span>
                <input
                  value={draft.link_url}
                  onChange={(e) => setDraft({ ...draft, link_url: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="/pre-venda/pi-serie-3 ou https://..."
                />
              </label>

              <div className="flex flex-wrap gap-4 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.active}
                    onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                  />
                  Ativo (exibir no site)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.show_on_notices}
                    onChange={(e) => setDraft({ ...draft, show_on_notices: e.target.checked })}
                  />
                  Publicar também na página de Avisos
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setDraft(null)}
                  className="rounded-md border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary"
                >
                  Cancelar
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-md bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
