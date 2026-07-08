import { supabaseAdmin } from "@/integrations/supabase/client.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function isAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

export async function restoreStockIfPaid(orderId: string, statusBefore: string) {
  // Restaura estoque para qualquer pedido cujo estoque foi decrementado (flag na tabela).
  // Se a flag ainda não estiver setada (pedidos antigos), o parâmetro `statusBefore`
  // serve de fallback: qualquer status pós-pagamento indica que o estoque foi baixado.
  const { data: orderRow } = await supabaseAdmin
    .from("orders")
    .select("stock_decremented")
    .eq("id", orderId)
    .maybeSingle();
  const wasDecremented =
    (orderRow as any)?.stock_decremented === true ||
    ["paid", "preparing", "shipped", "awaiting_pickup", "delivered"].includes(statusBefore);
  if (!wasDecremented) return;

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("card_id, quantity, cancelled_quantity, card_name, collection, card_number, finish")
    .eq("order_id", orderId);
  if (!items) return;
  const UUID_RE_LOCAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const it of items as any[]) {
    // Só devolve a quantidade que ainda não foi cancelada individualmente.
    const remaining = Math.max(0, (it.quantity ?? 0) - (it.cancelled_quantity ?? 0));
    if (remaining <= 0) continue;
    const cardId: string | null = it.card_id ?? null;

    if (typeof cardId === "string" && cardId.startsWith("panel:")) {
      const pid = cardId.slice("panel:".length);
      if (UUID_RE_LOCAL.test(pid)) {
        const { data: p } = await supabaseAdmin.from("panels").select("stock").eq("id", pid).maybeSingle();
        if (p) await supabaseAdmin.from("panels").update({ stock: (p.stock ?? 0) + remaining }).eq("id", pid);
      }
      continue;
    }
    if (typeof cardId === "string" && cardId.startsWith("sealed:")) {
      const sid = cardId.slice("sealed:".length);
      if (UUID_RE_LOCAL.test(sid)) {
        const { data: s } = await supabaseAdmin.from("sealed_products").select("stock").eq("id", sid).maybeSingle();
        if (s) await supabaseAdmin.from("sealed_products").update({ stock: (s.stock ?? 0) + remaining }).eq("id", sid);
      }
      continue;
    }
    if (typeof cardId === "string" && cardId.startsWith("accessory:")) {
      const aid = cardId.slice("accessory:".length);
      if (UUID_RE_LOCAL.test(aid)) {
        const { data: a } = await supabaseAdmin.from("accessories").select("stock").eq("id", aid).maybeSingle();
        if (a) await supabaseAdmin.from("accessories").update({ stock: (a.stock ?? 0) + remaining }).eq("id", aid);
      }
      continue;
    }
    if (typeof cardId === "string" && cardId.startsWith("videogame:")) {
      const vid = cardId.slice("videogame:".length);
      if (UUID_RE_LOCAL.test(vid)) {
        const { data: v } = await supabaseAdmin.from("videogames").select("stock").eq("id", vid).maybeSingle();
        if (v) await supabaseAdmin.from("videogames").update({ stock: (v.stock ?? 0) + remaining }).eq("id", vid);
      }
      continue;
    }
    if (!cardId || !UUID_RE_LOCAL.test(cardId)) continue;
    const { data: card } = await supabaseAdmin
      .from("cards")
      .select("stock")
      .eq("id", cardId)
      .maybeSingle();
    if (card) {
      await supabaseAdmin
        .from("cards")
        .update({ stock: (card.stock ?? 0) + remaining })
        .eq("id", cardId);
    }
  }

  // Marca como não-decrementado para evitar restauração dupla se a função for chamada novamente.
  await supabaseAdmin
    .from("orders")
    .update({ stock_decremented: false })
    .eq("id", orderId);
}

export async function getOrderById(orderId: string, fields: string) {
  const { data } = await supabaseAdmin
    .from("orders")
    .select(fields)
    .eq("id", orderId)
    .maybeSingle();
  return data as any;
}

export async function updateOrder(orderId: string, patch: Record<string, any>) {
  await supabaseAdmin
    .from("orders")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", orderId);
}

export async function deleteStockReservations(orderId: string) {
  await supabaseAdmin.from("stock_reservations").delete().eq("order_id", orderId);
}
