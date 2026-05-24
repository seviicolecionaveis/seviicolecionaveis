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
    .select("card_id, quantity, finish, card_name, collection, card_number")
    .eq("order_id", orderId);

  if (items) {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const it of items) {
      // Magnet (Ímã) is a virtual finish — decrement from the underlying base
      // Foil/Normal cards (Foil first, then Normal) matching name/collection/number.
      if (it.finish === "Ímã") {
        let remaining = it.quantity;
        const { data: bases } = await supabaseAdmin
          .from("cards")
          .select("id, stock, finish")
          .eq("name", it.card_name)
          .eq("collection", it.collection ?? "")
          .eq("card_number", it.card_number ?? "")
          .in("finish", ["Foil", "Normal"]);
        const ordered = (bases ?? []).sort((a, b) => {
          if (a.finish === b.finish) return (b.stock ?? 0) - (a.stock ?? 0);
          return a.finish === "Foil" ? -1 : 1;
        });
        for (const b of ordered) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, b.stock ?? 0);
          if (take <= 0) continue;
          await supabaseAdmin
            .from("cards")
            .update({ stock: (b.stock ?? 0) - take })
            .eq("id", b.id);
          remaining -= take;
        }
        continue;
      }
      if (!it.card_id || !UUID_RE.test(it.card_id)) continue; // other virtual product
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

  // Compra etiqueta Superfrete automaticamente (best-effort)
  try {
    const { purchaseShippingLabel } = await import("@/lib/superfrete-label.server");
    await purchaseShippingLabel(orderId);
  } catch (e) {
    console.error("[markOrderPaid] purchaseShippingLabel falhou:", e);
  }

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
