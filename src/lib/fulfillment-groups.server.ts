import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { effectiveFulfillment, canGroupOrder, groupLabel } from "./fulfillment-groups";
import { modalityOfOrder } from "./fulfillment-alerts";
import { scheduleConfirmationData } from "./schedule-confirmation";
import { notifyFulfillmentChange } from "./fulfillment-alerts.server";

export async function notifyGroup(groupId: string, key: string, source: "admin" | "customer" | "auto", notifyClient = true, before?: string | null) {
  const db = supabaseAdmin as any;
  const { data, error } = await db.from("orders").select("*, order_items(card_name,quantity)").eq("fulfillment_group_id", groupId).order("created_at");
  if (error) throw new Error(error.message);
  const rows = (data ?? []).filter(canGroupOrder).map(effectiveFulfillment);
  const first = rows[0];
  if (!first) return;
  const ids = rows.map((o: any) => `#${o.id.slice(0, 8).toUpperCase()}`);
  const scheduled = scheduleConfirmationData(first as any);
  let calendarUrl = scheduled?.calendarUrl ?? null;
  if (calendarUrl) {
    const url = new URL(calendarUrl);
    url.searchParams.set("text", `${scheduled?.service} · ${groupLabel(first, first.service_code)} · ${first.recipient_name ?? "Cliente"}`);
    url.searchParams.set("details", `${url.searchParams.get("details") ?? ""}\nPedidos: ${ids.join(", ")}${before ? `\nAgendamentos substituídos: ${before}` : ""}`);
    url.searchParams.set("ctz", "America/Fortaleza");
    calendarUrl = url.toString();
  }
  const { data: event } = first.event_id ? await db.from("events").select("name").eq("id", first.event_id).maybeSingle() : { data: null };
  await notifyFulfillmentChange({
    targetType: "order", targetId: first.id, code: groupLabel(first, first.service_code), action: source === "auto" ? "cancelled" : before ? "changed" : "defined", source,
    modality: modalityOfOrder(first), customerName: first.recipient_name, customerEmail: first.email, customerPhone: first.phone,
    scheduledAt: first.scheduled_at, when: scheduled?.when, location: scheduled?.address, eventId: first.event_id, eventName: event?.name,
    before, relatedOrders: ids, calendarUrl, notifyClient, dedupeExtra: `group:${groupId}:${key}`,
    items: rows.flatMap((o: any) => (o.order_items ?? []).map((it: any) => `${it.quantity}× ${it.card_name} (${o.id.slice(0, 8)})`)),
    fee: first.group_shipping_cents ? `R$ ${(first.group_shipping_cents / 100).toFixed(2).replace(".", ",")} ${first.hand_delivery_fee_status === "confirmed" ? "(paga)" : ""}` : null,
  });
}

export async function applyGroup(ids: string[], data: Record<string, unknown>, key: string, options?: { serviceId?: string | null; existingId?: string | null; source?: "customer" | "admin"; notifyClient?: boolean }) {
  const db = supabaseAdmin as any;
  const { data: previous, error: readError } = await db.from("orders").select("*").in("id", ids);
  if (readError) throw new Error(readError.message);
  const before = (previous ?? []).map(effectiveFulfillment).filter((o: any) => o.scheduled_at).map((o: any) => `#${o.id.slice(0, 8)}: ${o.schedule_kind} ${o.scheduled_at}`).join("; ");
  const { data: result, error } = await db.rpc("fulfillment_apply", { p_ids: ids, p_data: data, p_key: key, p_service: options?.serviceId ?? null, p_existing: options?.existingId ?? null, p_historical: false });
  if (error) throw new Error(error.message);
  await notifyGroup(result.group_id, key, options?.source ?? "customer", options?.notifyClient !== false, before || null).catch((e: unknown) => console.error("[fulfillment-group] notification", e));
  return result;
}