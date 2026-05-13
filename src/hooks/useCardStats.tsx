import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  views: Map<string, number>;
  sales: Map<string, number>;
}

let cache: Stats | null = null;
let inFlight: Promise<Stats> | null = null;
const listeners = new Set<(s: Stats) => void>();

async function load(): Promise<Stats> {
  const views = new Map<string, number>();
  const sales = new Map<string, number>();

  const [viewsRes, salesRes] = await Promise.all([
    supabase.from("card_stats").select("card_key, views"),
    supabase
      .from("order_items")
      .select("card_name, collection, card_number, quantity"),
  ]);

  for (const r of viewsRes.data ?? []) {
    views.set(r.card_key as string, (r.views as number) ?? 0);
  }
  for (const r of salesRes.data ?? []) {
    const key = `${r.card_name}__${r.collection}__${r.card_number}`;
    sales.set(key, (sales.get(key) ?? 0) + ((r.quantity as number) ?? 0));
  }
  return { views, sales };
}

function refresh(): Promise<Stats> {
  if (!inFlight) {
    inFlight = load()
      .then((s) => {
        cache = s;
        listeners.forEach((l) => l(s));
        return s;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export function useCardStats() {
  const [stats, setStats] = useState<Stats>(
    cache ?? { views: new Map(), sales: new Map() },
  );

  useEffect(() => {
    let mounted = true;
    const l = (s: Stats) => mounted && setStats(s);
    listeners.add(l);
    if (!cache) refresh();
    return () => {
      mounted = false;
      listeners.delete(l);
    };
  }, []);

  return stats;
}

export async function trackCardView(cardKey: string) {
  try {
    await supabase.rpc("increment_card_view", { _card_key: cardKey });
  } catch (e) {
    console.warn("trackCardView failed", e);
  }
}
