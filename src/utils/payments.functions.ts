import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PixInputSchema, StripeInputSchema } from "./payments.schemas";
import {
  checkPixOrderStatusServer,
  createOrderCheckoutServer,
  createPixOrderServer,
} from "./payments.server";

export const createOrderCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => StripeInputSchema.parse(data))
  .handler(async ({ data, context }) => createOrderCheckoutServer(data, context.userId));

export const createPixOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PixInputSchema.parse(data))
  .handler(async ({ data, context }) => createPixOrderServer(data, context.userId));

export const checkPixOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => checkPixOrderStatusServer(data.orderId, context.userId));
