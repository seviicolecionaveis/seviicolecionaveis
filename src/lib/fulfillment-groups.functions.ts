import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canGroupOrder, effectiveFulfillment } from "./fulfillment-groups";

export const listFulfillmentCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    let userId = context.userId;
    if (data.orderId) {
      const { data: order, error } = await context.supabase.from("orders").select("user_id").eq("id", data.orderId).maybeSingle();
      if (error || !order) throw new Error("Pedido não encontrado.");
      if (order.user_id !== context.userId) {
        const { data: admin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
        if (!admin) throw new Error("Acesso negado.");
      }
      userId = order.user_id;
    }
    const { data: rows, error } = await context.supabase.from("orders").select("*, order_items(card_name,quantity)").eq("user_id", userId).order("created_at");
    if (error) throw new Error("Não foi possível consultar os pedidos.");
    return (rows ?? []).filter(canGroupOrder).map(effectiveFulfillment);
  });

export const chooseOrderFulfillment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderIds: z.array(z.string().uuid()).min(1).max(500), key: z.string().uuid(), kind: z.enum(["pickup", "event", "delivery"]), at: z.string().datetime(), eventId: z.string().uuid().nullable().optional(), pickupPoint: z.enum(["aruana", "aeroporto"]).optional(), existingId: z.string().uuid().nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("orders").select("*").in("id", data.orderIds).eq("user_id", context.userId);
    if (error || rows?.length !== data.orderIds.length || rows.some((o) => !canGroupOrder(o))) throw new Error("Há pedidos que não podem ser incluídos.");
    const first = rows[0];
    if (!first) throw new Error("Selecione um pedido.");
    const { validateSchedule } = await import("./scheduling");
    let eventName: string | null = null;
    if (data.kind === "event") {
      const { data: ev } = await context.supabase.from("events").select("*").eq("id", data.eventId ?? "").maybeSingle();
      if (!ev) throw new Error("Evento não encontrado.");
      const { validateEventSchedule, ymdOfIso } = await import("./events");
      const { localParts } = await import("./scheduling");
      const err = validateEventSchedule({ ...ev, start_time: String(ev.start_time).slice(0, 5), end_time: String(ev.end_time).slice(0, 5), per_day_times: ev.per_day_times as any }, ymdOfIso(data.at), localParts(data.at).time);
      if (err) throw new Error(err);
      eventName = ev.name;
    } else {
      const err = validateSchedule(data.kind, data.at);
      if (err) throw new Error(err);
    }
    let address: any = first;
    if (data.kind === "delivery") {
      const { data: saved } = await context.supabase.from("addresses").select("*").eq("user_id", context.userId).order("is_default", { ascending: false }).limit(1).maybeSingle();
      address = saved ?? first;
      const { isHandDeliveryArea, HAND_DELIVERY_AREA_MESSAGE } = await import("./hand-delivery");
      if (!isHandDeliveryArea(address)) throw new Error(HAND_DELIVERY_AREA_MESSAGE);
    }
    const { applyGroup } = await import("./fulfillment-groups.server");
    return applyGroup(data.orderIds, {
      shipping_method: "arrange", schedule_kind: data.kind, scheduled_at: data.at, event_id: data.kind === "event" ? data.eventId : null,
      notes: data.kind === "event" ? `Retirada em eventos: ${eventName}.` : data.kind === "pickup" ? `Retirada em mãos: ${data.pickupPoint === "aeroporto" ? "Aeroporto" : "Aruana"}.` : "Entrega em mãos — taxa de R$15 via Pix.",
      ...Object.fromEntries(["cep", "street", "number", "complement", "neighborhood", "city", "state"].map((k) => [k, address[k] ?? null])),
      group_shipping_cents: data.kind === "delivery" ? 1500 : 0, hand_delivery_fee_status: data.kind === "delivery" ? "pending" : null,
    }, data.key, { existingId: data.existingId });
  });