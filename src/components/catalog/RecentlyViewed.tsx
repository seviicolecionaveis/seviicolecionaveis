import { useMemo, useState } from "react";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { useCardsCatalog } from "@/hooks/useCardsCatalog";
import { CardItem } from "./CardItem";
import { CardModal } from "./CardModal";
import type { Card } from "@/data/cards";
import { Clock } from "lucide-react";

interface Props {
  /** When set, exclude this card id (e.g. the one currently being viewed). */
  excludeId?: string;
  /** Max items to show. Default 6. */
  limit?: number;
}

export function RecentlyViewed({ excludeId, limit = 6 }: Props) {
  const { ids } = useRecentlyViewed();
  const { cards } = useCardsCatalog();
  const [active, setActive] = useState<Card | null>(null);

  const items = useMemo(() => {
    if (!ids.length || !cards.length) return [];
    const map = new Map(cards.map((c) => [c.id, c] as const));
    return ids
      .filter((id) => id !== excludeId)
      .map((id) => map.get(id))
      .filter((c): c is Card => !!c)
      .slice(0, limit);
  }, [ids, cards, excludeId, limit]);

  if (items.length === 0) return null;

  return (
    <section className="border-t border-border bg-secondary/30">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold uppercase tracking-widest">
            Vistos recentemente
          </h2>
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
