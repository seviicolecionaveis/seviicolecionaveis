import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AdminServiceOrder, AdminStack, AdminStackItem } from "@/lib/admin-pilha.functions";

async function ensureAdmin(supabaseAdmin: any, userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Apenas administradores.");
}

async function profileInfo(supabaseAdmin: any, userId: string) {
  const { data: p } = await supabaseAdmin
    .from("profiles")
    .select("full_name, phone, whatsapp, cpf")
    .eq("user_id", userId)
    .maybeSingle();
  let email: string | null = null;
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    email = data?.user?.email ?? null;
  } catch {
    // ignore
  }
  return {
    name: (p as any)?.full_name ?? null,
    email,
    phone: (p as any)?.whatsapp ?? (p as any)?.phone ?? null,
    cpf: (p as any)?.cpf ?? null,
  };
}

export interface AdminServiceOrderDetail extends AdminServiceOrder {
  stack_id: string | null;
  event_id: string | null;
  scheduled_at: string | null;
  schedule_kind: string | null;
  fee_status: string | null;
  payment_order_id: string | null;
  edit_history: Array<{ at: string; by: string | null; summary: string }>;
  event_name: string | null;
  customer_phone: string | null;
  customer_cpf: string | null;
  payment: {
    order_id: string;
    status: string;
    payment_method: string | null;
    mercadopago_payment_id: string | null;
  } | null;
}

export const adminGetServiceOrderDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ serviceOrderId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<AdminServiceOrderDetail> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensureAdmin(supabaseAdmin, context.userId);

    const { data: so, error } = await supabaseAdmin
      .from("service_orders")
      .select("*")
      .eq("id", data.serviceOrderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!so) throw new Error("Ordem de serviço não encontrada.");

    const { data: items } = await supabaseAdmin
      .from("card_stack_items")
      .select("*")
      .eq("service_order_id", so.id)
      .order("created_at", { ascending: true });

    const profile = await profileInfo(supabaseAdmin, so.user_id);

    let eventName: string | null = null;
    if (so.event_id) {
      const { data: ev } = await supabaseAdmin
        .from("events")
        .select("name")
        .eq("id", so.event_id)
        .maybeSingle();
      eventName = ev?.name ?? null;
    }

    let payment: AdminServiceOrderDetail["payment"] = null;
    if (so.payment_order_id) {
      const { data: po } = await supabaseAdmin
        .from("orders")
        .select("id, status, payment_method, mercadopago_payment_id")
        .eq("id", so.payment_order_id)
        .maybeSingle();
      if (po) {
        payment = {
          order_id: po.id,
          status: po.status,
          payment_method: po.payment_method ?? null,
          mercadopago_payment_id: po.mercadopago_payment_id ?? null,
        };
      }
    }

    return {
      ...(so as any),
      customer_name: profile.name,
      customer_email: profile.email,
      customer_phone: profile.phone,
      customer_cpf: profile.cpf,
      event_name: eventName,
      edit_history: Array.isArray(so.edit_history) ? so.edit_history : [],
      items: (items ?? []) as AdminStackItem[],
      payment,
    };
  });

export interface AdminStackDetail extends AdminStack {
  customer_phone: string | null;
  customer_cpf: string | null;
  orders: Array<{ id: string; created_at: string; status: string; total_cents: number | null }>;
  serviceOrders: Array<{
    id: string;
    code: number;
    method: string;
    status: string;
    scheduled_at: string | null;
    schedule_kind: string | null;
    event_id: string | null;
    created_at: string;
  }>;
}

export const adminGetStackDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ stackId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<AdminStackDetail> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensureAdmin(supabaseAdmin, context.userId);

    const { data: stack, error } = await supabaseAdmin
      .from("card_stacks")
      .select("*")
      .eq("id", data.stackId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!stack) throw new Error("Pilha não encontrada.");

    const [{ data: items }, { data: sos }] = await Promise.all([
      supabaseAdmin
        .from("card_stack_items")
        .select("*")
        .eq("stack_id", stack.id)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("service_orders")
        .select("id, code, method, status, scheduled_at, schedule_kind, event_id, created_at")
        .eq("stack_id", stack.id)
        .order("created_at", { ascending: false }),
    ]);

    const profile = await profileInfo(supabaseAdmin, stack.user_id);

    const orderIds = Array.from(
      new Set((items ?? []).map((i: any) => i.order_id).filter(Boolean)),
    ) as string[];
    let orders: AdminStackDetail["orders"] = [];
    if (orderIds.length) {
      const { data: ords } = await supabaseAdmin
        .from("orders")
        .select("id, created_at, status, total_cents")
        .in("id", orderIds)
        .order("created_at", { ascending: true });
      orders = (ords ?? []) as any;
    }

    return {
      ...(stack as any),
      customer_name: profile.name,
      customer_email: profile.email,
      customer_phone: profile.phone,
      customer_cpf: profile.cpf,
      items: (items ?? []) as AdminStackItem[],
      orders,
      serviceOrders: (sos ?? []) as any,
    };
  });

export const adminSetStackItemPicked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        itemId: z.string().uuid(),
        pickedBy: z.enum(["Luca", "Julia"]).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensureAdmin(supabaseAdmin, context.userId);

    const { error } = await supabaseAdmin
      .from("card_stack_items")
      .update({
        picked_by: data.pickedBy,
        picked_at: data.pickedBy ? new Date().toISOString() : null,
      })
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const EditServiceOrderSchema = z.object({
  serviceOrderId: z.string().uuid(),
  method: z.enum(["correios", "app", "arte_em_cards", "presencial", "evento"]).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  address: z
    .object({
      recipientName: z.string().min(2).max(150),
      phone: z.string().min(8).max(30),
      cep: z.string().min(8).max(10),
      street: z.string().min(2).max(200),
      number: z.string().min(1).max(20),
      complement: z.string().max(100).nullable().optional(),
      neighborhood: z.string().min(1).max(150),
      city: z.string().min(1).max(100),
      state: z.string().min(2).max(2),
    })
    .nullable()
    .optional(),
  notes: z.string().max(500).nullable().optional(),
  reason: z.string().trim().min(3).max(300),
});

export const adminEditServiceOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => EditServiceOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensureAdmin(supabaseAdmin, context.userId);

    const { data: so, error } = await supabaseAdmin
      .from("service_orders")
      .select("id, method, scheduled_at, schedule_kind, edit_history, status")
      .eq("id", data.serviceOrderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!so) throw new Error("Ordem de serviço não encontrada.");
    if (["delivered", "cancelled"].includes(so.status)) {
      throw new Error("OS já entregue ou cancelada — não pode ser editada.");
    }

    const method = data.method ?? so.method;
    const updates: Record<string, unknown> = { method };
    const changes: string[] = [];
    if (data.method && data.method !== so.method) {
      changes.push(`modalidade: ${so.method} → ${data.method}`);
    }

    if (data.scheduledAt !== undefined) {
      if (data.scheduledAt) {
        const kind = method === "app" ? "delivery" : "pickup";
        const { validateSchedule } = await import("@/lib/scheduling");
        const err = validateSchedule(kind, data.scheduledAt);
        if (err) throw new Error(err);
        updates.scheduled_at = data.scheduledAt;
        updates.schedule_kind = kind;
        changes.push("data/horário atualizado");
      } else {
        updates.scheduled_at = null;
        updates.schedule_kind = null;
        changes.push("agendamento removido");
      }
    }

    if (data.address) {
      updates.recipient_name = data.address.recipientName;
      updates.phone = data.address.phone;
      updates.cep = data.address.cep;
      updates.street = data.address.street;
      updates.number = data.address.number;
      updates.complement = data.address.complement ?? null;
      updates.neighborhood = data.address.neighborhood;
      updates.city = data.address.city;
      updates.state = data.address.state.toUpperCase();
      changes.push("endereço atualizado");
    }

    if (data.notes !== undefined) {
      updates.notes = data.notes;
    }

    let editorEmail: string | null = null;
    try {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      editorEmail = u?.user?.email ?? null;
    } catch {
      // ignore
    }

    const history = Array.isArray(so.edit_history) ? [...so.edit_history] : [];
    history.push({
      at: new Date().toISOString(),
      by: editorEmail,
      summary: `${changes.join("; ") || "edição"} — ${data.reason}`,
    });
    updates.edit_history = history;
    updates.updated_at = new Date().toISOString();

    const { error: updErr } = await supabaseAdmin
      .from("service_orders")
      .update(updates)
      .eq("id", so.id);
    if (updErr) throw new Error(updErr.message);

    // Avisa cliente e loja pelo ponto central de alertas de modalidade.
    try {
      const { data: full } = await supabaseAdmin
        .from("service_orders")
        .select("code, user_id, method, scheduled_at, schedule_kind, event_id, phone, recipient_name")
        .eq("id", so.id)
        .maybeSingle();
      if (!full) throw new Error("OS não encontrada para alerta.");
      const { modalityOfServiceOrder } = await import("@/lib/fulfillment-alerts");
      const { formatSchedule } = await import("@/lib/scheduling");
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("full_name, phone")
        .eq("user_id", full.user_id)
        .maybeSingle();
      let custEmail: string | null = null;
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(full.user_id);
        custEmail = u?.user?.email ?? null;
      } catch {
        // ignore
      }
      const { notifyFulfillmentChange } = await import("@/lib/fulfillment-alerts.server");
      await notifyFulfillmentChange({
        targetType: "service_order",
        targetId: so.id,
        code: `OS #${full.code}`,
        action: "changed",
        source: "admin",
        modality: modalityOfServiceOrder(full.method),
        customerName: prof?.full_name ?? full.recipient_name ?? null,
        customerEmail: custEmail,
        customerPhone: full.phone ?? prof?.phone ?? null,
        scheduledAt: full.scheduled_at ?? null,
        when: full.scheduled_at
          ? formatSchedule(full.schedule_kind ?? "pickup", full.scheduled_at)
          : null,
        eventId: full.event_id ?? null,
        dedupeExtra: `${Date.now()}`,
      });
    } catch (e) {
      console.error("[adminEditServiceOrder] alerta falhou:", e);
    }

    return { ok: true };
  });

export const adminConfirmServiceOrderFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ serviceOrderId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensureAdmin(supabaseAdmin, context.userId);

    const { data: so, error } = await supabaseAdmin
      .from("service_orders")
      .select("id, method, fee_status")
      .eq("id", data.serviceOrderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!so) throw new Error("Ordem de serviço não encontrada.");
    if (so.method !== "app") throw new Error("Só entregas em mãos têm taxa.");

    const { error: updErr } = await supabaseAdmin
      .from("service_orders")
      .update({ fee_status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", so.id);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });
