import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AddressSchema = z.object({
  recipientName: z.string().min(2).max(150),
  phone: z.string().min(8).max(30),
  cep: z.string().min(8).max(10),
  street: z.string().min(2).max(200),
  number: z.string().min(1).max(20),
  complement: z.string().max(100).nullable().optional(),
  neighborhood: z.string().min(1).max(150),
  city: z.string().min(1).max(100),
  state: z.string().min(2).max(2),
});

const QuoteSchema = z.object({
  serviceId: z.string().min(1).max(100),
  serviceName: z.string().min(1).max(100),
  company: z.string().min(1).max(100),
  priceCents: z.number().int().min(0).max(1_000_000),
});

const InputSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1).max(200),
  method: z.enum(["correios", "app", "arte_em_cards", "presencial", "evento"]),
  shippingQuote: QuoteSchema.nullable().optional(),
  address: AddressSchema.nullable().optional(),
  arteEmCardsCode: z.string().trim().max(40).nullable().optional(),
  pickupPoint: z.enum(["aruana", "aeroporto"]).nullable().optional(),
  eventName: z.string().trim().max(200).nullable().optional(),
  eventId: z.string().uuid().nullable().optional(),
  eventAt: z.string().datetime().nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  cpf: z.string().max(20).nullable().optional(),
});

export const createServiceOrderRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { createServiceOrderServer } = await import("@/lib/service-orders.server");
    return createServiceOrderServer({
      userId: context.userId,
      itemIds: data.itemIds,
      method: data.method,
      shippingQuote: data.shippingQuote ?? null,
      address: data.address ?? null,
      arteEmCardsCode: data.arteEmCardsCode ?? null,
      pickupPoint: data.pickupPoint ?? null,
      eventName: data.eventName ?? null,
      eventId: data.eventId ?? null,
      eventAt: data.eventAt ?? null,
      scheduledAt: data.scheduledAt ?? null,
      notes: data.notes ?? null,
      cpf: data.cpf ?? null,
    });
  });

/**
 * Cliente desfaz uma solicitação (OS) ainda não enviada/entregue para escolher
 * outra modalidade. Só permite enquanto faltam mais de 24h para o horário
 * agendado (ou quando não há agendamento). Os itens voltam para a pilha e o
 * prazo de 30 dias NÃO é alterado.
 */
export const clientRescheduleServiceOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ serviceOrderId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: so, error } = await supabaseAdmin
      .from("service_orders")
      .select("id, code, user_id, status, method, scheduled_at, schedule_kind, stack_id")
      .eq("id", data.serviceOrderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!so || so.user_id !== context.userId) throw new Error("Solicitação não encontrada.");
    if (!["awaiting_payment", "paid", "preparing"].includes(so.status)) {
      throw new Error("Essa solicitação já foi enviada/entregue e não pode mais ser alterada.");
    }
    if (so.scheduled_at) {
      const ms = new Date(so.scheduled_at).getTime() - Date.now();
      if (ms < 24 * 3_600_000) {
        throw new Error("Faltam menos de 24h para o horário agendado — fale com a loja pelo WhatsApp para alterar.");
      }
    }

    const { error: updErr } = await supabaseAdmin
      .from("service_orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", so.id)
      .in("status", ["awaiting_payment", "paid", "preparing"]);
    if (updErr) throw new Error(updErr.message);

    const { error: itemsErr } = await supabaseAdmin
      .from("card_stack_items")
      .update({ status: "stored", service_order_id: null, updated_at: new Date().toISOString() })
      .eq("service_order_id", so.id);
    if (itemsErr) throw new Error(itemsErr.message);

    try {
      const { modalityOfServiceOrder } = await import("@/lib/fulfillment-alerts");
      const { notifyFulfillmentChange } = await import("@/lib/fulfillment-alerts.server");
      await notifyFulfillmentChange({
        targetType: "service_order",
        targetId: so.id,
        code: `OS #${so.code}`,
        action: "cancelled",
        source: "customer",
        modality: modalityOfServiceOrder(so.method),
        scheduledAt: so.scheduled_at ?? null,
        dedupeExtra: `reschedule-${Date.now()}`,
        notifyClient: false,
      });
    } catch (e) {
      console.error("[clientRescheduleServiceOrder] alerta falhou:", e);
    }

    return { ok: true, stackId: so.stack_id as string | null };
  });

export const checkServiceOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ serviceOrderId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { checkServiceOrderStatusServer } = await import("@/lib/service-orders.server");
    return checkServiceOrderStatusServer(data.serviceOrderId, context.userId);
  });
