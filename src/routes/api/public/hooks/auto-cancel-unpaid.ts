import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Auto-cancels pending orders older than 30 minutes, but ONLY after
// double-checking Mercado Pago to make sure the customer didn't actually pay.
// Without this check, a PIX paid right at (or shortly after) the 30-min limit
// gets cancelled on our side while MP shows it as approved — customer is
// charged and the order has to be fixed manually.
export const Route = createFileRoute("/api/public/hooks/auto-cancel-unpaid")({
  server: {
    handlers: {
      POST: handler,
      GET: handler,
    },
  },
});

async function handler() {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: candidates, error } = await supabaseAdmin
    .from("orders")
    .select("id, mercadopago_payment_id, status, created_at")
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .limit(500);
  if (error) {
    console.error("[auto-cancel] query failed", error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!candidates || candidates.length === 0) {
    return Response.json({ ok: true, checked: 0, paid: 0, cancelled: 0 });
  }

  const { getPixPayment } = await import("@/lib/mercadopago.server");
  const { markOrderPaid, cancelOrder } = await import("@/lib/orders.server");

  let paid = 0;
  let cancelled = 0;
  const errors: string[] = [];

  for (const o of candidates) {
    try {
      if (o.mercadopago_payment_id) {
        const remote = await getPixPayment(o.mercadopago_payment_id);
        if (remote.status === "approved") {
          await markOrderPaid(o.id, { mercadopagoPaymentId: o.mercadopago_payment_id });
          paid++;
          continue;
        }
        // Any other status (pending / cancelled / rejected / refunded on MP) → safe to cancel here.
      }
      await cancelOrder(o.id);
      cancelled++;
    } catch (e: any) {
      console.error("[auto-cancel] order", o.id, e?.message ?? e);
      errors.push(`${o.id}: ${e?.message ?? "unknown"}`);
    }
  }

  return Response.json({
    ok: true,
    checked: candidates.length,
    paid,
    cancelled,
    errors,
  });
}
