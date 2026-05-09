import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { invalidateCardsCache } from "@/hooks/useCardsCatalog";
import type { Condition, Finish, Language } from "@/data/cards";
import { CONDITIONS, CONDITION_LABEL, EXTRA_COLLECTIONS } from "@/data/cards";

export const Route = createFileRoute("/admin/manage-cards")({
  head: () => ({ meta: [{ title: "Gerenciar cartas — Admin" }] }),
  component: AdminCardsManagePage,
});

const FINISHES: Finish[] = ["Normal", "Reverse Foil", "Foil", "Pokebola", "Energia", "Promo"];
const LANGUAGES: Language[] = ["Português", "Inglês", "Espanhol", "Italiano"];

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
  stock: number;
  base_price_cents: number | null;
  image: string;
  updated_at: string;
}

interface FormState {
  name: string;
  card_number: string;
  collection: string;
  language: Language;
  finish: Finish;
  condition: Condition;
  category: CardCategory;
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

  const filteredAll = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      r.collection.toLowerCase().includes(q) ||
      r.card_number.toLowerCase().includes(q),
    );
  }, [rows, search]);

  useEffect(() => { setPage(1); }, [search, pageSize]);

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
    const payload = {
      name: form.name.trim(),
      card_number: form.card_number.trim(),
      collection: form.collection.trim(),
      language: form.language,
      finish: form.finish,
      condition: form.condition,
      category: form.category,
      stock: Math.max(0, parseInt(form.stock) || 0),
      base_price_cents: form.price.trim() === "" ? null : Math.round(parseFloat(form.price.replace(",", ".")) * 100),
      image: form.image.trim(),
    };
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
      stock: String(r.stock),
      price: r.base_price_cents != null ? (r.base_price_cents / 100).toFixed(2) : "",
      image: r.image,
    });
  };

  const handleQuickSave = async (id: string) => {
    setQuickSaving(true);
    setQuickMsg(null);
    const payload = {
      condition: quickForm.condition,
      category: quickForm.category,
      stock: Math.max(0, parseInt(quickForm.stock) || 0),
      base_price_cents: quickForm.price.trim() === "" ? null : Math.round(parseFloat(quickForm.price.replace(",", ".")) * 100),
      image: quickForm.image.trim(),
    };
    const { error } = await supabase.from("cards").update(payload).eq("id", id);
    setQuickSaving(false);
    if (error) { setQuickMsg({ type: "err", text: error.message }); return; }
    setQuickMsg({ type: "ok", text: "Salvo!" });
    invalidateCardsCache();
    setRows((prev) => prev.map((row) => row.id === id ? { ...row, ...payload } as CardRow : row));
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
            <Link to="/admin/cards" className="text-muted-foreground hover:text-foreground">Preços</Link>
            <Link to="/" className="text-muted-foreground hover:text-foreground">← Catálogo</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
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
                onChange={(e) => setForm({ ...form, finish: e.target.value as Finish })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                {FINISHES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>

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
                onChange={(e) => setForm({ ...form, category: e.target.value as CardCategory })}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
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
                            onChange={(e) => setQuickForm({ ...quickForm, category: e.target.value as CardCategory })}
                            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
                          >
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
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
