import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { canGroupOrder } from "./fulfillment-groups";

/** Persist only explicit checkout choices; notification remains in the paid-order pipeline. */
export async function applyCheckoutFulfillment(orderId: string, userId: string, data: { shippingMethod: string; schedule?: { kind: string; at: string; eventId?: string | null; orderIds?: string[]; groupId?: string | null } | null; notes?: string | null; address: Record<string, any> }) {
  if (!data.schedule || !data.schedule.orderIds?.length) return;
  const ids = [...new Set([orderId, ...data.schedule.orderIds])];
  const db = supabaseAdmin as any;
  const { data: orders, error } = await db.from("orders").select("*").in("id", ids);
  if (error || orders?.length !== ids.length || orders.some((o: any) => o.user_id !== userId || !canGroupOrder(o))) throw new Error("Os pedidos selecionados mudaram. Confira o agrupamento novamente.");
  const { error: groupError } = await db.rpc("fulfillment_apply", {
    p_ids: ids, p_key: `checkout:${orderId}`, p_existing: data.schedule.groupId ?? null, p_service: null, p_historical: false,
    p_data: { shipping_method: data.shippingMethod, schedule_kind: data.schedule.kind, scheduled_at: data.schedule.at, event_id: data.schedule.eventId ?? null, notes: data.notes ?? null, ...data.address, group_shipping_cents: data.schedule.kind === "delivery" ? 1500 : 0, hand_delivery_fee_status: data.schedule.kind === "delivery" ? "pending" : null },
  });
  if (groupError) throw new Error(groupError.message);
}