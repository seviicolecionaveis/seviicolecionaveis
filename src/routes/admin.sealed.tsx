import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus, X, Upload, Link as LinkIcon, ArrowUp, ArrowDown } from "lucide-react";

export const Route = createFileRoute("/admin/sealed")({
  head: () => ({ meta: [{ title: "Selados — Admin" }] }),
  component: SealedAdmin,
});

type Sealed = {
  id: string;
  title: string;
  description: string | null;
  price_cents: number;
  stock: number;
  images: string[];
  active: boolean;
  sort_order: number;
  is_preorder: boolean;
  release_date: string | null;
  product_type: string | null;
  collection: string | null;
  language: string | null;
  distribution: string | null;
  condition: string | null;
  age_rating: string | null;
  sku: string | null;
};

const PRODUCT_TYPE_OPTIONS = [
  "Blister Unitário",
  "Blister Duplo",
  "Blister Triplo",
  "Blister Quádruplo",
  "Booster Avulso",
  "Booster Box",
  "Booster Bundle",
  "ETB (Elite Trainer Box)",
  "Deck Temático",
  "Battle Deck",
  "Box Coleção Especial",
  "Lata (Tin)",
  "Mini Lata",
  "Premium Collection",
  "Display",
];
const LANGUAGE_OPTIONS = ["Português (Brasil)", "Inglês", "Japonês", "Espanhol", "Outro"];
const DISTRIBUTION_OPTIONS = ["Copag", "Pokémon Company International", "Importado", "Outro"];
const CONDITION_OPTIONS = ["Novo e Lacrado", "Aberto / Reembalado", "Usado"];
const AGE_RATING_OPTIONS = ["3+", "6+", "8+", "10+", "12+", "Livre"];

function SealedAdmin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState<Sealed[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Sealed | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) nav({ to: "/auth" });
      else if (!isAdmin) nav({ to: "/" });
    }
  }, [authLoading, user, isAdmin, nav]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("sealed_products")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Sealed[]);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const createNew = async () => {
    const { data, error } = await supabase
      .from("sealed_products")
      .insert({ title: "Novo selado", price_cents: 0, stock: 0, images: [], active: false })
      .select("*")
      .single();
    if (error) { toast.error(error.message); return; }
    await load();
    setEditing(data as Sealed);
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este selado?")) return;
    await supabase.from("sealed_products").delete().eq("id", id);
    await load();
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((p) => p.id === id);
    const swap = items[idx + dir];
    if (!swap) return;
    await supabase.from("sealed_products").update({ sort_order: swap.sort_order }).eq("id", id);
    await supabase.from("sealed_products").update({ sort_order: items[idx].sort_order }).eq("id", swap.id);
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
          <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground">← Pedidos</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Produtos Selados</h1>
          <button
            onClick={createNew}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Novo selado
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produto selado cadastrado.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((p, i) => (
              <li key={p.id} className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-4">
                <img
                  src={p.images[0] ?? ""}
                  alt=""
                  className="h-20 w-20 rounded-md object-cover bg-secondary"
                />
                <div className="flex-1 min-w-[200px]">
                  <p className="font-semibold">
                    {p.title}
                    {p.is_preorder && (
                      <span className="ml-2 rounded bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        Pré-venda{p.release_date ? ` · ${new Date(p.release_date + "T00:00:00").toLocaleDateString("pt-BR")}` : ""}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.sku && <span className="font-mono">{p.sku} · </span>}
                    R$ {(p.price_cents / 100).toFixed(2)} · Estoque: {p.stock} · {p.images.length} foto(s)
                    {!p.active && " · Inativo"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => move(p.id, -1)} disabled={i === 0} className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-30">
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button onClick={() => move(p.id, 1)} disabled={i === items.length - 1} className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-30">
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
                <button onClick={() => setEditing(p)} className="rounded-md border border-border px-3 py-1 text-xs font-semibold">
                  Editar
                </button>
                <button onClick={() => remove(p.id)} className="rounded-md border border-destructive/40 text-destructive px-3 py-1 text-xs font-semibold inline-flex items-center gap-1">
                  <Trash2 className="h-3 w-3" /> Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {editing && (
        <SealedEditor
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { await load(); setEditing(null); }}
        />
      )}
    </div>
  );
}

function SealedEditor({ item, onClose, onSaved }: { item: Sealed; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [price, setPrice] = useState((item.price_cents / 100).toFixed(2));
  const [stock, setStock] = useState(String(item.stock));
  const [active, setActive] = useState(item.active);
  const [isPreorder, setIsPreorder] = useState(item.is_preorder ?? false);
  const [releaseDate, setReleaseDate] = useState(item.release_date ?? "");
  const [productType, setProductType] = useState(item.product_type ?? "");
  const [collection, setCollection] = useState(item.collection ?? "");
  const [language, setLanguage] = useState(item.language ?? "Português (Brasil)");
  const [distribution, setDistribution] = useState(item.distribution ?? "Copag");
  const [condition, setCondition] = useState(item.condition ?? "Novo e Lacrado");
  const [ageRating, setAgeRating] = useState(item.age_rating ?? "");
  const [images, setImages] = useState<string[]>(item.images ?? []);
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const addUrl = () => {
    const url = imageUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) { toast.error("URL inválida"); return; }
    setImages((arr) => [...arr, url]);
    setImageUrl("");
  };

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `sealed/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("card-images")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("card-images").getPublicUrl(path);
      setImages((arr) => [...arr, pub.publicUrl]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx: number) => setImages((arr) => arr.filter((_, i) => i !== idx));
  const moveImage = (idx: number, dir: -1 | 1) => {
    setImages((arr) => {
      const next = [...arr];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return arr;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const save = async () => {
    const priceCents = Math.round(Number(price.replace(",", ".")) * 100);
    const stockN = Number(stock);
    if (!title.trim()) { toast.error("Título obrigatório"); return; }
    if (!Number.isFinite(priceCents) || priceCents < 0) { toast.error("Preço inválido"); return; }
    if (!Number.isInteger(stockN) || stockN < 0) { toast.error("Estoque inválido"); return; }
    if (isPreorder && !releaseDate) { toast.error("Informe a data de lançamento da pré-venda"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("sealed_products")
      .update({
        title: title.trim(),
        description: description.trim() || null,
        price_cents: priceCents,
        stock: stockN,
        active,
        images,
        is_preorder: isPreorder,
        release_date: isPreorder ? releaseDate : null,
        product_type: productType.trim() || null,
        collection: collection.trim() || null,
        language: language.trim() || null,
        distribution: distribution.trim() || null,
        condition: condition.trim() || null,
        age_rating: ageRating.trim() || null,
      })
      .eq("id", item.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-background p-6 shadow-xl">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1 hover:bg-secondary" aria-label="Fechar">
          <X className="h-5 w-5" />
        </button>
        <h2 className="mb-2 text-lg font-bold">Editar selado</h2>
        {item.sku && (
          <p className="mb-5 text-xs text-muted-foreground">
            SKU: <span className="font-mono font-semibold text-foreground">{item.sku}</span> (gerado automaticamente)
          </p>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest">Título</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest">Descrição</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest">Preço (R$)</label>
              <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest">Estoque</label>
              <input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <label className="flex items-end gap-2 text-sm pb-2">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo
            </label>
          </div>

          <div className="rounded-md border border-border p-3 space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={isPreorder}
                onChange={(e) => setIsPreorder(e.target.checked)}
              />
              Pré-venda
            </label>
            {isPreorder && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest">Data de lançamento</label>
                <input
                  type="date"
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  O cliente poderá comprar mesmo com estoque zero. Avisaremos que o envio ocorre a partir desta data.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-md border border-border p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Ficha técnica</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ComboField
                label="Produto"
                value={productType}
                onChange={setProductType}
                options={PRODUCT_TYPE_OPTIONS}
                placeholder="Ex.: Blister Triplo"
              />
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest">Coleção</label>
                <input
                  value={collection}
                  onChange={(e) => setCollection(e.target.value)}
                  placeholder="Ex.: Amigos de Jornada"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <ComboField label="Idioma" value={language} onChange={setLanguage} options={LANGUAGE_OPTIONS} />
              <ComboField label="Distribuição" value={distribution} onChange={setDistribution} options={DISTRIBUTION_OPTIONS} />
              <ComboField label="Condição" value={condition} onChange={setCondition} options={CONDITION_OPTIONS} />
              <ComboField label="Faixa etária" value={ageRating} onChange={setAgeRating} options={AGE_RATING_OPTIONS} placeholder="Ex.: 6+" />
            </div>
          </div>


          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2">Imagens ({images.length})</p>
            <p className="text-xs text-muted-foreground mb-3">A primeira imagem é a capa exibida no catálogo.</p>

            <div className="mb-3 flex gap-2">
              <div className="flex-1 relative">
                <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }}
                  placeholder="Cole a URL da imagem"
                  className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2 text-sm"
                />
              </div>
              <button onClick={addUrl} className="rounded-md border border-border px-3 py-2 text-xs font-semibold">Adicionar</button>
              <label className={`cursor-pointer rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground inline-flex items-center gap-1 ${uploading ? "opacity-50" : ""}`}>
                <Upload className="h-3 w-3" /> {uploading ? "Enviando..." : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }}
                />
              </label>
            </div>

            {images.length > 0 && (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {images.map((url, i) => (
                  <li key={`${url}-${i}`} className="relative rounded-md overflow-hidden border border-border bg-secondary aspect-square">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {i === 0 && (
                      <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">Capa</span>
                    )}
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-destructive shadow"
                      aria-label="Remover imagem"
                      type="button"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-foreground/70 p-1">
                      <button
                        onClick={() => moveImage(i, -1)}
                        disabled={i === 0}
                        className="flex-1 rounded bg-background/90 py-1 text-xs font-bold disabled:opacity-30"
                        aria-label="Mover para esquerda"
                        type="button"
                      >
                        ←
                      </button>
                      {i !== 0 && (
                        <button
                          onClick={() => setImages((arr) => { const next = [...arr]; const [it] = next.splice(i, 1); next.unshift(it); return next; })}
                          className="flex-1 rounded bg-background/90 py-1 text-[10px] font-bold"
                          aria-label="Definir como capa"
                          type="button"
                        >
                          Capa
                        </button>
                      )}
                      <button
                        onClick={() => moveImage(i, 1)}
                        disabled={i === images.length - 1}
                        className="flex-1 rounded bg-background/90 py-1 text-xs font-bold disabled:opacity-30"
                        aria-label="Mover para direita"
                        type="button"
                      >
                        →
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Cancelar</button>
          <button onClick={save} disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ComboField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const listId = `combo-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-widest">{label}</label>
      <input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  );
}
