import { createFileRoute } from "@tanstack/react-router";

// Mercado Pago notification format:
// https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
// We accept query string `id` + `topic`, or JSON body { type, data: { id } }
export const Route = createFileRoute("/api/public/payments/mercadopago-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          let paymentId: string | null = null;
          const topicQp = url.searchParams.get("topic") ?? url.searchParams.get("type");
          const idQp = url.searchParams.get("id") ?? url.searchParams.get("data.id");

          if (idQp && (topicQp === "payment" || topicQp === null)) {
            paymentId = idQp;
          } else {
            try {
              const body = await request.json();
              if (body?.type === "payment" || body?.action?.startsWith?.("payment.")) {
                paymentId = String(body?.data?.id ?? body?.id ?? "");
              } else if (body?.data?.id) {
                paymentId = String(body.data.id);
              }
            } catch {
              // no body
            }
          }

          if (!paymentId) {
            return Response.json({ received: true, ignored: "no payment id" });
          }

          const [{ getPixPayment }, { markOrderPaid, cancelOrder }] = await Promise.all([
            import("@/lib/mercadopago.server"),
            import("@/lib/orders.server"),
          ]);
          const remote = await getPixPayment(paymentId);
          const orderId = remote.external_reference;
          if (!orderId) {
            return Response.json({ received: true, ignored: "no external_reference" });
          }

          if (remote.status === "approved") {
            await markOrderPaid(orderId, { mercadopagoPaymentId: paymentId });
          } else if (
            remote.status === "cancelled" ||
            remote.status === "rejected" ||
            remote.status === "refunded"
          ) {
            await cancelOrder(orderId);
          }

          return Response.json({ received: true });
        } catch (e) {
          console.error("MP webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
      GET: async () => Response.json({ ok: true }),
    },
  },
});
