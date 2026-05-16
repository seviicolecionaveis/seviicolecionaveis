import { useMemo, useState } from "react";
import { useCardsCatalog } from "@/hooks/useCardsCatalog";
import type { Card } from "@/data/cards";
import { CardItem } from "./CardItem";
import { CardModal } from "./CardModal";
import { Sparkles } from "lucide-react";

interface Props {
  card: Card;
  limit?: number;
}

export function RelatedCards({ card, limit = 6 }: Props) {
  const { cards } = useCardsCatalog();
  const [active, setActive] = useState<Card | null>(null);

  const related = useMemo(() => {
    if (!cards.length) return [];
    const sameCollection = cards.filter(
      (c) => c.id !== card.id && c.collection === card.collection && c.stock > 0,
    );
    const pool = sameCollection.length >= limit
      ? sameCollection
      : [
          ...sameCollection,
          ...cards.filter(
            (c) =>
              c.id !== card.id &&
              c.category === card.category &&
              c.collection !== card.collection &&
              c.stock > 0,
          ),
        ];
    // Shuffle deterministically based on card id for stable order
    const seed = card.id.split("").reduce((s, ch) => s + ch.charCodeAt(0), 0);
    return [...pool]
      .sort((a, b) => {
        const ha = (a.id.charCodeAt(0) + seed) % 97;
        const hb = (b.id.charCodeAt(0) + seed) % 97;
        return ha - hb;
      })
      .slice(0, limit);
  }, [cards, card, limit]);

  if (related.length === 0) return null;

  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-gold" />
          <h2 className="text-sm font-bold uppercase tracking-widest">
            Quem viu essa também viu
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-4 lg:grid-cols-6">
          {related.map((c) => (
            <CardItem key={c.id} card={c} onClick={() => setActive(c)} />
          ))}
        </div>
      </div>
      <CardModal card={active} onClose={() => setActive(null)} />
    </section>
  );
}
