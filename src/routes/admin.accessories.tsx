import { AccessoryEditor } from "@/components/products/AccessoryEditor";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus, X, Upload, Link as LinkIcon, ArrowUp, ArrowDown } from "lucide-react";
import { parseVariants, type AccessoryVariant } from "@/lib/accessory-variants";

export const Route = createFileRoute("/admin/accessories")({
  head: () => ({ meta: [{ title: "Acessórios — Admin" }] }),
  component: AccessoriesAdmin,
});

const CATEGORIES = [
  "Sleeves/Shields",
  "Dados",
  "Marcadores de dano",
  "Moedas",
  "Playmats",
  "Binders",
  "Top Loader",
  "Deck box",
  "Kit jogável",
] as const;

type Accessory = {
  id: string;
  slug?: string | null;
  sku?: string | null;
  tags?: string[];
  title: string;
  description: string | null;
  category: string;
  price_cents: number;
  stock: number;
  images: string[];
  active: boolean;
  sort_order: number;
  variants?: unknown;
};

function AccessoriesAdmin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState<Accessory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Accessory | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) nav({ to: "/auth" });
      else if (!isAdmin) nav({ to: "/" });
    }
  }, [authLoading, user, isAdmin, nav]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("accessories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Accessory[]);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const createNew = async () => {
    const { data, error } = await supabase
      .from("accessories")
      .insert({ title: "Novo acessório", category: CATEGORIES[0], price_cents: 0, stock: 0, images: [], active: false })
      .select("*")
      .single();
    if (error) { toast.error(error.message); return; }
    await load();
    setEditing(data as Accessory);
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este acessório?")) return;
    await supabase.from("accessories").delete().eq("id", id);
    await load();
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((p) => p.id === id);
    const swap = items[idx + dir];
    if (!swap) return;
    await supabase.from("accessories").update({ sort_order: swap.sort_order }).eq("id", id);
    await supabase.from("accessories").update({ sort_order: items[idx].sort_order }).eq("id", swap.id);
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
          <h1 className="text-2xl font-bold">Acessórios</h1>
          <button
            onClick={createNew}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Novo acessório
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum acessório cadastrado.</p>
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
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.category} · R$ {(p.price_cents / 100).toFixed(2)} · Estoque: {p.stock} · {p.images.length} foto(s)
                    {parseVariants(p.variants).length > 0 && ` · ${parseVariants(p.variants).length} variação(ões)`}
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
        <AccessoryEditor
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { await load(); setEditing(null); }}
        />
      )}
    </div>
  );
}

