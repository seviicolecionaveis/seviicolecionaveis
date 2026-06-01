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
  // Qualquer status pós-pagamento já teve estoque decrementado e precisa ser devolvido ao cancelar.
  if (!["paid", "preparing", "shipped", "delivered"].includes(statusBefore)) return;
  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("card_id, quantity")
    .eq("order_id", orderId);
  if (!items) return;
  for (const it of items) {
    if (!it.card_id || !UUID_RE.test(it.card_id)) continue;
    const { data: card } = await supabaseAdmin
      .from("cards")
      .select("stock")
      .eq("id", it.card_id)
      .maybeSingle();
    if (card) {
      await supabaseAdmin
        .from("cards")
        .update({ stock: (card.stock ?? 0) + it.quantity })
        .eq("id", it.card_id);
    }
  }
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
