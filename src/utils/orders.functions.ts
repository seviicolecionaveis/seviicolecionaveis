import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const adminUpdateOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      order_id: z.string().uuid(),
      status: z.enum([
        "pending",
        "paid",
        "shipped",
        "delivered",
        "cancelled",
        "cancellation_requested",
      ]),
    }).parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { isAdmin, getOrderById, updateOrder } = await import("@/lib/order-cancellation.server");
    const { sendTransactionalEmailSafe } = await import("@/lib/email/send.server");
    if (!(await isAdmin(context.userId))) throw new Response("Acesso negado", { status: 403 });
    const order = await getOrderById(data.order_id, "id, status, email, recipient_name");
    if (!order) throw new Response("Pedido não encontrado", { status: 404 });
    if (order.status === data.status) return { ok: true };
    await updateOrder(order.id, { status: data.status });
    if (order.email) {
      await sendTransactionalEmailSafe({
        templateName: "order-status-updated",
        recipientEmail: order.email,
        idempotencyKey: `order-status-${order.id}-${data.status}`,
        templateData: {
          recipientName: order.recipient_name?.split(/\s+/)[0],
          orderId: order.id,
          status: data.status,
        },
      });
    }
    return { ok: true };
  });


export const requestOrderCancellation = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ order_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { getOrderById, updateOrder } = await import("@/lib/order-cancellation.server");
    const order = await getOrderById(data.order_id, "id, user_id, status");
    if (!order) throw new Response("Pedido não encontrado", { status: 404 });
    if (order.user_id !== context.userId) {
      throw new Response("Acesso negado", { status: 403 });
    }
    if (!["pending", "paid"].includes(order.status)) {
      throw new Response("Este pedido não pode mais ser cancelado.", { status: 400 });
    }
    await updateOrder(order.id, {
      status: "cancellation_requested",
      pre_cancel_status: order.status,
    });
    return { ok: true };
  });

export const approveOrderCancellation = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ order_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { isAdmin, restoreStockIfPaid, getOrderById, updateOrder, deleteStockReservations } =
      await import("@/lib/order-cancellation.server");
    if (!(await isAdmin(context.userId))) throw new Response("Acesso negado", { status: 403 });
    const order = await getOrderById(data.order_id, "id, status, pre_cancel_status");
    if (!order) throw new Response("Pedido não encontrado", { status: 404 });
    await restoreStockIfPaid(order.id, order.pre_cancel_status ?? "");
    await deleteStockReservations(order.id);
    await updateOrder(order.id, { status: "cancelled" });
    return { ok: true };
  });

export const rejectOrderCancellation = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ order_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { isAdmin, getOrderById, updateOrder } = await import("@/lib/order-cancellation.server");
    if (!(await isAdmin(context.userId))) throw new Response("Acesso negado", { status: 403 });
    const order = await getOrderById(data.order_id, "id, pre_cancel_status");
    if (!order) throw new Response("Pedido não encontrado", { status: 404 });
    await updateOrder(order.id, {
      status: order.pre_cancel_status ?? "pending",
      pre_cancel_status: null,
    });
    return { ok: true };
  });

export const adminCancelOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ order_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { isAdmin, restoreStockIfPaid, getOrderById, updateOrder, deleteStockReservations } =
      await import("@/lib/order-cancellation.server");
    if (!(await isAdmin(context.userId))) throw new Response("Acesso negado", { status: 403 });
    const order = await getOrderById(data.order_id, "id, status");
    if (!order) throw new Response("Pedido não encontrado", { status: 404 });
    if (order.status === "cancelled") return { ok: true };
    await restoreStockIfPaid(order.id, order.status);
    await deleteStockReservations(order.id);
    await updateOrder(order.id, { status: "cancelled" });
    return { ok: true };
  });
