import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useCardsCatalog, cardCreatedAt } from "@/hooks/useCardsCatalog";
import { CardItem } from "./CardItem";
import { CardModal } from "./CardModal";
import { type Sealed } from "./SealedModal";
import { supabase } from "@/integrations/supabase/client";
import { sealedSlug } from "@/lib/slug";
import type { Card } from "@/data/cards";


interface Props {
  /** Show items added within the last N days. Default 21. */
  windowDays?: number;
  /** Max items to show. Default 12. */
  limit?: number;
}

type Entry =
  | { kind: "card"; t: number; card: Card }
  | { kind: "sealed"; t: number; sealed: Sealed };

export function NewArrivals({ windowDays = 21, limit = 12 }: Props) {
  const { cards } = useCardsCatalog();
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [activeSealed, setActiveSealed] = useState<Sealed | null>(null);
  const [sealed, setSealed] = useState<Array<Sealed & { created_at: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("sealed_products")
        .select("id, title, description, price_cents, stock, images, is_preorder, release_date, product_type, collection, language, distribution, condition, age_rating, sku, created_at")
        .eq("active", true)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false });
      if (!cancelled) setSealed((data ?? []) as Array<Sealed & { created_at: string }>);
    })();
    return () => { cancelled = true; };
  }, [windowDays]);

  const items = useMemo<Entry[]>(() => {
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const cardEntries = cards
      .map((c): Entry | null => {
        const ts = cardCreatedAt.get(c.id);
        if (!ts) return null;
        const t = new Date(ts).getTime();
        if (t < cutoff || c.stock <= 0) return null;
        return { kind: "card", t, card: c };
      })
      .filter((x): x is Entry => x !== null);
    const sealedEntries: Entry[] = sealed
      .filter((s) => (s.stock > 0 || s.is_preorder))
      .map((s) => ({ kind: "sealed", t: new Date(s.created_at).getTime(), sealed: s }));
    const all = [...cardEntries, ...sealedEntries];
    all.sort((a, b) => b.t - a.t);
    return all.slice(0, limit);
  }, [cards, sealed, windowDays, limit]);

  if (items.length < 4) return null;

  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-gold" />
            <h2 className="text-sm font-bold uppercase tracking-widest">
              Chegaram agora
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Adicionados nas últimas {windowDays >= 7 ? `${Math.round(windowDays / 7)} semanas` : `${windowDays} dias`}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-4 lg:grid-cols-6">
          {items.map((entry) =>
            entry.kind === "card" ? (
              <CardItem
                key={`c-${entry.card.id}`}
                card={entry.card}
                onClick={() => setActiveCard(entry.card)}
              />
            ) : (
              <button
                key={`s-${entry.sealed.id}`}
                onClick={() => setActiveSealed(entry.sealed)}
                className="group text-left"
              >
                <div className="relative aspect-square overflow-hidden rounded-lg bg-secondary">
                  {entry.sealed.images[0] ? (
                    <img
                      src={entry.sealed.images[0]}
                      alt={entry.sealed.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
                      Sem imagem
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded bg-brand-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background shadow">
                    Lacrado
                  </span>
                  {entry.sealed.is_preorder && (
                    <span className="absolute right-2 top-2 rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow">
                      Pré-venda
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm font-semibold line-clamp-2">{entry.sealed.title}</p>
                <p className="text-sm text-muted-foreground">
                  R$ {(entry.sealed.price_cents / 100).toFixed(2).replace(".", ",")}
                </p>
              </button>
            )
          )}
        </div>
      </div>
      <CardModal card={activeCard} onClose={() => setActiveCard(null)} />
      <SealedModal item={activeSealed} onClose={() => setActiveSealed(null)} />
    </section>
  );
}
