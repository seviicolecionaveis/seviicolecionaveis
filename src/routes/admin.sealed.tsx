import { SealedEditor } from "@/components/products/SealedEditor";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus, X, Upload, Link as LinkIcon, ArrowUp, ArrowDown } from "lucide-react";

export const Route = createFileRoute("/admin/sealed")({
  head: () => ({ meta: [{ title: "Produtos Lacrados — Admin" }] }),
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
      .insert({ title: "Novo produto lacrado", price_cents: 0, stock: 0, images: [], active: false })
      .select("*")
      .single();
    if (error) { toast.error(error.message); return; }
    await load();
    setEditing(data as Sealed);
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este produto lacrado?")) return;
    await supabase.from("sealed_products").delete().eq("id", id);
    await load();
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((p) => p.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
    // Reassign sort_order sequentially so ordering is deterministic
    // even when rows previously shared the same value (e.g. all 0).
    await Promise.all(
      next.map((p, i) =>
        p.sort_order === i
          ? Promise.resolve()
          : supabase.from("sealed_products").update({ sort_order: i }).eq("id", p.id),
      ),
    );
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
          <h1 className="text-2xl font-bold">Produtos Lacrados</h1>
          <button
            onClick={createNew}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Novo produto lacrado
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produto lacrado cadastrado.</p>
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

