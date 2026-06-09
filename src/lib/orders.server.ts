import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTransactionalEmailSafe } from "@/lib/email/send.server";

/**
 * Debita o saldo de vale-presente carteira reservado em wallet_deduction_cents.
 * Idempotente: zera o campo após debitar para evitar débito duplo se chamado de novo.
 */
async function applyWalletDeductionForOrder(orderId: string) {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, coupon_code, wallet_deduction_cents")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || !order.coupon_code) return;
  const amount = order.wallet_deduction_cents ?? 0;
  if (amount <= 0) return;

  // Marca como debitado antes de tentar — evita débito duplo se markOrderPaid
  // for chamado novamente (webhook + retorno do front, por exemplo).
  const { data: claimed } = await supabaseAdmin
    .from("orders")
    .update({ wallet_deduction_cents: 0 })
    .eq("id", orderId)
    .eq("wallet_deduction_cents", amount)
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: c } = await supabaseAdmin
      .from("coupons")
      .select("id, balance_cents, used_count, user_id")
      .eq("code", order.coupon_code)
      .maybeSingle();
    if (!c || c.balance_cents == null) return;
    if (c.user_id && c.user_id !== order.user_id) return;
    const newBalance = Math.max(0, c.balance_cents - amount);
    const { data: upd } = await supabaseAdmin
      .from("coupons")
      .update({ balance_cents: newBalance, used_count: c.used_count + 1 })
      .eq("id", c.id)
      .eq("balance_cents", c.balance_cents)
      .select("id")
      .maybeSingle();
    if (upd) return;
  }
}

/**
 * Credita e debita pontos do programa de fidelidade quando um pedido é pago.
 * - Crédito: 10 pontos por R$ 1,00 sobre o subtotal após descontos
 * - Débito: pontos resgatados no checkout (lançados como entrada negativa)
 * Idempotente via índice único (order_id, reason).
 */
async function applyLoyaltyForOrder(orderId: string) {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, subtotal_cents, discount_cents, points_redeemed, points_discount_cents, points_earned")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || !order.user_id) return;

  const { pointsEarnedFromCents } = await import("@/lib/loyalty");
  const base = Math.max(0, (order.subtotal_cents ?? 0) - (order.discount_cents ?? 0));
  const earned = pointsEarnedFromCents(base);

  if (earned > 0 && (order.points_earned ?? 0) === 0) {
    const { error } = await supabaseAdmin.from("loyalty_points_ledger").insert({
      user_id: order.user_id,
      delta: earned,
      reason: "order_earned",
      order_id: order.id,
      description: `Pontos do pedido #${order.id.slice(0, 8)}`,
    });
    if (!error) {
      await supabaseAdmin.from("orders").update({ points_earned: earned }).eq("id", order.id);
    }
  }

  const redeemed = order.points_redeemed ?? 0;
  if (redeemed > 0) {
    await supabaseAdmin.from("loyalty_points_ledger").insert({
      user_id: order.user_id,
      delta: -redeemed,
      reason: "order_redeemed",
      order_id: order.id,
      description: `Resgate no pedido #${order.id.slice(0, 8)}`,
    });
    // duplicado é silenciosamente bloqueado pelo índice único
  }
}

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
      // Accessory (own stock in the accessories table)
      if (typeof it.card_id === "string" && it.card_id.startsWith("accessory:")) {
        const accessoryId = it.card_id.slice("accessory:".length);
        if (UUID_RE.test(accessoryId)) {
          const { data: accessory } = await supabaseAdmin
            .from("accessories")
            .select("stock")
            .eq("id", accessoryId)
            .maybeSingle();
          if (accessory) {
            const newStock = Math.max(0, (accessory.stock ?? 0) - it.quantity);
            await supabaseAdmin.from("accessories").update({ stock: newStock }).eq("id", accessoryId);
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

  // Débito de vale-presente carteira (só agora, quando o pagamento confirma).
  try {
    await applyWalletDeductionForOrder(orderId);
  } catch (e) {
    console.error("[markOrderPaid] applyWalletDeductionForOrder falhou:", e);
  }

  // Programa de Pontos: credita pontos ganhos e debita pontos resgatados.
  try {
    await applyLoyaltyForOrder(orderId);
  } catch (e) {
    console.error("[markOrderPaid] applyLoyaltyForOrder falhou:", e);
  }



  // Lookup do pedido (necessário para decidir Superfrete x Pilha)
  const { data: full } = await supabaseAdmin
    .from("orders")
    .select("id, email, recipient_name, total_cents, user_id, shipping_method, shipping_cost_cents, arte_em_cards_code")
    .eq("id", orderId)
    .maybeSingle();

  if (full?.shipping_method === "card_stack" || full?.shipping_method === "arrange") {
    // Pilha de Cartas (ou entrega "a combinar"): não compra etiqueta;
    // armazena os itens na pilha do cliente para combinar depois.
    try {
      const { addOrderToStack } = await import("@/lib/card-stack.server");
      await addOrderToStack(orderId);
      // Se entrou via "arrange", padroniza o método para card_stack para
      // refletir o destino real do pedido nas listagens.
      if (full.shipping_method === "arrange") {
        await supabaseAdmin
          .from("orders")
          .update({ shipping_method: "card_stack", updated_at: new Date().toISOString() })
          .eq("id", orderId);
      }
    } catch (e) {
      console.error("[markOrderPaid] addOrderToStack falhou:", e);
    }
  } else {
    // Compra etiqueta Superfrete automaticamente (best-effort)
    try {
      const { purchaseShippingLabel } = await import("@/lib/superfrete-label.server");
      await purchaseShippingLabel(orderId);
    } catch (e) {
      console.error("[markOrderPaid] purchaseShippingLabel falhou:", e);
    }
  }

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
      if (full.email) {
        await sendTransactionalEmailSafe({
          templateName: "arte-em-cards-code",
          recipientEmail: full.email,
          idempotencyKey: `arte-em-cards-code-${full.user_id}-${issued.cycleStart.toISOString()}`,
          templateData: {
            recipientName: full.recipient_name?.split(/\s+/)[0],
            code: issued.code,
            cycleEnd: issued.cycleEnd.toISOString(),
          },
        });
      }
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
