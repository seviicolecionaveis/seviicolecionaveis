import { supabase } from "@/integrations/supabase/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VIEW_THROTTLE_MS = 6 * 60 * 60 * 1000; // 6h por carta
const viewCache = new Map<string, number>();

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function trackCardInterestView(cardId: string) {
  if (!UUID_RE.test(cardId)) return;
  const now = Date.now();
  const last = viewCache.get(cardId) ?? 0;
  if (now - last < VIEW_THROTTLE_MS) return;
  viewCache.set(cardId, now);
  const userId = await currentUserId();
  if (!userId) return;
  try {
    await (supabase as any)
      .from("card_interest")
      .upsert(
        { user_id: userId, card_id: cardId, source: "view", last_seen_at: new Date().toISOString() },
        { onConflict: "user_id,card_id,source" },
      );
  } catch {}
}

export async function trackCardInterestCart(cardId: string) {
  if (!UUID_RE.test(cardId)) return;
  const userId = await currentUserId();
  if (!userId) return;
  try {
    await (supabase as any)
      .from("card_interest")
      .upsert(
        { user_id: userId, card_id: cardId, source: "cart", last_seen_at: new Date().toISOString() },
        { onConflict: "user_id,card_id,source" },
      );
  } catch {}
}

export async function removeCardInterestCart(cardId: string) {
  if (!UUID_RE.test(cardId)) return;
  const userId = await currentUserId();
  if (!userId) return;
  try {
    await (supabase as any)
      .from("card_interest")
      .delete()
      .eq("user_id", userId)
      .eq("card_id", cardId)
      .eq("source", "cart");
  } catch {}
}
