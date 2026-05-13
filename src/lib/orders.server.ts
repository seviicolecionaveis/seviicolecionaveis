import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function markOrderPaid(orderId: string, paymentRef?: { stripePaymentIntent?: string; mercadopagoPaymentId?: string }) {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;
  if (order.status === "paid") return;

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("card_id, quantity")
    .eq("order_id", orderId);

  if (items) {
    for (const it of items) {
      const { data: card } = await supabaseAdmin
        .from("cards")
        .select("stock")
        .eq("id", it.card_id)
        .maybeSingle();
      if (card) {
        const newStock = Math.max(0, (card.stock ?? 0) - it.quantity);
        await supabaseAdmin.from("cards").update({ stock: newStock }).eq("id", it.card_id);
      }
    }
  }

  await supabaseAdmin.from("stock_reservations").delete().eq("order_id", orderId);

  const update: Record<string, unknown> = {
    status: "paid",
    updated_at: new Date().toISOString(),
  };
  if (paymentRef?.stripePaymentIntent) update.stripe_payment_intent = paymentRef.stripePaymentIntent;
  if (paymentRef?.mercadopagoPaymentId) update.mercadopago_payment_id = paymentRef.mercadopagoPaymentId;

  await supabaseAdmin.from("orders").update(update).eq("id", orderId);
}

export async function cancelOrder(orderId: string) {
  await supabaseAdmin.from("stock_reservations").delete().eq("order_id", orderId);
  await supabaseAdmin
    .from("orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "pending");
}
