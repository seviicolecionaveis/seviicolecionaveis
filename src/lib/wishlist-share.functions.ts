import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function randomToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const getMyShareToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("wishlist_share_tokens")
      .select("token, created_at, revoked_at")
      .eq("user_id", context.userId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { token: data?.token ?? null };
  });

export const createShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Revoke previous active tokens
    await context.supabase
      .from("wishlist_share_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("revoked_at", null);

    const token = randomToken();
    const { error } = await context.supabase
      .from("wishlist_share_tokens")
      .insert({ user_id: context.userId, token });
    if (error) throw new Error(error.message);
    return { token };
  });

export const revokeShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("wishlist_share_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("revoked_at", null);
    return { ok: true };
  });

export type SharedWishlistCard = {
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

export const getSharedWishlist = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<{
    ownerName: string | null;
    cards: SharedWishlistCard[];
  } | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tokenRow } = await supabaseAdmin
      .from("wishlist_share_tokens")
      .select("user_id, revoked_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!tokenRow || tokenRow.revoked_at) return null;

    const [{ data: wl }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("wishlist")
        .select("card_key")
        .eq("user_id", tokenRow.user_id),
      supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("user_id", tokenRow.user_id)
        .maybeSingle(),
    ]);

    const cardIds = (wl ?? []).map((r) => r.card_key);
    if (cardIds.length === 0) {
      return { ownerName: profile?.full_name ?? null, cards: [] };
    }

    const { data: cards } = await supabaseAdmin
      .from("cards")
      .select("id, name, collection, card_number, image, base_price_cents, stock, finish, language, condition")
      .in("id", cardIds);

    return {
      ownerName: profile?.full_name ?? null,
      cards: (cards ?? []) as SharedWishlistCard[],
    };
  });
