import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PriceDrop {
  previousCents: number;
  currentCents: number;
  droppedAt: string;
  percent: number;
}

// Show badge for 14 days after the drop
const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

let cache: Map<string, PriceDrop> | null = null;
let inFlight: Promise<Map<string, PriceDrop>> | null = null;
const listeners = new Set<(m: Map<string, PriceDrop>) => void>();

async function load(): Promise<Map<string, PriceDrop>> {
  const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("card_price_watch")
    .select("card_id, last_min_price_cents, previous_min_price_cents, price_dropped_at")
    .not("price_dropped_at", "is", null)
    .gte("price_dropped_at", cutoff);
  const map = new Map<string, PriceDrop>();
  if (error) {
    console.error("usePriceDrops load", error);
    return map;
  }
  for (const row of data ?? []) {
    const prev = (row as any).previous_min_price_cents as number | null;
    const cur = (row as any).last_min_price_cents as number | null;
    const at = (row as any).price_dropped_at as string | null;
    if (prev == null || cur == null || at == null) continue;
    if (cur >= prev) continue;
    map.set((row as any).card_id as string, {
      previousCents: prev,
      currentCents: cur,
      droppedAt: at,
      percent: Math.round(((prev - cur) / prev) * 100),
    });
  }
  return map;
}

function refresh() {
  if (!inFlight) {
    inFlight = load()
      .then((m) => {
        cache = m;
        listeners.forEach((l) => l(m));
        return m;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export function usePriceDrops() {
  const [drops, setDrops] = useState<Map<string, PriceDrop>>(cache ?? new Map());
  useEffect(() => {
    const l = (m: Map<string, PriceDrop>) => setDrops(m);
    listeners.add(l);
    if (!cache) refresh();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return drops;
}
