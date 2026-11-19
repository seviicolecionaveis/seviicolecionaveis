import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyGroup } from "./fulfillment-groups.server";
import { notifyFulfillmentChange } from "./fulfillment-alerts.server";
import { modalityOfOrder } from "./fulfillment-alerts";

/** Store the intent only. Earlier orders must not change until this order is paid. */
export async function saveCheckoutFulfillment(orderId: string, userId: string, data: { shippingMethod: string; schedule?: { kind: string; at: string; eventId?: string | null; orderIds?: string[]; groupId?: string | null } | null; notes?: string | null; address: Record<string, any> }) {
  if (!data.schedule || !data.schedule.orderIds?.length) return;
  const db = supabaseAdmin as any;
  const { error } = await db.rpc("save_checkout_fulfillment_intent", {
    p_order: orderId, p_user: userId, p_ids: [...new Set(data.schedule.orderIds)], p_existing: data.schedule.groupId ?? null,
    p_choice: { shipping_method: data.shippingMethod, schedule_kind: data.schedule.kind, scheduled_at: data.schedule.at, event_id: data.schedule.eventId ?? null, notes: data.notes ?? null, ...data.address, group_shipping_cents: data.schedule.kind === "delivery" ? 1500 : 0, hand_delivery_fee_status: data.schedule.kind === "delivery" ? "pending" : null },
  });
  if (error) throw new Error("Os pedidos selecionados mudaram. Confira o agrupamento novamente.");
}

/** Safe to retry independently of stock/payment settlement; RPC applies once under a lock. */
export async function processPaidCheckoutFulfillment(orderId: string, notifyClient = true): Promise<boolean> {
  const db = supabaseAdmin as any;
  try {
    const { data: result, error } = await db.rpc("process_checkout_fulfillment_intent", { p_order: orderId });
    if (error) throw new Error(error.message);
    if (!result || result.state === "none") return false;
    if (result.notified_at) return true;
    if (result.state === "applied" && result.group_id) {
      await notifyGroup(result.group_id, `checkout:${orderId}`, "customer", notifyClient, result.previous_schedules);
    } else if (result.state === "needs_review") {
      const { data: order, error: readError } = await db.from("orders").select("id,email,recipient_name,phone,shipping_method,schedule_kind").eq("id", orderId).maybeSingle();
      if (readError) throw new Error(readError.message);
      if (!order) return true;
      await notifyFulfillmentChange({
        targetType: "order", targetId: orderId, code: `#${orderId.slice(0, 8).toUpperCase()}`,
        action: "needs_review", source: "auto", modality: modalityOfOrder(order),
        customerName: order.recipient_name, customerEmail: order.email, customerPhone: order.phone,
        reviewMessage: result.failure_reason, notifyClient, dedupeExtra: `checkout-review:${orderId}`,
      });
    }
    if (result.state === "applied" || result.state === "needs_review") {
      const { error: notificationError } = await db.from("checkout_fulfillment_intents").update({ notified_at: new Date().toISOString() }).eq("order_id", orderId);
      if (notificationError) throw new Error(notificationError.message);
    }
    return true;
  } catch (error) {
    // Do not repeat stock/payment work or send a false schedule confirmation on a transient failure.
    console.error("[checkout-fulfillment] processing will retry on payment reconciliation", error);
    return true;
  }
}

/** Bounded cron recovery: never settles payments or touches unpaid orders. */
export async function retryPaidCheckoutFulfillment() {
  const db = supabaseAdmin as any;
  const { data, error } = await db.from("checkout_fulfillment_intents")
    .select("order_id,orders!inner(status)").is("notified_at", null)
    .in("orders.status", ["paid", "preparing", "separated", "awaiting_pickup", "cards_pending_delivery"])
    .order("created_at").limit(50);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) await processPaidCheckoutFulfillment(row.order_id);
  return (data ?? []).length;
}