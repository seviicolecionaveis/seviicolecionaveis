import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/banners")({
  head: () => ({ meta: [{ title: "Banners — Admin" }] }),
  component: BannersAdmin,
});

type Banner = {
  id: string;
  image_url: string;
  link_url: string | null;
  alt: string | null;
  sort_order: number;
  active: boolean;
};

function BannersAdmin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [alt, setAlt] = useState("");

  useEffect(() => {
    if (!authLoading) {
      if (!user) nav({ to: "/auth" });
      else if (!isAdmin) nav({ to: "/" });
    }
  }, [authLoading, user, isAdmin, nav]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("banners")
      .select("*")
      .order("sort_order", { ascending: true });
    setBanners(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `banners/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("card-images")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("card-images").getPublicUrl(path);
      const nextOrder = (banners[banners.length - 1]?.sort_order ?? 0) + 1;
      const { error: insErr } = await supabase.from("banners").insert({
        image_url: pub.publicUrl,
        link_url: linkUrl.trim() || null,
        alt: alt.trim() || null,
        sort_order: nextOrder,
        active: true,
      });
      if (insErr) throw insErr;
      setLinkUrl("");
      setAlt("");
      await load();
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  const updateField = async (id: string, patch: Partial<Banner>) => {
    await supabase.from("banners").update(patch).eq("id", id);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este banner?")) return;
    await supabase.from("banners").delete().eq("id", id);
    await load();
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = banners.findIndex((b) => b.id === id);
    const swap = banners[idx + dir];
    if (!swap) return;
    await supabase.from("banners").update({ sort_order: swap.sort_order }).eq("id", id);
    await supabase.from("banners").update({ sort_order: banners[idx].sort_order }).eq("id", swap.id);
    await load();
  };

  if (authLoading || !isAdmin) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <Link to="/admin" className="text-sm font-bold uppercase tracking-widest">
            Sevii Colecionáveis · Admin
          </Link>
          <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground">
            ← Pedidos
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Banners da home</h1>

        <section className="rounded-xl border border-border bg-card p-5 mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-widest mb-4">Adicionar banner</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Link ao clicar (opcional)"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Texto alternativo (opcional)"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <label className="mt-4 inline-block">
            <span className={`inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground cursor-pointer ${uploading ? "opacity-50" : ""}`}>
              {uploading ? "Enviando..." : "Selecionar imagem"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
            />
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            Recomendado: imagem horizontal (proporção 16:5), até 2MB.
          </p>
        </section>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : banners.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum banner cadastrado.</p>
        ) : (
          <ul className="space-y-3">
            {banners.map((b, i) => (
              <li key={b.id} className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-4">
                <img src={b.image_url} alt="" className="h-20 w-40 object-cover rounded-md bg-secondary" />
                <div className="flex-1 min-w-[200px] space-y-2">
                  <input
                    type="text"
                    defaultValue={b.link_url ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (b.link_url ?? "")) updateField(b.id, { link_url: v || null });
                    }}
                    placeholder="Link"
                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                  />
                  <input
                    type="text"
                    defaultValue={b.alt ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (b.alt ?? "")) updateField(b.id, { alt: v || null });
                    }}
                    placeholder="Texto alternativo"
                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={b.active}
                    onChange={(e) => updateField(b.id, { active: e.target.checked })}
                  />
                  Ativo
                </label>
                <div className="flex gap-1">
                  <button
                    onClick={() => move(b.id, -1)}
                    disabled={i === 0}
                    className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => move(b.id, 1)}
                    disabled={i === banners.length - 1}
                    className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
                <button
                  onClick={() => remove(b.id)}
                  className="rounded-md border border-destructive/40 text-destructive px-3 py-1 text-xs font-semibold"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
