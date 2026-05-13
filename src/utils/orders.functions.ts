import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function isAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

async function restoreStockIfPaid(orderId: string, statusBefore: string) {
  // If order had been paid (stock decremented in markOrderPaid), restore.
  if (!["paid", "shipped"].includes(statusBefore)) return;
  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("card_id, quantity")
    .eq("order_id", orderId);
  if (!items) return;
  for (const it of items) {
    if (!it.card_id || !UUID_RE.test(it.card_id)) continue;
    const { data: card } = await supabaseAdmin
      .from("cards")
      .select("stock")
      .eq("id", it.card_id)
      .maybeSingle();
    if (card) {
      await supabaseAdmin
        .from("cards")
        .update({ stock: (card.stock ?? 0) + it.quantity })
        .eq("id", it.card_id);
    }
  }
}

// Cliente solicita cancelamento — fica aguardando análise do admin
export const requestOrderCancellation = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ order_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, status")
      .eq("id", data.order_id)
      .maybeSingle();
    if (!order) throw new Response("Pedido não encontrado", { status: 404 });
    if (order.user_id !== context.userId) {
      throw new Response("Acesso negado", { status: 403 });
    }
    if (!["pending", "paid"].includes(order.status)) {
      throw new Response("Este pedido não pode mais ser cancelado.", { status: 400 });
    }
    await supabaseAdmin
      .from("orders")
      .update({
        status: "cancellation_requested",
        pre_cancel_status: order.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    return { ok: true };
  });

// Admin aprova cancelamento solicitado pelo cliente
export const approveOrderCancellation = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ order_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.userId))) throw new Response("Acesso negado", { status: 403 });
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, pre_cancel_status")
      .eq("id", data.order_id)
      .maybeSingle();
    if (!order) throw new Response("Pedido não encontrado", { status: 404 });
    await restoreStockIfPaid(order.id, order.pre_cancel_status ?? "");
    await supabaseAdmin.from("stock_reservations").delete().eq("order_id", order.id);
    await supabaseAdmin
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", order.id);
    return { ok: true };
  });

// Admin recusa o cancelamento e devolve o status anterior
export const rejectOrderCancellation = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ order_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.userId))) throw new Response("Acesso negado", { status: 403 });
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, pre_cancel_status")
      .eq("id", data.order_id)
      .maybeSingle();
    if (!order) throw new Response("Pedido não encontrado", { status: 404 });
    await supabaseAdmin
      .from("orders")
      .update({
        status: order.pre_cancel_status ?? "pending",
        pre_cancel_status: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    return { ok: true };
  });

// Admin cancela diretamente, sem solicitação prévia
export const adminCancelOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ order_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.userId))) throw new Response("Acesso negado", { status: 403 });
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status")
      .eq("id", data.order_id)
      .maybeSingle();
    if (!order) throw new Response("Pedido não encontrado", { status: 404 });
    if (order.status === "cancelled") return { ok: true };
    await restoreStockIfPaid(order.id, order.status);
    await supabaseAdmin.from("stock_reservations").delete().eq("order_id", order.id);
    await supabaseAdmin
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", order.id);
    return { ok: true };
  });
