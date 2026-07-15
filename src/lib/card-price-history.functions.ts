import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type PricePoint = {
  price: number; // in reais
  at: string; // ISO date
};

export type CardPriceHistoryResult = {
  points: PricePoint[];
  current: number | null;
  min: number | null;
  max: number | null;
  ligaPrice: number | null;
  variation30dPercent: number | null;
};

export const getCardPriceHistory = createServerFn({ method: "GET" })
  .inputValidator((data: { cardId: string }) => data)
  .handler(async ({ data }): Promise<CardPriceHistoryResult> => {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const supabase = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    // 1. History (last 180 days, max 200 rows)
    const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    const { data: history } = await supabase
      .from("card_price_history")
      .select("price_cents, recorded_at")
      .eq("card_id", data.cardId)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: true })
      .limit(200);

    const points: PricePoint[] = (history ?? []).map((r) => ({
      price: (r.price_cents ?? 0) / 100,
      at: r.recorded_at as string,
    }));

    // 2. Current base price
    const { data: card } = await supabase
      .from("cards")
      .select("name, collection, card_number, base_price_cents, finish, language")
      .eq("id", data.cardId)
      .maybeSingle();

    const current = card?.base_price_cents != null ? card.base_price_cents / 100 : null;

    // 3. Liga Pokémon price (any finish match for same card_name/collection/number)
    let ligaPrice: number | null = null;
    if (card) {
      const { data: liga } = await supabase
        .from("card_prices")
        .select("price_cents")
        .eq("card_name", card.name)
        .eq("collection", card.collection)
        .eq("card_number", card.card_number)
        .not("price_cents", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (liga?.price_cents != null) ligaPrice = liga.price_cents / 100;
    }

    // 4. Stats
    const prices = points.map((p) => p.price);
    const min = prices.length ? Math.min(...prices) : null;
    const max = prices.length ? Math.max(...prices) : null;

    let variation30dPercent: number | null = null;
    if (points.length >= 2 && current != null) {
      const thirtyAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const oldPoint = [...points].reverse().find((p) => new Date(p.at).getTime() <= thirtyAgo);
      const basis = oldPoint?.price ?? points[0].price;
      if (basis > 0) {
        variation30dPercent = ((current - basis) / basis) * 100;
      }
    }

    return { points, current, min, max, ligaPrice, variation30dPercent };
  });
