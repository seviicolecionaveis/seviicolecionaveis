import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { useCardsCatalog, cardCreatedAt } from "@/hooks/useCardsCatalog";
import { useRecentProducts } from "@/hooks/useRecentProducts";
import { CardItem } from "./CardItem";
import { CardModal } from "./CardModal";
import { OtherProductTile } from "./OtherProductTile";
import { SealedModal, type Sealed } from "./SealedModal";
import { PanelModal, type Panel } from "./PanelModal";
import { AccessoryModal, type Accessory } from "./AccessoryModal";
import type { Card } from "@/data/cards";

interface Props {
  /** Show items added within the last N days. Default 21. */
  windowDays?: number;
  /** Max items to show. Default 12. */
  limit?: number;
}

type Entry =
  | { kind: "card"; t: number; card: Card }
  | { kind: "panel"; t: number; panel: Parameters<typeof PanelModal>[0]["panel"] & object }
  | { kind: "sealed"; t: number; sealed: Sealed }
  | { kind: "accessory"; t: number; accessory: Accessory };

export function NewArrivals({ windowDays = 21, limit = 12 }: Props) {
  const { cards } = useCardsCatalog();
  const { entries: productEntries } = useRecentProducts(windowDays);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [activePanel, setActivePanel] = useState<Panel | null>(null);
  const [activeSealed, setActiveSealed] = useState<Sealed | null>(null);
  const [activeAccessory, setActiveAccessory] = useState<Accessory | null>(null);

  const items = useMemo<Entry[]>(() => {
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const cardEntries: Entry[] = cards
      .map((c): Entry | null => {
        const ts = cardCreatedAt.get(c.id);
        if (!ts) return null;
        const t = new Date(ts).getTime();
        if (t < cutoff || c.stock <= 0) return null;
        return { kind: "card", t, card: c };
      })
      .filter((x): x is Entry => x !== null);
    const all = [...cardEntries, ...productEntries];
    all.sort((a, b) => b.t - a.t);
    return all.slice(0, limit);
  }, [cards, productEntries, windowDays, limit]);

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
              <OtherProductTile
                key={`${entry.kind}-${entry.kind === "panel" ? entry.panel.id : entry.kind === "sealed" ? entry.sealed.id : entry.accessory.id}`}
                entry={entry}
                onClick={() => {
                  if (entry.kind === "panel") setActivePanel(entry.panel);
                  else if (entry.kind === "sealed") setActiveSealed(entry.sealed);
                  else setActiveAccessory(entry.accessory);
                }}
              />
            )
          )}
        </div>
        <div className="mt-8 flex justify-center">
          <Link
            to="/novidades"
            className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: "#20a5c9" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1b8eae")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#20a5c9")}
          >
            Ver todas as novidades
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <CardModal card={activeCard} onClose={() => setActiveCard(null)} />
      <PanelModal panel={activePanel} onClose={() => setActivePanel(null)} />
      <SealedModal item={activeSealed} onClose={() => setActiveSealed(null)} />
      <AccessoryModal item={activeAccessory} onClose={() => setActiveAccessory(null)} />
    </section>
  );
}
