import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AdminStackItem {
  id: string;
  card_id: string;
  card_name: string;
  card_image: string | null;
  collection: string | null;
  card_number: string | null;
  finish: string | null;
  language: string | null;
  condition: string | null;
  quantity: number;
  unit_price_cents: number;
  order_id: string;
  status: string;
  service_order_id: string | null;
}

export interface AdminServiceOrder {
  id: string;
  code: number;
  user_id: string;
  method: string;
  status: string;
  amount_cents: number;
  shipping_cost_cents: number;
  recipient_name: string | null;
  phone: string | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  arte_em_cards_code: string | null;
  carrier: string | null;
  tracking_code: string | null;
  tracking_url: string | null;
  created_at: string;
  customer_name: string | null;
  customer_email: string | null;
  items: AdminStackItem[];
}

export interface AdminStack {
  id: string;
  user_id: string;
  started_at: string;
  expires_at: string;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  items: AdminStackItem[];
}

async function ensureAdmin(supabaseAdmin: any, userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Apenas administradores.");
}

export const adminGetPilhaData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ serviceOrders: AdminServiceOrder[]; stacks: AdminStack[]; exampleOrderId: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensureAdmin(supabaseAdmin, context.userId);

    const [{ data: osRows }, { data: stackRows }, { data: exampleRows }] = await Promise.all([
      supabaseAdmin
        .from("service_orders")
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("card_stacks")
        .select("*")
        .eq("status", "active")
        .order("expires_at", { ascending: true }),
      supabaseAdmin
        .from("orders")
        .select("id, status, created_at")
        .in("status", ["paid", "preparing", "shipped", "awaiting_pickup", "dispatched", "delivered"])
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const orders = osRows ?? [];
    const stacks = stackRows ?? [];
    const osIds = orders.map((o: any) => o.id);
    const stackIds = stacks.map((s: any) => s.id);

    const [{ data: osItems }, { data: stackItems }] = await Promise.all([
      osIds.length
        ? supabaseAdmin.from("card_stack_items").select("*").in("service_order_id", osIds)
        : Promise.resolve({ data: [] as any[] }),
      stackIds.length
        ? supabaseAdmin
            .from("card_stack_items")
            .select("*")
            .in("stack_id", stackIds)
            .eq("status", "stored")
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const allUserIds = Array.from(
      new Set<string>([
        ...orders.map((o: any) => o.user_id),
        ...stacks.map((s: any) => s.user_id),
      ]),
    );

    const profileMap = new Map<string, { name: string | null; email: string | null }>();
    if (allUserIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", allUserIds);
      (profiles ?? []).forEach((p: any) =>
        profileMap.set(p.user_id, { name: p.full_name ?? null, email: null }),
      );
      // emails via auth admin
      for (const uid of allUserIds) {
        try {
          const { data } = await supabaseAdmin.auth.admin.getUserById(uid);
          const prev = profileMap.get(uid) ?? { name: null, email: null };
          profileMap.set(uid, { name: prev.name, email: data?.user?.email ?? null });
        } catch {
          // ignore
        }
      }
    }

    const byOs: Record<string, AdminStackItem[]> = {};
    (osItems ?? []).forEach((it: any) => {
      (byOs[it.service_order_id] ??= []).push(it);
    });
    const byStack: Record<string, AdminStackItem[]> = {};
    (stackItems ?? []).forEach((it: any) => {
      (byStack[it.stack_id] ??= []).push(it);
    });

    const exampleOrderIds = (exampleRows ?? []).map((o: any) => o.id);
    const [{ data: exampleOrderItems }, { data: exampleStackItems }] = exampleOrderIds.length
      ? await Promise.all([
          supabaseAdmin.from("order_items").select("order_id").in("order_id", exampleOrderIds),
          supabaseAdmin.from("card_stack_items").select("order_id").in("order_id", exampleOrderIds),
        ])
      : [{ data: [] as any[] }, { data: [] as any[] }];
    const ordersWithItems = new Set((exampleOrderItems ?? []).map((it: any) => it.order_id));
    const itemsByOrderId = new Set((exampleStackItems ?? []).map((it: any) => it.order_id));

    return {
      exampleOrderId:
        (exampleRows ?? []).find((o: any) => ordersWithItems.has(o.id) && !itemsByOrderId.has(o.id))?.id ?? null,
      serviceOrders: orders.map((o: any) => ({
        ...o,
        customer_name: profileMap.get(o.user_id)?.name ?? null,
        customer_email: profileMap.get(o.user_id)?.email ?? null,
        items: byOs[o.id] ?? [],
      })),
      stacks: stacks.map((s: any) => ({
        ...s,
        customer_name: profileMap.get(s.user_id)?.name ?? null,
        customer_email: profileMap.get(s.user_id)?.email ?? null,
        items: byStack[s.id] ?? [],
      })),
    };
  });

export const adminAdjustStackItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        itemId: z.string().uuid(),
        newQuantity: z.number().int().min(0).max(999),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensureAdmin(supabaseAdmin, context.userId);

    if (data.newQuantity === 0) {
      const { error } = await supabaseAdmin
        .from("card_stack_items")
        .delete()
        .eq("id", data.itemId);
      if (error) throw new Error(error.message);
      return { ok: true, removed: true };
    }

    const { error } = await supabaseAdmin
      .from("card_stack_items")
      .update({ quantity: data.newQuantity })
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true, removed: false };
  });

export const adminAddOrderToStack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ orderIdOrPrefix: z.string().trim().min(4).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await ensureAdmin(supabaseAdmin, context.userId);

    const raw = data.orderIdOrPrefix.trim().toLowerCase();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(raw);
    let order: any = null;
    if (isUuid) {
      const { data: o, error } = await supabaseAdmin
        .from("orders")
        .select("id, user_id, status")
        .eq("id", raw)
        .maybeSingle();
      if (error) throw new Error(error.message);
      order = o;
    } else {
      // UUID columns não suportam ILIKE — construímos um intervalo de UUID a
      // partir do prefixo hex (com ou sem hífens) e usamos gte/lte.
      const hex = raw.replace(/-/g, "");
      if (!/^[0-9a-f]+$/.test(hex) || hex.length < 4 || hex.length > 32) {
        throw new Error("Prefixo inválido. Use ao menos 4 caracteres hex do ID.");
      }
      const padLow = (hex + "0".repeat(32 - hex.length)).slice(0, 32);
      const padHigh = (hex + "f".repeat(32 - hex.length)).slice(0, 32);
      const fmt = (h: string) =>
        `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
      const { data: list, error } = await supabaseAdmin
        .from("orders")
        .select("id, user_id, status")
        .gte("id", fmt(padLow))
        .lte("id", fmt(padHigh))
        .limit(2);
      if (error) throw new Error(error.message);
      if (list && list.length > 1) {
        throw new Error("Mais de um pedido começa com esse prefixo. Use o ID completo.");
      }
      order = list?.[0] ?? null;
    }
    if (!order) throw new Error("Pedido não encontrado.");
    const allowed = ["paid", "preparing", "shipped", "awaiting_pickup", "dispatched", "delivered"];
    if (!allowed.includes(order.status)) {
      throw new Error(`Pedido está com status "${order.status}". Só pedidos pagos podem ir à pilha.`);
    }

    const { count } = await supabaseAdmin
      .from("card_stack_items")
      .select("id", { count: "exact", head: true })
      .eq("order_id", order.id);
    if ((count ?? 0) > 0) {
      throw new Error("Esse pedido já está na pilha do cliente.");
    }

    const { ensureActiveStack } = await import("@/lib/card-stack.server");
    const stack = await ensureActiveStack(order.user_id);

    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select(
        "id, card_id, card_name, card_image, collection, card_number, finish, language, condition, quantity, unit_price_cents",
      )
      .eq("order_id", order.id);

    if (!items || items.length === 0) throw new Error("Pedido não possui itens.");

    const rows = items.map((it: any) => ({
      stack_id: stack.id,
      user_id: order.user_id,
      order_id: order.id,
      order_item_id: it.id,
      card_id: it.card_id,
      card_name: it.card_name,
      card_image: it.card_image,
      collection: it.collection,
      card_number: it.card_number,
      finish: it.finish,
      language: it.language,
      condition: it.condition,
      quantity: it.quantity,
      unit_price_cents: it.unit_price_cents ?? 0,
      status: "stored" as const,
    }));

    const { error } = await supabaseAdmin.from("card_stack_items").insert(rows);
    if (error) throw new Error(error.message);

    // Notifica o cliente
    try {
      const { data: ord } = await supabaseAdmin
        .from("orders")
        .select("email, recipient_name")
        .eq("id", order.id)
        .maybeSingle();
      if (ord?.email) {
        const { sendTransactionalEmailSafe } = await import("@/lib/email/send.server");
        await sendTransactionalEmailSafe({
          templateName: "stack-order-stored",
          recipientEmail: ord.email,
          idempotencyKey: `stack-order-stored-${order.id}`,
          templateData: {
            recipientName: ord.recipient_name?.split(/\s+/)[0],
            orderId: order.id,
            expiresAt: stack.expires_at,
            items: items.map((it: any) => ({
              card_name: it.card_name,
              collection: it.collection,
              card_number: it.card_number,
              finish: it.finish,
              language: it.language,
              condition: it.condition,
              quantity: it.quantity,
              unit_price_cents: it.unit_price_cents ?? 0,
            })),
          },
        });
      }
    } catch (e) {
      console.error("[adminAddOrderToStack] email falhou:", e);
    }

    return { ok: true, addedCount: rows.length, orderId: order.id, stackId: stack.id };
  });

