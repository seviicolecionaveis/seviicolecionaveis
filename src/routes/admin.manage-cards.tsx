import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { invalidateCardsCache } from "@/hooks/useCardsCatalog";
import type { Condition, Finish, Language, LigaSubcategory, PokemonType, TrainerSubcategory } from "@/data/cards";
import { CONDITIONS, CONDITION_LABEL, EXTRA_COLLECTIONS, LIGA_SUBCATEGORIES, POKEMON_TYPES, TRAINER_SUBCATEGORIES } from "@/data/cards";
import { notifyStockBack } from "@/lib/stock-alerts.functions";
import { cardSlug } from "@/lib/slug";
import { IllustratorCombobox } from "@/components/admin/IllustratorCombobox";

export const Route = createFileRoute("/admin/manage-cards")({
  head: () => ({ meta: [{ title: "Gerenciar cartas — Admin" }] }),
  component: AdminCardsManagePage,
});

const FINISHES: Finish[] = ["Normal", "Reverse Foil", "Foil", "Pokebola", "Masterball", "Rocket", "Energia", "Promo", "Ímã", "Shattered Holo", "Illustration Rare", "Ultra Rara", "Black Star Promo", "Double Rare", "Liga"];

// Preço automático para o acabamento "Ímã" (em centavos): R$10 se a carta tem Foil,
// senão R$9 se tem Normal. Retorna null se não houver base.
function autoMagnetPriceCents(
  rows: { name: string; collection: string; card_number: string; finish: Finish; category?: string }[],
  name: string,
  collection: string,
  cardNumber: string,
  category: string,
): number | null {
  if (category !== "Pokémon") return null;
  const sameCard = rows.filter(
    (r) =>
      r.name.trim().toLowerCase() === name.trim().toLowerCase() &&
      r.collection.trim().toLowerCase() === collection.trim().toLowerCase() &&
      r.card_number.trim() === cardNumber.trim(),
  );
  const hasFoil = sameCard.some((r) => r.finish === "Foil");
  if (hasFoil) return 1000;
  const hasNormal = sameCard.some((r) => r.finish === "Normal");
  if (hasNormal) return 900;
  return null;
}
const LANGUAGES: Language[] = ["Português", "Inglês", "Espanhol", "Italiano", "Japonês", "Chinês"];

type CardCategory = "Pokémon" | "Treinador" | "Energia";
const CATEGORIES: CardCategory[] = ["Pokémon", "Treinador", "Energia"];

interface CardRow {
  id: string;
  name: string;
  card_number: string;
  collection: string;
  language: Language;
  finish: Finish;
  condition: Condition;
  category: CardCategory;
  trainer_subcategory: TrainerSubcategory | null;
  liga_subcategory: LigaSubcategory | null;
  pokemon_type: PokemonType | null;
  illustrator_id: string | null;
  stock: number;
  base_price_cents: number | null;
  image: string;
  updated_at: string;
  created_at?: string;
  created_by?: string | null;
  // (created_by_email removed for security; admin email no longer exposed via cards)
}

interface FormState {
  name: string;
  card_number: string;
  collection: string;
  language: Language;
  finish: Finish;
  condition: Condition;
  category: CardCategory;
  trainer_subcategory: TrainerSubcategory | "";
  liga_subcategory: LigaSubcategory | "";
  pokemon_type: PokemonType | "";
  illustrator_id: string | null;
  stock: string;
  price: string;
  image: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  card_number: "",
  collection: "",
  language: "Português",
  finish: "Normal",
  condition: "NM",
  category: "Pokémon",
  trainer_subcategory: "",
  liga_subcategory: "",
  pokemon_type: "",
  illustrator_id: null,
  stock: "1",
  price: "",
  image: "",
};

function AdminCardsManagePage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CardCategory[]>([]);
  const [pokemonTypeFilter, setPokemonTypeFilter] = useState<PokemonType[]>([]);
  const [trainerSubFilter, setTrainerSubFilter] = useState<TrainerSubcategory[]>([]);
  const [noPriceOnly, setNoPriceOnly] = useState(false);
  const [collectionFilter, setCollectionFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const [quickForm, setQuickForm] = useState<FormState>(EMPTY_FORM);
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickMsg, setQuickMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingQuick, setUploadingQuick] = useState(false);

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("card-images").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (error) { alert(`Erro ao enviar imagem: ${error.message}`); return null; }
    const { data } = supabase.storage.from("card-images").getPublicUrl(path);
    return data.publicUrl;
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) nav({ to: "/auth" });
      else if (!isAdmin) nav({ to: "/" });
    }
  }, [authLoading, user, isAdmin, nav]);

  const load = async () => {
    setLoading(true);
    const all: CardRow[] = [];
    const CHUNK = 1000;
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .order("name", { ascending: true })
        .order("collection", { ascending: true })
        .order("card_number", { ascending: true })
        .range(from, from + CHUNK - 1);
      if (error) break;
      const batch = (data ?? []) as CardRow[];
      all.push(...batch);
      if (batch.length < CHUNK) break;
      from += CHUNK;
    }
    setRows(all);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const availableCategories = useMemo(() => {
    const set = new Set<CardCategory>();
    rows.forEach((r) => { if (r.category) set.add(r.category); });
    return CATEGORIES.filter((c) => set.has(c));
  }, [rows]);

  const filteredAll = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (categoryFilter.length > 0 && !categoryFilter.includes(r.category)) return false;
      if (pokemonTypeFilter.length > 0 && (!r.pokemon_type || !pokemonTypeFilter.includes(r.pokemon_type))) return false;
      if (trainerSubFilter.length > 0 && (r.category !== "Treinador" || !r.trainer_subcategory || !trainerSubFilter.includes(r.trainer_subcategory))) return false;
      if (noPriceOnly && r.base_price_cents != null) return false;
      if (collectionFilter && r.collection !== collectionFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.collection.toLowerCase().includes(q) ||
        r.card_number.toLowerCase().includes(q)
      );
    });
  }, [rows, search, categoryFilter, pokemonTypeFilter, trainerSubFilter, noPriceOnly, collectionFilter]);

  useEffect(() => { setPage(1); }, [search, pageSize, categoryFilter, pokemonTypeFilter, trainerSubFilter, noPriceOnly, collectionFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAll.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const filtered = useMemo(
    () => filteredAll.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredAll, currentPage, pageSize],
  );

  const collections = useMemo(() => {
    return Array.from(new Set([...rows.map((r) => r.collection), ...EXTRA_COLLECTIONS].filter(Boolean))).sort();
  }, [rows]);

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!form.name.trim() || !form.card_number.trim() || !form.collection.trim()) {
      setMsg({ type: "err", text: "Preencha nome, número e coleção." });
      return;
    }
    setSaving(true);
    let priceCents: number | null =
      form.price.trim() === "" ? null : Math.round(parseFloat(form.price.replace(",", ".")) * 100);
    if (form.finish === "Ímã" && priceCents == null) {
      priceCents = autoMagnetPriceCents(
        rows,
        form.name,
        form.collection,
        form.card_number,
        form.category,
      );
    }
    const payload: any = {
      name: form.name.trim(),
      card_number: form.card_number.trim(),
      collection: form.collection.trim(),
      language: form.language,
      finish: form.finish,
      condition: form.condition,
      category: form.category,
      trainer_subcategory: form.category === "Treinador" && form.trainer_subcategory ? form.trainer_subcategory : null,
      liga_subcategory: form.finish === "Liga" && form.liga_subcategory ? form.liga_subcategory : null,
      pokemon_type: form.category === "Pokémon" && form.pokemon_type ? form.pokemon_type : null,
      illustrator_id: form.illustrator_id,
      stock: Math.max(0, parseInt(form.stock) || 0),
      base_price_cents: priceCents,
      image: form.image.trim(),
    };
    if (!editingId) {
      payload.created_by = user?.id ?? null;
    }
    const { error } = editingId
      ? await supabase.from("cards").update(payload).eq("id", editingId)
      : await supabase.from("cards").insert(payload);
    setSaving(false);
    if (error) {
      setMsg({ type: "err", text: error.message.includes("duplicate") ? "Essa combinação já existe (nome+coleção+número+finish+idioma+condição)." : error.message });
      return;
    }
    setMsg({ type: "ok", text: editingId ? "Carta atualizada!" : "Carta adicionada!" });
    invalidateCardsCache();
    resetForm();
    await load();
  };

  const handleEdit = (r: CardRow) => {
    setEditingId(r.id);
    setForm({
      name: r.name,
      card_number: r.card_number,
      collection: r.collection,
      language: r.language,
      finish: r.finish,
      condition: r.condition ?? "NM",
      category: r.category ?? "Pokémon",
      trainer_subcategory: r.trainer_subcategory ?? "",
      liga_subcategory: (r as any).liga_subcategory ?? "",
      pokemon_type: r.pokemon_type ?? "",
      illustrator_id: r.illustrator_id ?? null,
      stock: String(r.stock),
      price: r.base_price_cents != null ? (r.base_price_cents / 100).toFixed(2) : "",
      image: r.image,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (r: CardRow) => {
    if (!confirm(`Remover "${r.name}" (${r.finish}, ${r.language}, ${r.condition ?? "NM"})?`)) return;
    const { error } = await supabase.from("cards").delete().eq("id", r.id);
    if (error) { alert(error.message); return; }
    invalidateCardsCache();
    await load();
  };

  const openQuickEdit = (r: CardRow) => {
    if (quickEditId === r.id) { setQuickEditId(null); return; }
    setQuickEditId(r.id);
    setQuickMsg(null);
    setQuickForm({
      name: r.name,
      card_number: r.card_number,
      collection: r.collection,
      language: r.language,
      finish: r.finish,
      condition: r.condition ?? "NM",
      category: r.category ?? "Pokémon",
      trainer_subcategory: r.trainer_subcategory ?? "",
      liga_subcategory: (r as any).liga_subcategory ?? "",
      pokemon_type: r.pokemon_type ?? "",
      illustrator_id: r.illustrator_id ?? null,
      stock: String(r.stock),
      price: r.base_price_cents != null ? (r.base_price_cents / 100).toFixed(2) : "",
      image: r.image,
    });
  };

  const triggerStockBack = useServerFn(notifyStockBack);

  const maybeNotifyStockBack = async (row: CardRow, newStock: number) => {
    const key = `${row.name}__${row.collection}__${row.card_number}`;
    const prevAggregate = rows
      .filter((r) => `${r.name}__${r.collection}__${r.card_number}` === key)
      .reduce((s, r) => s + (r.id === row.id ? 0 : r.stock), 0);
    if (prevAggregate === 0 && newStock > 0) {
      try {
        await triggerStockBack({
          data: {
            cardKey: key,
            cardName: row.name,
            cardCollection: row.collection,
            cardNumber: row.card_number,
            cardImage: row.image || null,
            cardSlug: cardSlug(row.name, row.collection, row.card_number),
          },
        });
      } catch (err) {
        console.error("notifyStockBack failed", err);
      }
    }
  };

  const quickPokemonTypeRef = useRef<HTMLSelectElement | null>(null);
  const focusPokemonOnOpenRef = useRef(false);

  useEffect(() => {
    if (quickEditId && focusPokemonOnOpenRef.current) {
      // Aguarda o painel renderizar antes de focar
      const t = setTimeout(() => {
        quickPokemonTypeRef.current?.focus();
        focusPokemonOnOpenRef.current = false;
      }, 50);
      return () => clearTimeout(t);
    }
  }, [quickEditId]);

  const handleQuickSave = async (id: string, opts?: { goNext?: boolean }) => {
    setQuickSaving(true);
    setQuickMsg(null);
    const newStock = Math.max(0, parseInt(quickForm.stock) || 0);
    const payload = {
      condition: quickForm.condition,
      category: quickForm.category,
      trainer_subcategory: quickForm.category === "Treinador" && quickForm.trainer_subcategory ? quickForm.trainer_subcategory : null,
      liga_subcategory: quickForm.finish === "Liga" && quickForm.liga_subcategory ? quickForm.liga_subcategory : null,
      pokemon_type: quickForm.category === "Pokémon" && quickForm.pokemon_type ? quickForm.pokemon_type : null,
      illustrator_id: quickForm.illustrator_id,
      stock: newStock,
      base_price_cents: quickForm.price.trim() === "" ? null : Math.round(parseFloat(quickForm.price.replace(",", ".")) * 100),
      image: quickForm.image.trim(),
    };
    const { error } = await supabase.from("cards").update(payload).eq("id", id);
    setQuickSaving(false);
    if (error) { setQuickMsg({ type: "err", text: error.message }); return; }
    const row = rows.find((r) => r.id === id);
    if (row) void maybeNotifyStockBack(row, newStock);
    setQuickMsg({ type: "ok", text: "Salvo!" });
    invalidateCardsCache();
    setRows((prev) => prev.map((row) => row.id === id ? { ...row, ...payload } as CardRow : row));

    if (opts?.goNext) {
      // Acha a próxima carta da página atual filtrada e abre a edição rápida nela.
      const idx = filtered.findIndex((r) => r.id === id);
      const next = idx >= 0 ? filtered[idx + 1] : null;
      if (next) {
        focusPokemonOnOpenRef.current = true;
        setQuickEditId(next.id);
        setQuickMsg(null);
        setQuickForm({
          name: next.name,
          card_number: next.card_number,
          collection: next.collection,
          language: next.language,
          finish: next.finish,
          condition: next.condition ?? "NM",
          category: next.category ?? "Pokémon",
          trainer_subcategory: next.trainer_subcategory ?? "",
          liga_subcategory: (next as any).liga_subcategory ?? "",
          pokemon_type: next.pokemon_type ?? "",
          illustrator_id: next.illustrator_id ?? null,
          stock: String(next.stock),
          price: next.base_price_cents != null ? (next.base_price_cents / 100).toFixed(2) : "",
          image: next.image,
        });
        return;
      }
      setQuickMsg({ type: "ok", text: "Fim da página — não há próxima carta." });
    }

    setTimeout(() => { setQuickEditId((cur) => cur === id ? null : cur); setQuickMsg(null); }, 600);
  };

  if (authLoading || !isAdmin) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <Link to="/" className="text-sm font-bold uppercase tracking-widest">Sevii · Admin · Cartas</Link>
          <div className="flex gap-3 text-xs">
            <Link to="/admin" className="text-muted-foreground hover:text-foreground">Pedidos</Link>
            
            <Link to="/" className="text-muted-foreground hover:text-foreground">← Catálogo</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <HistoryPanel rows={rows} />
        <section className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-bold mb-1">{editingId ? "Editar carta" : "Adicionar nova carta"}</h1>
          <p className="text-xs text-muted-foreground mb-4">
            Cada combinação <strong>nome + coleção + número + finish + idioma</strong> é única. Para a mesma carta em outro idioma ou finish, cadastre uma nova entrada.
          </p>

          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs space-y-1 sm:col-span-2">
              <span className="font-semibold">Nome da carta *</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Charizard ex"
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </label>

            <label className="text-xs space-y-1">
              <span className="font-semibold">Número *</span>
              <input
                value={form.card_number}
                onChange={(e) => setForm({ ...form, card_number: e.target.value })}
                placeholder="Ex: 054/197"
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </label>

            <label className="text-xs space-y-1">
              <span className="font-semibold">Coleção *</span>
              <input
                value={form.collection}
                onChange={(e) => setForm({ ...form, collection: e.target.value })}
                placeholder="Ex: SVI - Escarlate e Violeta"
                list="collections-list"
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                required
              />
              <datalist id="collections-list">
                {collections.map((c) => <option key={c} value={c} />)}
              </datalist>
            </label>

            <label className="text-xs space-y-1">
              <span className="font-semibold">Idioma *</span>
              <select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value as Language })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>

            <label className="text-xs space-y-1">
              <span className="font-semibold">Acabamento (Finish) *</span>
              <select
                value={form.finish}
                onChange={(e) => {
                  const finish = e.target.value as Finish;
                  setForm({ ...form, finish, liga_subcategory: finish === "Liga" ? form.liga_subcategory : "" });
                }}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                {FINISHES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>

            {form.finish === "Liga" && (
              <label className="text-xs space-y-1">
                <span className="font-semibold">Subtipo Liga</span>
                <select
                  value={form.liga_subcategory}
                  onChange={(e) => setForm({ ...form, liga_subcategory: e.target.value as LigaSubcategory | "" })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">— Selecionar —</option>
                  {LIGA_SUBCATEGORIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            )}

            <label className="text-xs space-y-1">
              <span className="font-semibold">Condição *</span>
              <select
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value as Condition })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}
              </select>
            </label>

            <label className="text-xs space-y-1">
              <span className="font-semibold">Tipo de carta *</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as CardCategory, trainer_subcategory: e.target.value === "Treinador" ? form.trainer_subcategory : "", pokemon_type: e.target.value === "Pokémon" ? form.pokemon_type : "" })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            {form.category === "Treinador" && (
              <label className="text-xs space-y-1">
                <span className="font-semibold">Subtipo de Treinador</span>
                <select
                  value={form.trainer_subcategory}
                  onChange={(e) => setForm({ ...form, trainer_subcategory: e.target.value as TrainerSubcategory | "" })}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">— Selecionar —</option>
                  {TRAINER_SUBCATEGORIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            )}

            <label className="text-xs space-y-1">
              <span className="font-semibold">Tipo Pokémon</span>
              <select
                value={form.pokemon_type}
                onChange={(e) => setForm({ ...form, pokemon_type: e.target.value as PokemonType | "" })}
                disabled={form.category !== "Pokémon"}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">— Nenhum —</option>
                {POKEMON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>

            <label className="text-xs space-y-1 sm:col-span-2">
              <span className="font-semibold">Ilustrador</span>
              <IllustratorCombobox
                value={form.illustrator_id}
                onChange={(id) => setForm({ ...form, illustrator_id: id })}
              />
            </label>





            <label className="text-xs space-y-1">
              <span className="font-semibold">Estoque *</span>
              <input
                type="number"
                min="0"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                required
              />
            </label>

            <label className="text-xs space-y-1">
              <span className="font-semibold">Preço base (R$) — opcional</span>
              <input
                type="text"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="Ex: 49,90 (deixe vazio para usar Liga)"
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </label>

            <label className="text-xs space-y-1 sm:col-span-2">
              <span className="font-semibold">Imagem</span>
              <div className="flex gap-2 items-start">
                <input
                  type="url"
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  placeholder="Cole uma URL ou clique em + para enviar arquivo"
                  className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
                />
                <label className="cursor-pointer rounded border border-border bg-secondary px-3 py-2 text-sm font-bold hover:bg-secondary/70 shrink-0">
                  {uploadingMain ? "..." : "+"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingMain}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]; e.target.value = "";
                      if (!file) return;
                      setUploadingMain(true);
                      const url = await uploadImage(file);
                      setUploadingMain(false);
                      if (url) setForm((f) => ({ ...f, image: url }));
                    }}
                  />
                </label>
              </div>
              {form.image && (
                <img src={form.image} alt="preview" className="mt-2 h-32 w-auto rounded border border-border object-contain bg-secondary" />
              )}
            </label>

            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Salvando..." : editingId ? "💾 Atualizar carta" : "+ Adicionar carta"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded border border-border px-4 py-2 text-xs font-medium hover:bg-secondary"
                >
                  Cancelar edição
                </button>
              )}
              {msg && (
                <span className={`text-xs ${msg.type === "ok" ? "text-condition-mint" : "text-destructive"}`}>
                  {msg.text}
                </span>
              )}
          </div>

          {availableCategories.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded border border-border bg-card px-3 py-2">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tipo:</span>
              {availableCategories.map((cat) => {
                const checked = categoryFilter.includes(cat);
                const count = rows.filter((r) => r.category === cat).length;
                return (
                  <label key={cat} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setCategoryFilter((prev) =>
                          e.target.checked ? [...prev, cat] : prev.filter((c) => c !== cat),
                        )
                      }
                      className="rounded border-border accent-foreground"
                    />
                    <span>{cat} <span className="text-muted-foreground">({count})</span></span>
                  </label>
                );
              })}
              {categoryFilter.length > 0 && (
                <button
                  onClick={() => setCategoryFilter([])}
                  className="ml-auto text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Limpar
                </button>
              )}
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-2 rounded border border-border bg-card px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tipo Pokémon:</span>
            {POKEMON_TYPES.map((t) => {
              const checked = pokemonTypeFilter.includes(t);
              const count = rows.filter((r) => r.pokemon_type === t).length;
              return (
                <label key={t} className="flex items-center gap-1 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setPokemonTypeFilter((prev) =>
                        e.target.checked ? [...prev, t] : prev.filter((x) => x !== t),
                      )
                    }
                    className="rounded border-border accent-foreground"
                  />
                  <span>{t} <span className="text-muted-foreground">({count})</span></span>
                </label>
              );
            })}
            {pokemonTypeFilter.length > 0 && (
              <button
                onClick={() => setPokemonTypeFilter([])}
                className="ml-auto text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Limpar
              </button>
            )}
          </div>

          {(categoryFilter.length === 0 || categoryFilter.includes("Treinador")) && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded border border-border bg-card px-3 py-2">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Subtipo Treinador:</span>
              {TRAINER_SUBCATEGORIES.map((s) => {
                const checked = trainerSubFilter.includes(s);
                const count = rows.filter((r) => r.category === "Treinador" && r.trainer_subcategory === s).length;
                return (
                  <label key={s} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setTrainerSubFilter((prev) =>
                          e.target.checked ? [...prev, s] : prev.filter((x) => x !== s),
                        )
                      }
                      className="rounded border-border accent-foreground"
                    />
                    <span>{s} <span className="text-muted-foreground">({count})</span></span>
                  </label>
                );
              })}
              {trainerSubFilter.length > 0 && (
                <button
                  onClick={() => setTrainerSubFilter([])}
                  className="ml-auto text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Limpar
                </button>
              )}
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-3 rounded border border-border bg-card px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-wider">Coleção:</span>
            <select
              value={collectionFilter}
              onChange={(e) => setCollectionFilter(e.target.value)}
              className="rounded border border-border bg-background px-2 py-1 text-xs"
            >
              <option value="">Todas ({rows.length})</option>
              {collections.map((c) => {
                const count = rows.filter((r) => r.collection === c).length;
                if (count === 0) return null;
                return <option key={c} value={c}>{c} ({count})</option>;
              })}
            </select>

            <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={noPriceOnly}
                onChange={(e) => setNoPriceOnly(e.target.checked)}
                className="rounded border-border accent-foreground"
              />
              <span className="font-semibold">Sem preço</span>
              <span className="text-muted-foreground">({rows.filter((r) => r.base_price_cents == null).length})</span>
            </label>
            {(noPriceOnly || collectionFilter) && (
              <button
                onClick={() => { setNoPriceOnly(false); setCollectionFilter(""); }}
                className="ml-auto text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Limpar
              </button>
            )}
          </div>

          </form>
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Cartas cadastradas ({rows.length})</h2>
            <input
              type="search"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded border border-border bg-background px-3 py-2 text-sm w-64 max-w-full"
            />
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => (
                <div key={r.id} className="relative">
                  <div className="flex items-center gap-3 rounded border border-border bg-card px-3 py-2">
                    {r.image ? (
                      <img src={r.image} alt={r.name} className="w-10 h-14 object-contain rounded shrink-0 bg-secondary" loading="lazy" />
                    ) : (
                      <div className="w-10 h-14 rounded bg-secondary shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.collection} · #{r.card_number} · {r.finish} · {r.language} · <span className="font-bold">{r.condition ?? "NM"}</span>
                      </p>
                    </div>
                    <div className="text-xs text-right shrink-0">
                      <p>Estoque: <strong>{r.stock}</strong></p>
                      <p className="text-muted-foreground">
                        {r.base_price_cents != null ? `R$ ${(r.base_price_cents / 100).toFixed(2)}` : "—"}
                      </p>
                    </div>
                    <button
                      onClick={() => openQuickEdit(r)}
                      className={`rounded border px-2 py-1 text-[10px] font-bold hover:bg-secondary ${quickEditId === r.id ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                    >
                      {quickEditId === r.id ? "Fechar" : "Editar"}
                    </button>
                    <button
                      onClick={() => handleEdit(r)}
                      className="rounded border border-border px-2 py-1 text-[10px] font-bold hover:bg-secondary"
                      title="Editar tudo no formulário acima"
                    >
                      ⋯
                    </button>
                    <button
                      onClick={() => handleDelete(r)}
                      className="rounded border border-destructive px-2 py-1 text-[10px] font-bold text-destructive hover:bg-destructive/10"
                    >
                      Remover
                    </button>
                  </div>
                  {quickEditId === r.id && (
                    <div className="mt-2 rounded-lg border border-primary/40 bg-card p-4 shadow-lg">
                      <p className="text-xs font-bold uppercase tracking-wide mb-3">Edição rápida</p>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <label className="text-xs space-y-1">
                          <span className="font-semibold">Condição</span>
                          <select
                            value={quickForm.condition}
                            onChange={(e) => setQuickForm({ ...quickForm, condition: e.target.value as Condition })}
                            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                          >
                            {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}
                          </select>
                        </label>
                        <label className="text-xs space-y-1">
                          <span className="font-semibold">Tipo</span>
                          <select
                            value={quickForm.category}
                            onChange={(e) => setQuickForm({ ...quickForm, category: e.target.value as CardCategory, trainer_subcategory: e.target.value === "Treinador" ? quickForm.trainer_subcategory : "", pokemon_type: e.target.value === "Pokémon" ? quickForm.pokemon_type : "" })}
                            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                          >
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </label>
                        {quickForm.category === "Treinador" && (
                          <label className="text-xs space-y-1">
                            <span className="font-semibold">Subtipo Treinador</span>
                            <select
                              value={quickForm.trainer_subcategory}
                              onChange={(e) => setQuickForm({ ...quickForm, trainer_subcategory: e.target.value as TrainerSubcategory | "" })}
                              className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                            >
                              <option value="">— Selecionar —</option>
                              {TRAINER_SUBCATEGORIES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </label>
                        )}
                        <label className="text-xs space-y-1">
                          <span className="font-semibold">Tipo Pokémon</span>
                          <select
                            ref={quickPokemonTypeRef}
                            value={quickForm.pokemon_type}
                            onChange={(e) => setQuickForm({ ...quickForm, pokemon_type: e.target.value as PokemonType | "" })}
                            disabled={quickForm.category !== "Pokémon"}
                            className="w-full rounded border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
                          >
                            <option value="">— Nenhum —</option>
                            {POKEMON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </label>
                        <label className="text-xs space-y-1">
                          <span className="font-semibold">Estoque</span>
                          <input
                            type="number"
                            min="0"
                            value={quickForm.stock}
                            onChange={(e) => setQuickForm({ ...quickForm, stock: e.target.value })}
                            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="text-xs space-y-1">
                          <span className="font-semibold">Preço (R$)</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={quickForm.price}
                            onChange={(e) => setQuickForm({ ...quickForm, price: e.target.value })}
                            placeholder="vazio = usar Liga"
                            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                          />
                        </label>
                      </div>
                      <label className="mt-3 block text-xs space-y-1">
                        <span className="font-semibold">Ilustrador</span>
                        <IllustratorCombobox
                          value={quickForm.illustrator_id}
                          onChange={(id) => setQuickForm({ ...quickForm, illustrator_id: id })}
                        />
                      </label>
                      <label className="mt-3 block text-xs space-y-1">
                        <span className="font-semibold">Imagem</span>
                        <div className="flex gap-2 items-start">
                          <input
                            type="url"
                            value={quickForm.image}
                            onChange={(e) => setQuickForm({ ...quickForm, image: e.target.value })}
                            placeholder="URL ou clique em + para enviar"
                            className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
                          />
                          <label className="cursor-pointer rounded border border-border bg-secondary px-3 py-2 text-sm font-bold hover:bg-secondary/70 shrink-0">
                            {uploadingQuick ? "..." : "+"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={uploadingQuick}
                              onChange={async (e) => {
                                const file = e.target.files?.[0]; e.target.value = "";
                                if (!file) return;
                                setUploadingQuick(true);
                                const url = await uploadImage(file);
                                setUploadingQuick(false);
                                if (url) setQuickForm((f) => ({ ...f, image: url }));
                              }}
                            />
                          </label>
                        </div>
                        {quickForm.image && (
                          <img src={quickForm.image} alt="preview" className="mt-2 h-24 w-auto rounded border border-border object-contain bg-secondary" />
                        )}
                      </label>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleQuickSave(r.id)}
                          disabled={quickSaving}
                          className="rounded bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                          {quickSaving ? "Salvando..." : "💾 Salvar"}
                        </button>
                        <button
                          onClick={() => handleQuickSave(r.id, { goNext: true })}
                          disabled={quickSaving}
                          title="Salva e abre a edição rápida da próxima carta da lista, com foco em Tipo Pokémon"
                          className="rounded bg-foreground px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-background hover:opacity-90 disabled:opacity-50"
                        >
                          {quickSaving ? "Salvando..." : "💾 Salvar e ir p/ próxima →"}
                        </button>
                        <button
                          onClick={() => setQuickEditId(null)}
                          className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleEdit(r)}
                          className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                        >
                          Editar tudo no topo →
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setForm({
                              name: r.name,
                              card_number: r.card_number,
                              collection: r.collection,
                              language: r.language,
                              finish: r.finish,
                              condition: r.condition ?? "NM",
                              category: r.category ?? "Pokémon",
                              trainer_subcategory: r.trainer_subcategory ?? "",
                              liga_subcategory: (r as any).liga_subcategory ?? "",
                              pokemon_type: r.pokemon_type ?? "",
                              illustrator_id: r.illustrator_id ?? null,
                              stock: "1",
                              price: r.base_price_cents != null ? (r.base_price_cents / 100).toFixed(2) : "",
                              image: r.image,
                            });
                            setMsg({ type: "ok", text: "Informações copiadas! Ajuste o que mudar (ex: finish ou idioma) e adicione." });
                            setQuickEditId(null);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="rounded border border-primary/60 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                          title="Copia todas as informações para o formulário acima como uma nova carta variante"
                        >
                          📋 Copiar p/ nova variante
                        </button>
                        {quickMsg && (
                          <span className={`text-xs ${quickMsg.type === "ok" ? "text-condition-mint" : "text-destructive"}`}>
                            {quickMsg.text}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma carta encontrada.</p>
              )}

              {filteredAll.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredAll.length)} de {filteredAll.length}</span>
                    <label className="flex items-center gap-1 ml-2">
                      <span>Por página:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => setPageSize(parseInt(e.target.value))}
                        className="rounded border border-border bg-background px-2 py-1"
                      >
                        {[50, 100, 200, 500].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40 hover:bg-secondary"
                    >
                      ← Anterior
                    </button>
                    <span className="text-xs px-2">Página {currentPage} / {totalPages}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="rounded border border-border px-2 py-1 text-xs disabled:opacity-40 hover:bg-secondary"
                    >
                      Próxima →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

interface StockChange {
  id: string;
  card_id: string | null;
  card_name: string;
  collection: string;
  card_number: string;
  finish: string | null;
  language: string | null;
  condition: string | null;
  previous_stock: number;
  new_stock: number;
  delta: number;
  changed_by: string | null;
  changed_at: string;
}

function HistoryPanel({ rows }: { rows: CardRow[] }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"added" | "stock">("added");
  const [limit, setLimit] = useState(25);
  const [query, setQuery] = useState("");
  const [deltaFilter, setDeltaFilter] = useState<"all" | "add" | "sub">("all");
  const [changes, setChanges] = useState<StockChange[]>([]);
  const [loadingChanges, setLoadingChanges] = useState(false);

  const recent = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...rows]
      .filter((r) => r.created_at)
      .filter((r) => !q || `${r.name} ${r.collection} ${r.card_number}`.toLowerCase().includes(q))
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .slice(0, limit);
  }, [rows, limit, query]);

  useEffect(() => {
    if (!open || tab !== "stock") return;
    let cancel = false;
    setLoadingChanges(true);
    supabase
      .from("card_stock_changes")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (cancel) return;
        setChanges((data as StockChange[]) ?? []);
        setLoadingChanges(false);
      });
    return () => { cancel = true; };
  }, [open, tab]);

  const filteredChanges = useMemo(() => {
    const q = query.trim().toLowerCase();
    return changes
      .filter((c) => {
        if (deltaFilter === "add" && c.delta <= 0) return false;
        if (deltaFilter === "sub" && c.delta >= 0) return false;
        if (q && !`${c.card_name} ${c.collection} ${c.card_number}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .slice(0, limit);
  }, [changes, deltaFilter, query, limit]);

  const totalAdded = rows.filter((r) => {
    if (!r.created_at) return false;
    const d = new Date(r.created_at);
    return Date.now() - d.getTime() < 48 * 60 * 60 * 1000;
  }).length;

  return (
    <section className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-secondary/40 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-gold/15 text-brand-gold text-sm">📋</span>
          <div>
            <h2 className="text-sm font-bold">Histórico de cartas & estoque</h2>
            <p className="text-[11px] text-muted-foreground">
              {totalAdded > 0 ? `${totalAdded} cadastrada${totalAdded > 1 ? "s" : ""} nas últimas 48h · ` : ""}
              clique para {open ? "ocultar" : "ver cadastros e alterações de estoque"}
            </p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              <button
                onClick={() => setTab("added")}
                className={`px-3 py-1.5 font-semibold ${tab === "added" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-secondary"}`}
              >
                Adicionadas
              </button>
              <button
                onClick={() => setTab("stock")}
                className={`px-3 py-1.5 font-semibold ${tab === "stock" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-secondary"}`}
              >
                Alterações de estoque
              </button>
            </div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, coleção ou número..."
              className="flex-1 min-w-[200px] rounded border border-border bg-background px-2 py-1.5 text-xs"
            />
            {tab === "stock" && (
              <select
                value={deltaFilter}
                onChange={(e) => setDeltaFilter(e.target.value as "all" | "add" | "sub")}
                className="rounded border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="all">Todas</option>
                <option value="add">Apenas adições (+)</option>
                <option value="sub">Apenas subtrações (−)</option>
              </select>
            )}
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="rounded border border-border bg-background px-2 py-1.5 text-xs"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
          </div>

          {tab === "added" ? (
            recent.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nenhuma carta encontrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-3 font-semibold">Data / hora</th>
                      <th className="py-2 pr-3 font-semibold">Carta</th>
                      <th className="py-2 pr-3 font-semibold">Coleção</th>
                      <th className="py-2 pr-3 font-semibold">Variante</th>
                      <th className="py-2 pr-3 font-semibold">Estoque</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r) => {
                      const dt = r.created_at ? new Date(r.created_at) : null;
                      return (
                        <tr key={r.id} className="border-b border-border/50 last:border-0">
                          <td className="py-2 pr-3 whitespace-nowrap tabular-nums">
                            {dt ? dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                          </td>
                          <td className="py-2 pr-3">
                            <div className="font-semibold">{r.name}</div>
                            <div className="text-muted-foreground">{r.card_number}</div>
                          </td>
                          <td className="py-2 pr-3">{r.collection}</td>
                          <td className="py-2 pr-3 text-muted-foreground">
                            {r.finish} · {r.language} · {r.condition ?? "NM"}
                          </td>
                          <td className="py-2 pr-3 tabular-nums">{r.stock}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : loadingChanges ? (
            <p className="text-xs text-muted-foreground py-2">Carregando histórico...</p>
          ) : filteredChanges.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Nenhuma alteração de estoque encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-semibold">Data / hora</th>
                    <th className="py-2 pr-3 font-semibold">Carta</th>
                    <th className="py-2 pr-3 font-semibold">Coleção</th>
                    <th className="py-2 pr-3 font-semibold">Variante</th>
                    <th className="py-2 pr-3 font-semibold text-right">Antes</th>
                    <th className="py-2 pr-3 font-semibold text-right">Depois</th>
                    <th className="py-2 pr-3 font-semibold text-right">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChanges.map((c) => {
                    const dt = new Date(c.changed_at);
                    const positive = c.delta > 0;
                    return (
                      <tr key={c.id} className="border-b border-border/50 last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap tabular-nums">
                          {dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="font-semibold">{c.card_name}</div>
                          <div className="text-muted-foreground">{c.card_number}</div>
                        </td>
                        <td className="py-2 pr-3">{c.collection}</td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {c.finish ?? "—"} · {c.language ?? "—"} · {c.condition ?? "—"}
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-right">{c.previous_stock}</td>
                        <td className="py-2 pr-3 tabular-nums text-right">{c.new_stock}</td>
                        <td className={`py-2 pr-3 tabular-nums text-right font-semibold ${positive ? "text-condition-mint" : "text-destructive"}`}>
                          {positive ? "+" : ""}{c.delta}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Exibindo {filteredChanges.length} de {changes.length} alterações carregadas (últimas 500).
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

