import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyLoyaltyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: balRow } = await supabaseAdmin
      .rpc("user_points_balance", { _user_id: userId });
    const balance = typeof balRow === "number" ? balRow : Number(balRow ?? 0);

    const { data: history } = await supabaseAdmin
      .from("loyalty_points_ledger")
      .select("id, delta, reason, description, order_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    return { balance: balance || 0, history: history ?? [] };
  });

export const previewPointsRedemption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        points: z.number().int().min(0).max(10_000_000),
        // Base de centavos sobre a qual o desconto pode incidir (subtotal − cupom etc.).
        maxDiscountableCents: z.number().int().min(0).max(100_000_000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizeRedeemPoints, pointsToDiscountCents } = await import("./loyalty");
    const { data: balRow } = await supabaseAdmin
      .rpc("user_points_balance", { _user_id: context.userId });
    const balance = Number(balRow ?? 0);
    const points = normalizeRedeemPoints(data.points, balance, data.maxDiscountableCents);
    return {
      balance,
      points,
      discountCents: pointsToDiscountCents(points),
    };
  });
