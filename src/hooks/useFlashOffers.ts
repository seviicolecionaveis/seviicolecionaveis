import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FlashOffer {
  id: string;
  card_id: string;
  discount_percent: number;
  starts_at: string;
  ends_at: string;
  active: boolean;
  card?: {
    id: string;
    name: string;
    collection: string;
    card_number: string;
    image: string;
    base_price_cents: number | null;
  };
}

let cache: Map<string, FlashOffer> | null = null;
let inFlight: Promise<Map<string, FlashOffer>> | null = null;
const listeners = new Set<() => void>();

async function fetchOffers(): Promise<Map<string, FlashOffer>> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("flash_offers" as any)
    .select(`
      id, card_id, discount_percent, starts_at, ends_at, active,
      card:cards(id, name, collection, card_number, image, base_price_cents)
    `)
    .eq("active", true)
    .lte("starts_at", now)
    .gte("ends_at", now);

  const map = new Map<string, FlashOffer>();
  if (!error && data) {
    for (const o of data as any[]) {
      const cardKey = o.card
        ? `${o.card.name}__${o.card.collection}__${o.card.card_number}`
        : null;
      const offer = o as FlashOffer;
      if (cardKey) map.set(cardKey, offer);
      map.set(o.card_id, offer);
    }
  }
  cache = map;
  return map;
}

export function useFlashOffers() {
  const [offers, setOffers] = useState<Map<string, FlashOffer>>(() => cache ?? new Map());
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    const update = () => setOffers(cache ?? new Map());
    listeners.add(update);

    if (!cache) {
      if (!inFlight) {
        inFlight = fetchOffers().finally(() => {
          inFlight = null;
        });
      }
      inFlight.then(() => {
        update();
        setLoading(false);
      });
    } else {
      setLoading(false);
    }

    // Refresh a cada 60s
    const interval = setInterval(() => {
      fetchOffers().then(() => listeners.forEach((l) => l()));
    }, 60_000);

    return () => {
      listeners.delete(update);
      clearInterval(interval);
    };
  }, []);

  return { offers, loading };
}

export function getOfferForCard(
  offers: Map<string, FlashOffer>,
  cardKey: string,
): FlashOffer | undefined {
  return offers.get(cardKey);
}
