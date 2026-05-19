import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useCardsCatalog, cardCreatedAt } from "@/hooks/useCardsCatalog";
import { CardItem } from "./CardItem";
import { CardModal } from "./CardModal";
import type { Card } from "@/data/cards";

interface Props {
  /** Show cards added within the last N days. Default 21. */
  windowDays?: number;
  /** Max items to show. Default 12. */
  limit?: number;
}

export function NewArrivals({ windowDays = 21, limit = 12 }: Props) {
  const { cards } = useCardsCatalog();
  const [active, setActive] = useState<Card | null>(null);

  const items = useMemo(() => {
    if (!cards.length) return [];
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const withDates = cards
      .map((c) => {
        const ts = cardCreatedAt.get(c.id);
        return ts ? { c, t: new Date(ts).getTime() } : null;
      })
      .filter((x): x is { c: Card; t: number } => !!x && x.t >= cutoff && x.c.stock > 0);
    withDates.sort((a, b) => b.t - a.t);
    return withDates.slice(0, limit).map((x) => x.c);
  }, [cards, windowDays, limit]);

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
            Adicionadas nas últimas {windowDays >= 7 ? `${Math.round(windowDays / 7)} semanas` : `${windowDays} dias`}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-4 lg:grid-cols-6">
          {items.map((card) => (
            <CardItem key={card.id} card={card} onClick={() => setActive(card)} />
          ))}
        </div>
      </div>
      <CardModal card={active} onClose={() => setActive(null)} />
    </section>
  );
}
