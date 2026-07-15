import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getOwnedCardKeysInCollection } from "@/lib/collection-progress.functions";
import { useCart } from "@/hooks/useCart";
import type { Card } from "@/data/cards";

interface Props {
  collection: string;
  cards: Card[];
}

function bestVariant(card: Card) {
  let best: {
    finish: string;
    language: string;
    condition: string;
    price: number;
    stock: number;
  } | null = null;
  for (const lang of card.languages) {
    for (const v of lang.finishes) {
      if (v.stock <= 0 || v.price == null) continue;
      if (!best || v.price < best.price) {
        best = {
          finish: v.finish,
          language: lang.language,
          condition: v.condition,
          price: v.price,
          stock: v.stock,
        };
      }
    }
  }
  return best;
}

export function CollectionCompleteWidget({ collection, cards }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [ownedKeys, setOwnedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fetchOwned = useServerFn(getOwnedCardKeysInCollection);
  const { add, items } = useCart();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setOwnedKeys(new Set());
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchOwned({ data: { collection } })
      .then((r) => {
        if (!cancelled) setOwnedKeys(new Set(r.ownedKeys));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, collection, fetchOwned]);

  const { total, owned, missing } = useMemo(() => {
    const total = cards.length;
    let owned = 0;
    const missing: Card[] = [];
    for (const c of cards) {
      if (ownedKeys.has(c.id)) owned += 1;
      else missing.push(c);
    }
    return { total, owned, missing };
  }, [cards, ownedKeys]);

  const inStockMissing = useMemo(
    () => missing.filter((c) => bestVariant(c) !== null),
    [missing],
  );

  if (!userId || total === 0) return null;

  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;

  const addAllMissing = () => {
    for (const c of inStockMissing) {
      const v = bestVariant(c);
      if (!v) continue;
      const id = `${c.id}|${v.finish}|${v.language}|${v.condition}`;
      // Skip if already in cart
      if (items.some((i) => i.id === id)) continue;
      add({
        id,
        cardId: c.id,
        name: c.name,
        image: c.image,
        collection: c.collection,
        number: c.number,
        finish: v.finish,
        language: v.language,
        condition: v.condition,
        unitPrice: v.price,
        maxStock: v.stock,
      });
    }
  };

  return (
    <div className="mb-8 rounded-lg border border-border bg-secondary/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Complete a coleção
          </p>
          <p className="mt-1 text-sm">
            {loading ? (
              "Calculando seu progresso…"
            ) : (
              <>
                Você tem <strong>{owned}</strong> de <strong>{total}</strong>{" "}
                {total === 1 ? "carta" : "cartas"}{" "}
                <span className="text-muted-foreground">({pct}%)</span>
              </>
            )}
          </p>
        </div>
        {inStockMissing.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs font-semibold uppercase tracking-widest underline"
            >
              {expanded ? "Ocultar faltantes" : `Ver ${missing.length} faltantes`}
            </button>
            <button
              onClick={addAllMissing}
              className="rounded-md bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground hover:opacity-90"
            >
              + {inStockMissing.length} ao carrinho
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-background">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {expanded && missing.length > 0 && (
        <ul className="mt-4 grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {missing.map((c) => {
            const v = bestVariant(c);
            return (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded border border-border/60 bg-background px-2 py-1.5"
              >
                <span className="truncate">
                  #{c.number} — {c.name}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {v ? `R$ ${v.price.toFixed(2)}` : "Esgotado"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
