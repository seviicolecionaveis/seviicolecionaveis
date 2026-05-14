import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTransactionalEmailSafe } from "@/lib/email/send.server";

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
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const it of items) {
      if (!it.card_id || !UUID_RE.test(it.card_id)) continue; // virtual product (e.g. Ímã)
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

  await supabaseAdmin
    .from("orders")
    .update({
      status: "paid",
      updated_at: new Date().toISOString(),
      ...(paymentRef?.stripePaymentIntent
        ? { stripe_payment_intent: paymentRef.stripePaymentIntent }
        : {}),
      ...(paymentRef?.mercadopagoPaymentId
        ? { mercadopago_payment_id: paymentRef.mercadopagoPaymentId }
        : {}),
    })
    .eq("id", orderId);

  // Send "payment confirmed" email (fire-and-forget)
  const { data: full } = await supabaseAdmin
    .from("orders")
    .select("id, email, recipient_name, total_cents")
    .eq("id", orderId)
    .maybeSingle();
  if (full?.email) {
    await sendTransactionalEmailSafe({
      templateName: "payment-confirmed",
      recipientEmail: full.email,
      idempotencyKey: `payment-confirmed-${full.id}`,
      templateData: {
        recipientName: full.recipient_name?.split(/\s+/)[0],
        orderId: full.id,
        totalCents: full.total_cents,
      },
    });
  }
}

export async function cancelOrder(orderId: string) {
  await supabaseAdmin.from("stock_reservations").delete().eq("order_id", orderId);
  await supabaseAdmin
    .from("orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "pending");
}
