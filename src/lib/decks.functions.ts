import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DeckSummary = {
  id: string;
  name: string;
  description: string | null;
  format: string | null;
  is_public: boolean;
  share_token: string;
  card_count: number;
  updated_at: string;
};

export type DeckCardRow = {
  id: string;
  card_id: string;
  quantity: number;
  category: string | null;
  card: {
    id: string;
    name: string;
    collection: string;
    card_number: string;
    image: string;
    base_price_cents: number | null;
    stock: number;
    category: string;
    finish: string;
    language: string;
    condition: string;
  } | null;
};

export type DeckDetail = {
  id: string;
  name: string;
  description: string | null;
  format: string | null;
  is_public: boolean;
  share_token: string;
  cards: DeckCardRow[];
};

export const listMyDecks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DeckSummary[]> => {
    const { data: decks, error } = await context.supabase
      .from("decks")
      .select("id, name, description, format, is_public, share_token, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!decks || decks.length === 0) return [];

    const { data: counts } = await context.supabase
      .from("deck_cards")
      .select("deck_id, quantity")
      .in("deck_id", decks.map((d) => d.id));
    const countMap = new Map<string, number>();
    for (const c of counts ?? []) {
      countMap.set(c.deck_id, (countMap.get(c.deck_id) ?? 0) + (c.quantity ?? 0));
    }
    return decks.map((d) => ({ ...d, card_count: countMap.get(d.id) ?? 0 }));
  });

export const createDeck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name: string; description?: string; format?: string }) => {
    if (!data.name || data.name.trim().length === 0) throw new Error("Nome obrigatório");
    if (data.name.length > 80) throw new Error("Nome muito longo");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: row, error } = await context.supabase
      .from("decks")
      .insert({
        user_id: context.userId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        format: data.format?.trim() || null,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Falha ao criar");
    return { id: row.id };
  });

export const updateDeck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    id: string;
    name?: string;
    description?: string | null;
    format?: string | null;
    is_public?: boolean;
  }) => data)
  .handler(async ({ data, context }) => {
    const patch: {
      name?: string;
      description?: string | null;
      format?: string | null;
      is_public?: boolean;
    } = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.description !== undefined) patch.description = data.description?.toString().trim() || null;
    if (data.format !== undefined) patch.format = data.format?.toString().trim() || null;
    if (data.is_public !== undefined) patch.is_public = data.is_public;
    const { error } = await context.supabase
      .from("decks")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDeck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("decks")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function loadDeckCards(supabase: any, deckId: string): Promise<DeckCardRow[]> {
  const { data: dcs } = await supabase
    .from("deck_cards")
    .select("id, card_id, quantity, category")
    .eq("deck_id", deckId);
  const rows = (dcs ?? []) as Array<{ id: string; card_id: string; quantity: number; category: string | null }>;
  if (rows.length === 0) return [];
  const ids = Array.from(new Set(rows.map((r) => r.card_id)));
  const { data: cards } = await supabase
    .from("cards")
    .select("id, name, collection, card_number, image, base_price_cents, stock, category, finish, language, condition")
    .in("id", ids);
  const map = new Map<string, DeckCardRow["card"]>();
  for (const c of cards ?? []) map.set(c.id, c as any);
  return rows.map((r) => ({ ...r, card: map.get(r.card_id) ?? null }));
}

export const getDeck = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }): Promise<DeckDetail | null> => {
    const { data: deck } = await context.supabase
      .from("decks")
      .select("id, name, description, format, is_public, share_token")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!deck) return null;
    const cards = await loadDeckCards(context.supabase, deck.id);
    return { ...deck, cards };
  });

export const addCardToDeck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { deck_id: string; card_id: string; quantity?: number }) => data)
  .handler(async ({ data, context }) => {
    // ownership check
    const { data: deck } = await context.supabase
      .from("decks")
      .select("id")
      .eq("id", data.deck_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!deck) throw new Error("Deck não encontrado");
    const qty = Math.min(60, Math.max(1, data.quantity ?? 1));
    const { data: existing } = await context.supabase
      .from("deck_cards")
      .select("id, quantity")
      .eq("deck_id", data.deck_id)
      .eq("card_id", data.card_id)
      .maybeSingle();
    if (existing) {
      const newQty = Math.min(60, (existing.quantity ?? 0) + qty);
      const { error } = await context.supabase
        .from("deck_cards")
        .update({ quantity: newQty })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("deck_cards")
        .insert({ deck_id: data.deck_id, card_id: data.card_id, quantity: qty });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const setDeckCardQuantity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { deck_id: string; deck_card_id: string; quantity: number }) => data)
  .handler(async ({ data, context }) => {
    const { data: deck } = await context.supabase
      .from("decks")
      .select("id")
      .eq("id", data.deck_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!deck) throw new Error("Deck não encontrado");
    if (data.quantity <= 0) {
      await context.supabase.from("deck_cards").delete().eq("id", data.deck_card_id);
      return { ok: true };
    }
    const qty = Math.min(60, data.quantity);
    const { error } = await context.supabase
      .from("deck_cards")
      .update({ quantity: qty })
      .eq("id", data.deck_card_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeDeckCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { deck_card_id: string }) => data)
  .handler(async ({ data, context }) => {
    // RLS enforces ownership through deck ownership
    const { error } = await context.supabase
      .from("deck_cards")
      .delete()
      .eq("id", data.deck_card_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateDeck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: src } = await context.supabase
      .from("decks")
      .select("name, description, format")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!src) throw new Error("Deck não encontrado");
    const { data: newDeck, error } = await context.supabase
      .from("decks")
      .insert({
        user_id: context.userId,
        name: `${src.name} (cópia)`,
        description: src.description,
        format: src.format,
      })
      .select("id")
      .single();
    if (error || !newDeck) throw new Error(error?.message ?? "Falha ao duplicar");
    const { data: srcCards } = await context.supabase
      .from("deck_cards")
      .select("card_id, quantity, category")
      .eq("deck_id", data.id);
    if (srcCards && srcCards.length > 0) {
      const rows = srcCards.map((r) => ({
        deck_id: newDeck.id,
        card_id: r.card_id,
        quantity: r.quantity,
        category: r.category,
      }));
      const { error: e2 } = await context.supabase.from("deck_cards").insert(rows);
      if (e2) throw new Error(e2.message);
    }
    return { id: newDeck.id };
  });

export type BulkImportResult = {
  matched: number;
  unmatched: string[];
};

export const bulkImportToDeck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { deck_id: string; entries: Array<{ query: string; quantity: number }> }) => data)
  .handler(async ({ data, context }): Promise<BulkImportResult> => {
    const { data: deck } = await context.supabase
      .from("decks")
      .select("id")
      .eq("id", data.deck_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!deck) throw new Error("Deck não encontrado");

    const unmatched: string[] = [];
    let matched = 0;

    for (const entry of data.entries) {
      const q = entry.query.trim();
      if (!q) continue;
      const qty = Math.min(60, Math.max(1, entry.quantity));
      // Try match: split "Name SET NUM" heuristically
      const parts = q.split(/\s+/);
      let cardRow: { id: string } | null = null;
      // Try last token as number
      const maybeNum = parts[parts.length - 1];
      if (/^\d+[a-z]?$/i.test(maybeNum) && parts.length >= 2) {
        const maybeSet = parts[parts.length - 2];
        const name = parts.slice(0, -2).join(" ");
        const { data: rows } = await context.supabase
          .from("cards")
          .select("id, stock, base_price_cents")
          .ilike("name", `%${name}%`)
          .ilike("collection", `%${maybeSet}%`)
          .eq("card_number", maybeNum)
          .limit(1);
        if (rows && rows.length) cardRow = rows[0];
      }
      if (!cardRow) {
        // Fallback: search by name only, prefer in-stock and cheapest
        const { data: rows } = await context.supabase
          .from("cards")
          .select("id, stock, base_price_cents")
          .ilike("name", `%${q}%`)
          .order("stock", { ascending: false })
          .order("base_price_cents", { ascending: true, nullsFirst: false })
          .limit(1);
        if (rows && rows.length) cardRow = rows[0];
      }
      if (!cardRow) {
        unmatched.push(q);
        continue;
      }
      const { data: existing } = await context.supabase
        .from("deck_cards")
        .select("id, quantity")
        .eq("deck_id", data.deck_id)
        .eq("card_id", cardRow.id)
        .maybeSingle();
      if (existing) {
        await context.supabase
          .from("deck_cards")
          .update({ quantity: Math.min(60, (existing.quantity ?? 0) + qty) })
          .eq("id", existing.id);
      } else {
        await context.supabase
          .from("deck_cards")
          .insert({ deck_id: data.deck_id, card_id: cardRow.id, quantity: qty });
      }
      matched += 1;
    }
    return { matched, unmatched };
  });

export type PublicDeck = {
  name: string;
  description: string | null;
  format: string | null;
  owner_name: string | null;
  cards: DeckCardRow[];
};

export const getPublicDeck = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<PublicDeck | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: deck } = await supabaseAdmin
      .from("decks")
      .select("id, user_id, name, description, format, is_public")
      .eq("share_token", data.token)
      .maybeSingle();
    if (!deck || !deck.is_public) return null;
    const cards = await loadDeckCards(supabaseAdmin, deck.id);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("user_id", deck.user_id)
      .maybeSingle();
    return {
      name: deck.name,
      description: deck.description,
      format: deck.format,
      owner_name: profile?.full_name ?? null,
      cards,
    };
  });

export type SearchResult = {
  id: string;
  name: string;
  collection: string;
  card_number: string;
  image: string;
  base_price_cents: number | null;
  stock: number;
  finish: string;
  language: string;
  condition: string;
};

export const searchCardsForDeck = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { q: string }) => data)
  .handler(async ({ data, context }): Promise<SearchResult[]> => {
    const q = data.q.trim();
    if (q.length < 2) return [];
    const { data: rows } = await context.supabase
      .from("cards")
      .select("id, name, collection, card_number, image, base_price_cents, stock, finish, language, condition")
      .or(`name.ilike.%${q}%,collection.ilike.%${q}%,card_number.ilike.%${q}%`)
      .order("name")
      .limit(40);
    return (rows ?? []) as SearchResult[];
  });
