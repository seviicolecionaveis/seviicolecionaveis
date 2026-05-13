import { createFileRoute } from "@tanstack/react-router";

type StripeEnv = "sandbox" | "live";
type CheckoutSession = {
  metadata?: { orderId?: string } | null;
  payment_intent?: string | null;
};

async function handleSessionCompleted(session: CheckoutSession) {
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    console.error("No orderId in session metadata");
    return;
  }
  const { markOrderPaid } = await import("@/lib/orders.server");
  await markOrderPaid(orderId, { stripePaymentIntent: session.payment_intent ?? undefined });
}

async function handleSessionExpired(session: CheckoutSession) {
  const orderId = session.metadata?.orderId;
  if (!orderId) return;
  const { cancelOrder } = await import("@/lib/orders.server");
  await cancelOrder(orderId);
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          const { verifyWebhook } = await import("@/lib/stripe.server");
          const event = await verifyWebhook(request, env);
          switch (event.type) {
            case "checkout.session.completed":
              await handleSessionCompleted(event.data.object);
              break;
            case "checkout.session.expired":
              await handleSessionExpired(event.data.object);
              break;
            default:
              console.log("Unhandled event:", event.type);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
