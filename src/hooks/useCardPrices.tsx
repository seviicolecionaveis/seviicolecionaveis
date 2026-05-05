import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CardPriceLookup {
  // key: `${cardName}__${collection}__${number}__${finish}__${language}`
  prices: Map<string, number>;
  loading: boolean;
  refresh: () => Promise<void>;
}

let cache: Map<string, number> | null = null;
let inFlight: Promise<Map<string, number>> | null = null;
const listeners = new Set<(m: Map<string, number>) => void>();

export function priceLookupKey(
  name: string,
  collection: string,
  number: string,
  finish: string,
  language: string,
) {
  return `${name}__${collection}__${number}__${finish}__${language}`;
}

async function loadPrices(): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("card_prices")
    .select("card_name, collection, card_number, finish, language, price_cents");
  if (error) {
    console.error("loadPrices", error);
    return new Map();
  }
  const map = new Map<string, number>();
  for (const row of data ?? []) {
    if (row.price_cents == null) continue;
    map.set(
      priceLookupKey(
        row.card_name as string,
        row.collection as string,
        row.card_number as string,
        row.finish as string,
        row.language as string,
      ),
      row.price_cents as number,
    );
  }
  return map;
}

async function refreshPrices(): Promise<Map<string, number>> {
  if (!inFlight) {
    inFlight = loadPrices().then((m) => {
      cache = m;
      listeners.forEach((l) => l(m));
      return m;
    }).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export function useCardPrices(): CardPriceLookup {
  const [prices, setPrices] = useState<Map<string, number>>(cache ?? new Map());
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let mounted = true;
    const listener = (m: Map<string, number>) => mounted && setPrices(m);
    listeners.add(listener);
    if (!cache) {
      refreshPrices().then((m) => {
        if (mounted) {
          setPrices(m);
          setLoading(false);
        }
      });
    }
    return () => {
      mounted = false;
      listeners.delete(listener);
    };
  }, []);

  return {
    prices,
    loading,
    refresh: async () => {
      setLoading(true);
      const m = await refreshPrices();
      setPrices(m);
      setLoading(false);
    },
  };
}
