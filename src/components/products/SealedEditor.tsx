import { CommonProductFields } from "./CommonProductFields";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus, X, Upload, Link as LinkIcon, ArrowUp, ArrowDown } from "lucide-react";

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

export function SealedEditor({ item, onClose, onSaved }: { item: Sealed; onClose: () => void; onSaved: () => void }) {
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
        <Button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1 hover:bg-secondary" aria-label="Fechar">
          <X className="h-5 w-5" />
        </Button>
        <h2 className="mb-2 text-lg font-bold">Editar produto lacrado</h2>
        {item.sku && (
          <p className="mb-5 text-xs text-muted-foreground">
            SKU: <span className="font-mono font-semibold text-foreground">{item.sku}</span> (gerado automaticamente)
          </p>
        )}

        <div className="space-y-4">
          <CommonProductFields title={title} description={description} price={price} stock={stock} active={active} onTitle={setTitle} onDescription={setDescription} onPrice={setPrice} onStock={setStock} onActive={setActive}/>


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
              <Button onClick={addUrl} className="rounded-md border border-border px-3 py-2 text-xs font-semibold">Adicionar</Button>
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
                    <Button
                      onClick={() => removeImage(i)}
                      className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-destructive shadow"
                      aria-label="Remover imagem"
                      type="button"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-foreground/70 p-1">
                      <Button
                        onClick={() => moveImage(i, -1)}
                        disabled={i === 0}
                        className="flex-1 rounded bg-background/90 py-1 text-xs font-bold disabled:opacity-30"
                        aria-label="Mover para esquerda"
                        type="button"
                      >
                        ←
                      </Button>
                      {i !== 0 && (
                        <Button
                          onClick={() => setImages((arr) => { const next = [...arr]; const [it] = next.splice(i, 1); next.unshift(it); return next; })}
                          className="flex-1 rounded bg-background/90 py-1 text-[10px] font-bold"
                          aria-label="Definir como capa"
                          type="button"
                        >
                          Capa
                        </Button>
                      )}
                      <Button
                        onClick={() => moveImage(i, 1)}
                        disabled={i === images.length - 1}
                        className="flex-1 rounded bg-background/90 py-1 text-xs font-bold disabled:opacity-30"
                        aria-label="Mover para direita"
                        type="button"
                      >
                        →
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Cancelar</Button>
          <Button onClick={save} disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
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
