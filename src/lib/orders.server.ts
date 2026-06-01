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
      // Panel (virtual product with its own stock in the panels table)
      if (typeof it.card_id === "string" && it.card_id.startsWith("panel:")) {
        const panelId = it.card_id.slice("panel:".length);
        if (UUID_RE.test(panelId)) {
          const { data: panel } = await supabaseAdmin
            .from("panels")
            .select("stock")
            .eq("id", panelId)
            .maybeSingle();
          if (panel) {
            const newStock = Math.max(0, (panel.stock ?? 0) - it.quantity);
            await supabaseAdmin.from("panels").update({ stock: newStock }).eq("id", panelId);
          }
        }
        continue;
      }
      // Sealed product (own stock in the sealed_products table)
      if (typeof it.card_id === "string" && it.card_id.startsWith("sealed:")) {
        const sealedId = it.card_id.slice("sealed:".length);
        if (UUID_RE.test(sealedId)) {
          const { data: sealed } = await supabaseAdmin
            .from("sealed_products")
            .select("stock")
            .eq("id", sealedId)
            .maybeSingle();
          if (sealed) {
            const newStock = Math.max(0, (sealed.stock ?? 0) - it.quantity);
            await supabaseAdmin.from("sealed_products").update({ stock: newStock }).eq("id", sealedId);
          }
        }
        continue;
      }
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
    .select("id, email, recipient_name, total_cents, user_id, shipping_method, shipping_cost_cents, arte_em_cards_code")
    .eq("id", orderId)
    .maybeSingle();

  // Garante código Arte em Cards quando o pedido pagou a taxa semanal
  // e ainda não usou um código existente.
  if (
    full?.shipping_method === "arte_em_cards" &&
    full.user_id &&
    !full.arte_em_cards_code &&
    (full.shipping_cost_cents ?? 0) > 0
  ) {
    try {
      const { ensureCodeForUser } = await import("@/lib/arte-em-cards.server");
      const issued = await ensureCodeForUser(full.user_id);
      await supabaseAdmin
        .from("orders")
        .update({ arte_em_cards_code: issued.code })
        .eq("id", orderId);
    } catch (e) {
      console.error("[markOrderPaid] ensureCodeForUser falhou:", e);
    }
  }

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
