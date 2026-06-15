import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Flame, Trash2 } from "lucide-react";
import {
  listFlashOffers,
  createFlashOffer,
  setFlashOfferActive,
  deleteFlashOffer,
} from "@/lib/flash-offers.functions";

export const Route = createFileRoute("/admin/ofertas-relampago")({
  head: () => ({ meta: [{ title: "Ofertas Relâmpago — Admin" }] }),
  component: AdminFlashOffersPage,
});

interface OfferRow {
  id: string;
  card_id: string;
  discount_percent: number;
  starts_at: string;
  ends_at: string;
  max_uses: number | null;
  uses_count: number;
  active: boolean;
  created_at: string;
  card: { id: string; name: string; collection: string; card_number: string; base_price_cents: number | null } | null;
}

interface CardOpt {
  id: string;
  name: string;
  collection: string;
  card_number: string;
  base_price_cents: number | null;
}

function formatDateTimeLocal(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AdminFlashOffersPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<CardOpt[]>([]);
  const [cardSearch, setCardSearch] = useState("");
  const [form, setForm] = useState({
    cardId: "",
    discountPercent: 15,
    startsAt: formatDateTimeLocal(new Date()),
    endsAt: formatDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    maxUses: "" as string,
  });

  const list = useServerFn(listFlashOffers);
  const create = useServerFn(createFlashOffer);
  const toggle = useServerFn(setFlashOfferActive);
  const del = useServerFn(deleteFlashOffer);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) nav({ to: "/" });
  }, [authLoading, user, isAdmin, nav]);

  const refresh = async () => {
    setLoading(true);
    const r = await list();
    setOffers(r.offers as any);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin]);

  // Load cards for selector
  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("cards")
      .select("id, name, collection, card_number, base_price_cents")
      .order("name")
      .limit(2000)
      .then(({ data }) => {
        if (data) setCards(data as CardOpt[]);
      });
  }, [isAdmin]);

  const filteredCards = useMemo(() => {
    if (!cardSearch) return cards.slice(0, 50);
    const q = cardSearch.toLowerCase();
    return cards
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.collection.toLowerCase().includes(q) ||
          c.card_number.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [cards, cardSearch]);

  const handleCreate = async () => {
    if (!form.cardId) {
      toast.error("Selecione uma carta");
      return;
    }
    const res = await create({
      data: {
        cardId: form.cardId,
        discountPercent: Number(form.discountPercent),
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        maxUses: form.maxUses ? Number(form.maxUses) : null,
      },
    });
    if (res.success) {
      toast.success("Oferta criada");
      setForm({ ...form, cardId: "" });
      setCardSearch("");
      refresh();
    } else {
      toast.error((res as any).error ?? "Erro ao criar oferta");
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    const res = await toggle({ data: { id, active } });
    if (res.success) {
      setOffers((o) => o.map((x) => (x.id === id ? { ...x, active } : x)));
    } else {
      toast.error("Erro ao atualizar");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta oferta?")) return;
    const res = await del({ data: { id } });
    if (res.success) {
      setOffers((o) => o.filter((x) => x.id !== id));
      toast.success("Excluída");
    } else {
      toast.error("Erro ao excluir");
    }
  };

  if (authLoading || !isAdmin) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/admin" className="text-sm font-semibold hover:underline">← Admin</Link>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Flame className="h-5 w-5 text-type-fire" />
            Ofertas Relâmpago
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-8">
        {/* Form */}
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold mb-4">Nova oferta</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label className="text-xs">Buscar carta</Label>
              <Input
                value={cardSearch}
                onChange={(e) => setCardSearch(e.target.value)}
                placeholder="Nome, coleção ou número"
              />
              <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-border divide-y divide-border">
                {filteredCards.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">Nenhuma carta.</p>
                ) : (
                  filteredCards.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setForm({ ...form, cardId: c.id });
                        setCardSearch(`${c.name} • ${c.collection} ${c.card_number}`);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-muted ${
                        form.cardId === c.id ? "bg-muted font-semibold" : ""
                      }`}
                    >
                      {c.name}{" "}
                      <span className="text-muted-foreground">
                        • {c.collection} • {c.card_number}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs">Desconto (%)</Label>
              <Input
                type="number"
                min={1}
                max={90}
                value={form.discountPercent}
                onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs">Máx. usos (opcional)</Label>
              <Input
                type="number"
                min={1}
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                placeholder="ilimitado"
              />
            </div>
            <div>
              <Label className="text-xs">Início</Label>
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Fim</Label>
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleCreate}>Criar oferta</Button>
          </div>
        </section>

        {/* List */}
        <section>
          <h2 className="text-base font-semibold mb-3">Ofertas ({offers.length})</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : offers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma oferta criada.</p>
          ) : (
            <div className="space-y-2">
              {offers.map((o) => {
                const now = Date.now();
                const ended = new Date(o.ends_at).getTime() < now;
                const notStarted = new Date(o.starts_at).getTime() > now;
                return (
                  <div
                    key={o.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <span className="inline-flex items-center gap-1 rounded-full bg-type-fire/10 text-type-fire px-2 py-0.5 text-xs font-bold">
                      <Flame className="h-3 w-3" />-{o.discount_percent}%
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {o.card?.name ?? "?"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {o.card?.collection} • {o.card?.card_number} •{" "}
                        {new Date(o.starts_at).toLocaleString("pt-BR")} →{" "}
                        {new Date(o.ends_at).toLocaleString("pt-BR")}
                        {o.max_uses && ` • ${o.uses_count}/${o.max_uses} usos`}
                      </p>
                    </div>
                    {ended && <span className="text-xs text-muted-foreground">expirada</span>}
                    {notStarted && <span className="text-xs text-muted-foreground">agendada</span>}
                    <Switch
                      checked={o.active}
                      onCheckedChange={(v) => handleToggle(o.id, v)}
                      aria-label="Ativa"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleDelete(o.id)}
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
