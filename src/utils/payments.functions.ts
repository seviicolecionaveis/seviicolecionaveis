import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PixInputSchema, StripeInputSchema } from "./payments.schemas";

export const createOrderCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => StripeInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { createOrderCheckoutServer } = await import("./payments.server");
    return createOrderCheckoutServer(data, context.userId);
  });

export const createPixOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PixInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { createPixOrderServer } = await import("./payments.server");
    return createPixOrderServer(data, context.userId);
  });

export const checkPixOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { checkPixOrderStatusServer } = await import("./payments.server");
    return checkPixOrderStatusServer(data.orderId, context.userId);
  });
