import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UpdateSchema = z.object({
  serviceOrderId: z.string().uuid(),
  status: z.enum(["paid", "dispatched", "delivered", "cancelled"]).optional(),
  carrier: z.enum(["correios", "latam", "pickup"]).nullable().optional(),
  trackingCode: z.string().trim().max(80).nullable().optional(),
  trackingUrl: z.string().trim().max(500).nullable().optional(),
});

export const adminUpdateServiceOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // checa admin
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Apenas administradores.");

    const patch: {
      updated_at: string;
      status?: string;
      carrier?: string | null;
      tracking_code?: string | null;
      tracking_url?: string | null;
    } = { updated_at: new Date().toISOString() };
    if (data.status) patch.status = data.status;
    if (data.carrier !== undefined) patch.carrier = data.carrier;
    if (data.trackingCode !== undefined) patch.tracking_code = data.trackingCode;
    if (data.trackingUrl !== undefined) patch.tracking_url = data.trackingUrl;

    const { error } = await supabaseAdmin
      .from("service_orders")
      .update(patch)
      .eq("id", data.serviceOrderId);
    if (error) throw new Error(error.message);

    // se marcado como entregue, marca itens como delivered
    if (data.status === "delivered") {
      await supabaseAdmin
        .from("card_stack_items")
        .update({ status: "delivered", updated_at: new Date().toISOString() })
        .eq("service_order_id", data.serviceOrderId);
    }
    if (data.status === "cancelled") {
      // devolve itens à pilha
      await supabaseAdmin
        .from("card_stack_items")
        .update({ status: "stored", service_order_id: null, updated_at: new Date().toISOString() })
        .eq("service_order_id", data.serviceOrderId);
    }
    return { ok: true };
  });

const RestoreSchema = z.object({
  itemId: z.string().uuid(),
});

/**
 * Devolve um item específico (que foi finalizado em uma OS) de volta para a pilha do cliente.
 * Útil quando o admin moveu por engano um item para uma ordem de serviço.
 */
export const adminRestoreItemToStack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RestoreSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Apenas administradores.");

    const { data: item, error: itemErr } = await supabaseAdmin
      .from("card_stack_items")
      .select("id, service_order_id, stack_id")
      .eq("id", data.itemId)
      .maybeSingle();
    if (itemErr) throw new Error(itemErr.message);
    if (!item) throw new Error("Item não encontrado.");
    if (!item.service_order_id) throw new Error("Este item não está vinculado a uma ordem de serviço.");

    const { error: updErr } = await supabaseAdmin
      .from("card_stack_items")
      .update({
        status: "stored",
        service_order_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.itemId);
    if (updErr) throw new Error(updErr.message);

    return { ok: true };
  });

const CheckPaymentSchema = z.object({
  serviceOrderId: z.string().uuid(),
});

/**
 * Consulta o Mercado Pago pelo external_reference (`so:<id>`) e, se houver
 * pagamento aprovado, marca a OS como paga. Útil quando o webhook do MP não
 * chega (rede, downtime, retries esgotados).
 */
export const adminCheckServiceOrderPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CheckPaymentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Apenas administradores.");

    const { findPaymentByExternalReference } = await import("@/lib/mercadopago.server");
    const payment = await findPaymentByExternalReference(`so:${data.serviceOrderId}`);

    if (!payment) {
      return { found: false as const, status: null, message: "Nenhum pagamento encontrado no Mercado Pago." };
    }

    if (payment.status === "approved") {
      const { markServiceOrderPaid } = await import("@/lib/service-orders.server");
      await markServiceOrderPaid(data.serviceOrderId);
      return {
        found: true as const,
        status: "approved" as const,
        paymentId: payment.id,
        message: "Pagamento confirmado e OS marcada como paga.",
      };
    }

    return {
      found: true as const,
      status: payment.status,
      paymentId: payment.id,
      message: `Pagamento encontrado, mas status é "${payment.status}". OS não foi alterada.`,
    };
  });


