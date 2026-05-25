import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

// Verifies the Mercado Pago `x-signature` header per:
// https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
// Manifest format: "id:{data.id};request-id:{x-request-id};ts:{ts};"
function verifyMpSignature(
  request: Request,
  url: URL,
  secret: string,
  bodyPaymentId: string | null,
): boolean {
  const sigHeader = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id") ?? "";
  if (!sigHeader) return false;

  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k.trim(), v.join("=").trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const dataId =
    url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? bodyPaymentId ?? "";
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  try {
    const a = Buffer.from(v1, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/payments/mercadopago-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const rawBody = await request.text();

          let paymentId: string | null = null;
          let parsedBody: any = null;
          const topicQp = url.searchParams.get("topic") ?? url.searchParams.get("type");
          const idQp = url.searchParams.get("id") ?? url.searchParams.get("data.id");

          if (idQp && (topicQp === "payment" || topicQp === null)) {
            paymentId = idQp;
          } else if (rawBody) {
            try {
              parsedBody = JSON.parse(rawBody);
              if (
                parsedBody?.type === "payment" ||
                parsedBody?.action?.startsWith?.("payment.")
              ) {
                paymentId = String(parsedBody?.data?.id ?? parsedBody?.id ?? "");
              } else if (parsedBody?.data?.id) {
                paymentId = String(parsedBody.data.id);
              }
            } catch {
              // no body
            }
          }

          // Signature verification (Mercado Pago x-signature header).
          // Gated on MERCADOPAGO_WEBHOOK_SECRET being configured — until then
          // the handler still re-verifies the payment with MP's API below.
          const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
          if (secret) {
            const ok = verifyMpSignature(request, url, secret, paymentId);
            if (!ok) {
              return new Response("Invalid signature", { status: 401 });
            }
          } else {
            console.warn(
              "[MP webhook] MERCADOPAGO_WEBHOOK_SECRET not configured — accepting without signature verification.",
            );
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
