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
        "preparing",
        "shipped",
        "delivered",
        "cancelled",
        "cancellation_requested",
      ]),
      tracking_code: z.string().trim().max(60).optional().nullable(),
      carrier: z.enum(["correios", "latam", "pickup"]).optional().nullable(),
      tracking_url: z.preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? null : v),
        z.string().trim().max(500).url().optional().nullable(),
      ),
    }).parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { isAdmin, getOrderById, updateOrder, restoreStockIfPaid, deleteStockReservations } =
      await import("@/lib/order-cancellation.server");
    const { sendTransactionalEmailSafe } = await import("@/lib/email/send.server");
    if (!(await isAdmin(context.userId))) throw new Response("Acesso negado", { status: 403 });
    const order = await getOrderById(data.order_id, "id, status, email, recipient_name, tracking_code, carrier, tracking_url");
    if (!order) throw new Response("Pedido não encontrado", { status: 404 });

    const trackingProvided = typeof data.tracking_code === "string";
    const newTracking = trackingProvided ? (data.tracking_code?.trim() || null) : undefined;
    const carrierProvided = data.carrier !== undefined;
    const newCarrier = carrierProvided ? (data.carrier ?? null) : undefined;
    const trackingUrlProvided = data.tracking_url !== undefined;
    const newTrackingUrl = trackingUrlProvided ? (data.tracking_url || null) : undefined;

    const statusChanged = order.status !== data.status;
    const trackingChanged = trackingProvided && newTracking !== (order.tracking_code ?? null);
    const carrierChanged = carrierProvided && newCarrier !== ((order as any).carrier ?? null);
    const trackingUrlChanged = trackingUrlProvided && newTrackingUrl !== ((order as any).tracking_url ?? null);

    if (!statusChanged && !trackingChanged && !carrierChanged && !trackingUrlChanged) return { ok: true };

    if (statusChanged && data.status === "paid") {
      const { markOrderPaid } = await import("@/lib/orders.server");
      await markOrderPaid(order.id);
      return { ok: true };
    }

    if (statusChanged && data.status === "cancelled") {
      await restoreStockIfPaid(order.id, order.status);
      await deleteStockReservations(order.id);
    }

    const patch: Record<string, any> = {};
    if (statusChanged) patch.status = data.status;
    if (trackingChanged) patch.tracking_code = newTracking;
    if (carrierChanged) patch.carrier = newCarrier;
    if (trackingUrlChanged) patch.tracking_url = newTrackingUrl;
    await updateOrder(order.id, patch);

    if (order.email && statusChanged) {
      const effectiveCarrier = carrierProvided ? newCarrier : ((order as any).carrier ?? null);
      const effectiveTracking = trackingProvided ? newTracking : (order.tracking_code ?? null);
      const effectiveTrackingUrl = trackingUrlProvided ? newTrackingUrl : ((order as any).tracking_url ?? null);
      await sendTransactionalEmailSafe({
        templateName: "order-status-updated",
        recipientEmail: order.email,
        idempotencyKey: `order-status-${order.id}-${data.status}`,
        templateData: {
          recipientName: order.recipient_name?.split(/\s+/)[0],
          orderId: order.id,
          status: data.status,
          trackingCode: data.status === "shipped" ? effectiveTracking : null,
          carrier: data.status === "shipped" ? effectiveCarrier : null,
          trackingUrl: data.status === "shipped" ? effectiveTrackingUrl : null,
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
    const { sendTransactionalEmailSafe } = await import("@/lib/email/send.server");
    const order = await getOrderById(
      data.order_id,
      "id, user_id, status, email, recipient_name, total_cents",
    );
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
    // Notifica o admin por e-mail
    await sendTransactionalEmailSafe({
      templateName: "admin-cancellation-requested",
      recipientEmail: "seviicolecionaveis@gmail.com",
      idempotencyKey: `admin-cancel-req-${order.id}`,
      templateData: {
        orderId: order.id,
        recipientName: order.recipient_name,
        customerEmail: order.email,
        totalCents: order.total_cents,
        preCancelStatus: order.status,
      },
    });
    return { ok: true };
  });

export const approveOrderCancellation = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ order_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { isAdmin, restoreStockIfPaid, getOrderById, updateOrder, deleteStockReservations } =
      await import("@/lib/order-cancellation.server");
    const { sendTransactionalEmailSafe } = await import("@/lib/email/send.server");
    if (!(await isAdmin(context.userId))) throw new Response("Acesso negado", { status: 403 });
    const order = await getOrderById(
      data.order_id,
      "id, status, pre_cancel_status, email, recipient_name",
    );
    if (!order) throw new Response("Pedido não encontrado", { status: 404 });
    await restoreStockIfPaid(order.id, order.pre_cancel_status ?? "");
    await deleteStockReservations(order.id);
    await updateOrder(order.id, { status: "cancelled" });
    if (order.email) {
      await sendTransactionalEmailSafe({
        templateName: "order-status-updated",
        recipientEmail: order.email,
        idempotencyKey: `order-status-${order.id}-cancelled`,
        templateData: {
          recipientName: order.recipient_name?.split(/\s+/)[0],
          orderId: order.id,
          status: "cancelled",
        },
      });
    }
    return { ok: true };
  });

export const rejectOrderCancellation = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ order_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { isAdmin, getOrderById, updateOrder } = await import("@/lib/order-cancellation.server");
    const { sendTransactionalEmailSafe } = await import("@/lib/email/send.server");
    if (!(await isAdmin(context.userId))) throw new Response("Acesso negado", { status: 403 });
    const order = await getOrderById(
      data.order_id,
      "id, pre_cancel_status, email, recipient_name",
    );
    if (!order) throw new Response("Pedido não encontrado", { status: 404 });
    const restored = order.pre_cancel_status ?? "pending";
    await updateOrder(order.id, {
      status: restored,
      pre_cancel_status: null,
    });
    if (order.email) {
      await sendTransactionalEmailSafe({
        templateName: "order-status-updated",
        recipientEmail: order.email,
        idempotencyKey: `order-status-${order.id}-reject-${restored}`,
        templateData: {
          recipientName: order.recipient_name?.split(/\s+/)[0],
          orderId: order.id,
          status: restored,
        },
      });
    }
    return { ok: true };
  });

export const adminCancelOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ order_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { isAdmin, restoreStockIfPaid, getOrderById, updateOrder, deleteStockReservations } =
      await import("@/lib/order-cancellation.server");
    const { sendTransactionalEmailSafe } = await import("@/lib/email/send.server");
    if (!(await isAdmin(context.userId))) throw new Response("Acesso negado", { status: 403 });
    const order = await getOrderById(
      data.order_id,
      "id, status, email, recipient_name",
    );
    if (!order) throw new Response("Pedido não encontrado", { status: 404 });
    if (order.status === "cancelled") return { ok: true };
    await restoreStockIfPaid(order.id, order.status);
    await deleteStockReservations(order.id);
    await updateOrder(order.id, { status: "cancelled" });
    if (order.email) {
      await sendTransactionalEmailSafe({
        templateName: "order-status-updated",
        recipientEmail: order.email,
        idempotencyKey: `order-status-${order.id}-cancelled`,
        templateData: {
          recipientName: order.recipient_name?.split(/\s+/)[0],
          orderId: order.id,
          status: "cancelled",
        },
      });
    }
    return { ok: true };
  });
