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

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
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
