import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListPresalePages,
  adminGetPresalePage,
  adminUpsertPresalePage,
  adminTogglePresalePage,
  adminDeletePresalePage,
} from "@/lib/admin-presale.functions";
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown, Upload, X } from "lucide-react";
import RichTextEditor from "@/components/admin/RichTextEditor";

export const Route = createFileRoute("/admin/pre-venda")({
  head: () => ({ meta: [{ title: "Pré-Venda — Admin" }] }),
  component: AdminPresalePage,
});

type PageRow = {
  id: string;
  slug: string;
  title: string;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  presale_products?: { count: number }[];
};

type ProductForm = {
  id?: string;
  name: string;
  description: string;
  image_urls: string[];
  price_cents: number;
  quantity: number;
  language: string;
  release_year: number | "";
  available_from: string;
  whatsapp_button_text: string;
  whatsapp_message_template: string;
};

const emptyProduct = (): ProductForm => ({
  name: "",
  description: "",
  image_urls: [],
  price_cents: 0,
  quantity: 0,
  language: "PT",
  release_year: "",
  available_from: "",
  whatsapp_button_text: "Quero reservar o meu!",
  whatsapp_message_template: 'Olá! Vim do site e gostaria de reservar o meu "[nome do produto]".',
});

function statusBadge(p: PageRow): { label: string; className: string } {
  const now = Date.now();
  const starts = p.starts_at ? new Date(p.starts_at).getTime() : null;
  const ends = p.ends_at ? new Date(p.ends_at).getTime() : null;
  if (!p.is_active) return { label: "Desativada", className: "bg-secondary text-foreground" };
  if (starts && now < starts) return { label: "Agendada", className: "bg-yellow-100 text-yellow-800" };
  if (ends && now >= ends) return { label: "Encerrada", className: "bg-red-100 text-red-800" };
  return { label: "Ativa", className: "bg-green-100 text-green-800" };
}

function toDateTimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDateTimeLocal(s: string): string | null {
  if (!s) return null;
  return new Date(s).toISOString();
}

function AdminPresalePage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) nav({ to: "/auth" });
      else if (!isAdmin) nav({ to: "/" });
    }
  }, [authLoading, user, isAdmin, nav]);

  const load = async () => {
    setLoading(true);
    const res = await adminListPresalePages();
    setPages(res.pages as PageRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (authLoading || !isAdmin) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }

  if (editingId || creating) {
    return (
      <PresalePageEditor
        id={editingId}
        onDone={() => {
          setEditingId(null);
          setCreating(false);
          load();
        }}
        onCancel={() => {
          setEditingId(null);
          setCreating(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground">← Admin</Link>
            <h1 className="text-2xl font-bold mt-1">Pré-Vendas</h1>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-md bg-foreground text-background px-4 py-2 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" /> Nova pré-venda
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : pages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma pré-venda criada.</p>
        ) : (
          <div className="space-y-3">
            {pages.map((p) => {
              const badge = statusBadge(p);
              const count = p.presale_products?.[0]?.count ?? 0;
              return (
                <div key={p.id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{p.title}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      /pre-venda/{p.slug} · {count} {count === 1 ? "produto" : "produtos"}
                      {p.starts_at && ` · Início: ${new Date(p.starts_at).toLocaleString("pt-BR")}`}
                      {p.ends_at && ` · Fim: ${new Date(p.ends_at).toLocaleString("pt-BR")}`}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={p.is_active}
                      onChange={async () => {
                        await adminTogglePresalePage({ data: { id: p.id, is_active: !p.is_active } });
                        load();
                      }}
                      className="h-4 w-4 accent-foreground"
                    />
                    Ativa
                  </label>
                  <button
                    onClick={() => setEditingId(p.id)}
                    className="grid h-9 w-9 place-items-center rounded-md hover:bg-secondary"
                    aria-label="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Excluir "${p.title}"?`)) return;
                      await adminDeletePresalePage({ data: { id: p.id } });
                      load();
                    }}
                    className="grid h-9 w-9 place-items-center rounded-md hover:bg-red-50 text-red-600"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function PresalePageEditor({ id, onDone, onCancel }: { id: string | null; onDone: () => void; onCancel: () => void }) {
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [products, setProducts] = useState<ProductForm[]>([emptyProduct()]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { page, products: prods } = await adminGetPresalePage({ data: { id } });
      if (page) {
        setSlug(page.slug);
        setTitle(page.title);
        setIsActive(page.is_active);
        setStartsAt(toDateTimeLocal(page.starts_at));
        setEndsAt(toDateTimeLocal(page.ends_at));
      }
      setProducts(
        (prods && prods.length > 0
          ? prods.map((p: any) => ({
              id: p.id,
              name: p.name,
              description: p.description ?? "",
              image_urls: Array.isArray(p.image_urls) && p.image_urls.length > 0
                ? p.image_urls
                : (p.image_url ? [p.image_url] : []),
              price_cents: p.price_cents,
              quantity: p.quantity,
              language: p.language ?? "",
              release_year: p.release_year ?? "",
              available_from: p.available_from ?? "",
              whatsapp_button_text: p.whatsapp_button_text,
              whatsapp_message_template: p.whatsapp_message_template,
            }))
          : [emptyProduct()]),
      );
      setLoading(false);
    })();
  }, [id]);

  const updateProduct = (idx: number, patch: Partial<ProductForm>) => {
    setProducts((curr) => curr.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const moveProduct = (idx: number, dir: -1 | 1) => {
    setProducts((curr) => {
      const j = idx + dir;
      if (j < 0 || j >= curr.length) return curr;
      const next = curr.slice();
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const uploadImages = async (idx: number, files: FileList | File[]) => {
    const arr = Array.from(files);
    const uploaded: string[] = [];
    for (const file of arr) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `presale/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("card-images")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (error) {
        alert(`Erro ao subir imagem: ${error.message}`);
        continue;
      }
      const { data } = supabase.storage.from("card-images").getPublicUrl(path);
      uploaded.push(data.publicUrl);
    }
    if (uploaded.length > 0) {
      setProducts((curr) =>
        curr.map((p, i) =>
          i === idx ? { ...p, image_urls: [...p.image_urls, ...uploaded].slice(0, 20) } : p,
        ),
      );
    }
  };

  const removeImage = (idx: number, imgIdx: number) => {
    setProducts((curr) =>
      curr.map((p, i) =>
        i === idx ? { ...p, image_urls: p.image_urls.filter((_, j) => j !== imgIdx) } : p,
      ),
    );
  };

  const moveImage = (idx: number, imgIdx: number, dir: -1 | 1) => {
    setProducts((curr) =>
      curr.map((p, i) => {
        if (i !== idx) return p;
        const j = imgIdx + dir;
        if (j < 0 || j >= p.image_urls.length) return p;
        const next = p.image_urls.slice();
        [next[imgIdx], next[j]] = [next[j], next[imgIdx]];
        return { ...p, image_urls: next };
      }),
    );
  };

  const save = async () => {
    if (!slug.trim() || !title.trim()) {
      alert("Slug e título são obrigatórios.");
      return;
    }
    if (products.length === 0 || products.some((p) => !p.name.trim())) {
      alert("Cada produto precisa de um nome.");
      return;
    }
    setSaving(true);
    try {
      const res = await adminUpsertPresalePage({
        data: {
          id: id ?? undefined,
          slug: slug.trim().toLowerCase(),
          title: title.trim(),
          is_active: isActive,
          starts_at: fromDateTimeLocal(startsAt),
          ends_at: fromDateTimeLocal(endsAt),
          sort_order: 0,
          products: products.map((p, i) => ({
            id: p.id,
            name: p.name.trim(),
            description: p.description,
            image_urls: p.image_urls,
            price_cents: Math.round(Number(p.price_cents) || 0),
            quantity: Math.round(Number(p.quantity) || 0),
            language: p.language?.trim() || null,
            release_year: p.release_year === "" ? null : Number(p.release_year),
            available_from: p.available_from || null,
            whatsapp_button_text: p.whatsapp_button_text.trim(),
            whatsapp_message_template: p.whatsapp_message_template.trim(),
            sort_order: i,
          })),
        },
      });
      if (!res.success) {
        alert(`Erro: ${(res as any).error ?? "falha ao salvar"}`);
        return;
      }
      onDone();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{id ? "Editar Pré-Venda" : "Nova Pré-Venda"}</h1>
          <div className="flex gap-2">
            <button onClick={onCancel} className="rounded-md border border-border px-4 py-2 text-sm">
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-semibold">Configuração da página</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="block mb-1 text-xs font-semibold text-muted-foreground">Título</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="block mb-1 text-xs font-semibold text-muted-foreground">Slug (URL: /pre-venda/[slug])</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="ex: pokemon-scarlet-2026"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              />
            </label>
            <label className="block text-sm">
              <span className="block mb-1 text-xs font-semibold text-muted-foreground">Ativa em (opcional)</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="block mb-1 text-xs font-semibold text-muted-foreground">Sai do ar em (opcional)</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-foreground"
            />
            Ativa manualmente (também respeita o agendamento)
          </label>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Produtos ({products.length})</h2>
            <button
              onClick={() => setProducts((c) => [...c, emptyProduct()])}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar produto
            </button>
          </div>

          {products.map((p, idx) => (
            <div key={idx} className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Produto #{idx + 1}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => moveProduct(idx, -1)}
                    disabled={idx === 0}
                    className="grid h-8 w-8 place-items-center rounded-md hover:bg-secondary disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => moveProduct(idx, 1)}
                    disabled={idx === products.length - 1}
                    className="grid h-8 w-8 place-items-center rounded-md hover:bg-secondary disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (products.length === 1) {
                        alert("Ao menos um produto é necessário.");
                        return;
                      }
                      if (!confirm("Remover este produto?")) return;
                      setProducts((c) => c.filter((_, i) => i !== idx));
                    }}
                    className="grid h-8 w-8 place-items-center rounded-md text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <div className="space-y-2">
                  {p.image_urls.length === 0 ? (
                    <div className="w-full aspect-square rounded-md border border-dashed border-border grid place-items-center text-xs text-muted-foreground">
                      Sem imagens
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {p.image_urls.map((url, imgIdx) => (
                        <div key={url + imgIdx} className="relative group">
                          <img
                            src={url}
                            alt=""
                            className={`w-full aspect-square object-cover rounded-md border ${
                              imgIdx === 0 ? "border-[#2563eb] border-2" : "border-border"
                            }`}
                          />
                          {imgIdx === 0 && (
                            <span className="absolute top-1 left-1 rounded bg-[#2563eb] text-white text-[9px] px-1 py-0.5 font-bold">
                              CAPA
                            </span>
                          )}
                          <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 group-hover:opacity-100 transition">
                            <button
                              type="button"
                              onClick={() => moveImage(idx, imgIdx, -1)}
                              disabled={imgIdx === 0}
                              className="rounded bg-black/60 text-white p-0.5 disabled:opacity-30"
                              aria-label="Mover para trás"
                            >
                              <ArrowUp className="h-3 w-3 -rotate-90" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeImage(idx, imgIdx)}
                              className="rounded bg-red-600 text-white p-0.5"
                              aria-label="Remover"
                            >
                              <X className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveImage(idx, imgIdx, 1)}
                              disabled={imgIdx === p.image_urls.length - 1}
                              className="rounded bg-black/60 text-white p-0.5 disabled:opacity-30"
                              aria-label="Mover para frente"
                            >
                              <ArrowDown className="h-3 w-3 -rotate-90" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="inline-flex items-center gap-1 text-xs cursor-pointer rounded-md border border-border px-2 py-1.5 hover:bg-secondary w-full justify-center">
                    <Upload className="h-3 w-3" /> Adicionar imagens
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) uploadImages(idx, files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <p className="text-[10px] text-muted-foreground text-center">
                    A primeira imagem é a capa. Passe o mouse para reordenar ou remover.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm">
                    <span className="block mb-1 text-xs font-semibold text-muted-foreground">Nome</span>
                    <input
                      value={p.name}
                      onChange={(e) => updateProduct(idx, { name: e.target.value })}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="block text-sm">
                    <span className="block mb-1 text-xs font-semibold text-muted-foreground">Descrição</span>
                    <RichTextEditor
                      value={p.description}
                      onChange={(html) => updateProduct(idx, { description: html })}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-4">
                    <label className="block text-sm">
                      <span className="block mb-1 text-xs font-semibold text-muted-foreground">Preço (R$)</span>
                      <input
                        type="number"
                        step="0.01"
                        value={p.price_cents / 100}
                        onChange={(e) =>
                          updateProduct(idx, { price_cents: Math.round(Number(e.target.value) * 100) })
                        }
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm tabular-nums"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="block mb-1 text-xs font-semibold text-muted-foreground">
                        Quantidade <span className="text-[10px] text-orange-600">(interno)</span>
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={p.quantity}
                        onChange={(e) => updateProduct(idx, { quantity: Number(e.target.value) })}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm tabular-nums"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="block mb-1 text-xs font-semibold text-muted-foreground">Idioma</span>
                      <input
                        value={p.language}
                        onChange={(e) => updateProduct(idx, { language: e.target.value })}
                        placeholder="PT / EN / JP"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="block mb-1 text-xs font-semibold text-muted-foreground">Ano</span>
                      <input
                        type="number"
                        value={p.release_year}
                        onChange={(e) =>
                          updateProduct(idx, { release_year: e.target.value === "" ? "" : Number(e.target.value) })
                        }
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm tabular-nums"
                      />
                    </label>
                  </div>
                  <label className="block text-sm">
                    <span className="block mb-1 text-xs font-semibold text-muted-foreground">
                      Data de disponibilidade (informativa)
                    </span>
                    <input
                      type="date"
                      value={p.available_from}
                      onChange={(e) => updateProduct(idx, { available_from: e.target.value })}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="block mb-1 text-xs font-semibold text-muted-foreground">Texto do botão WhatsApp</span>
                    <input
                      value={p.whatsapp_button_text}
                      onChange={(e) => updateProduct(idx, { whatsapp_button_text: e.target.value })}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="block mb-1 text-xs font-semibold text-muted-foreground">
                      Mensagem pré-preenchida (use [nome do produto])
                    </span>
                    <textarea
                      value={p.whatsapp_message_template}
                      onChange={(e) => updateProduct(idx, { whatsapp_message_template: e.target.value })}
                      rows={2}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
