import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { invalidateCardsCache } from "@/hooks/useCardsCatalog";
import type { Finish, Language } from "@/data/cards";

export const Route = createFileRoute("/admin/manage-cards")({
  head: () => ({ meta: [{ title: "Gerenciar cartas — Admin" }] }),
  component: AdminCardsManagePage,
});

const FINISHES: Finish[] = ["Normal", "Reverse Foil", "Foil", "Pokebola", "Energia", "Promo"];
const LANGUAGES: Language[] = ["Português", "Inglês", "Espanhol", "Italiano"];

interface CardRow {
  id: string;
  name: string;
  card_number: string;
  collection: string;
  language: Language;
  finish: Finish;
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

  useEffect(() => {
    if (!authLoading) {
      if (!user) nav({ to: "/auth" });
      else if (!isAdmin) nav({ to: "/" });
    }
  }, [authLoading, user, isAdmin, nav]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cards")
      .select("*")
      .order("name", { ascending: true })
      .order("collection", { ascending: true })
      .order("card_number", { ascending: true })
      .limit(5000);
    if (!error) setRows((data ?? []) as CardRow[]);
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
    return Array.from(new Set(rows.map((r) => r.collection))).sort();
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
      stock: Math.max(0, parseInt(form.stock) || 0),
      base_price_cents: form.price.trim() === "" ? null : Math.round(parseFloat(form.price.replace(",", ".")) * 100),
      image: form.image.trim(),
    };
    const { error } = editingId
      ? await supabase.from("cards").update(payload).eq("id", editingId)
      : await supabase.from("cards").insert(payload);
    setSaving(false);
    if (error) {
      setMsg({ type: "err", text: error.message.includes("duplicate") ? "Essa combinação já existe (nome+coleção+número+finish+idioma)." : error.message });
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
      stock: String(r.stock),
      price: r.base_price_cents != null ? (r.base_price_cents / 100).toFixed(2) : "",
      image: r.image,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (r: CardRow) => {
    if (!confirm(`Remover "${r.name}" (${r.finish}, ${r.language})?`)) return;
    const { error } = await supabase.from("cards").delete().eq("id", r.id);
    if (error) { alert(error.message); return; }
    invalidateCardsCache();
    await load();
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
              <span className="font-semibold">URL da imagem</span>
              <input
                type="url"
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
                placeholder="https://images.scrydex.com/pokemon/..."
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
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
                <div key={r.id} className="flex items-center gap-3 rounded border border-border bg-card px-3 py-2">
                  {r.image ? (
                    <img src={r.image} alt={r.name} className="w-10 h-14 object-contain rounded shrink-0 bg-secondary" loading="lazy" />
                  ) : (
                    <div className="w-10 h-14 rounded bg-secondary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.collection} · #{r.card_number} · {r.finish} · {r.language}
                    </p>
                  </div>
                  <div className="text-xs text-right shrink-0">
                    <p>Estoque: <strong>{r.stock}</strong></p>
                    <p className="text-muted-foreground">
                      {r.base_price_cents != null ? `R$ ${(r.base_price_cents / 100).toFixed(2)}` : "—"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleEdit(r)}
                    className="rounded border border-border px-2 py-1 text-[10px] font-bold hover:bg-secondary"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(r)}
                    className="rounded border border-destructive px-2 py-1 text-[10px] font-bold text-destructive hover:bg-destructive/10"
                  >
                    Remover
                  </button>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma carta encontrada.</p>
              )}
              {!search && rows.length > 100 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Mostrando primeiras 100. Use a busca para encontrar outras.
                </p>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
