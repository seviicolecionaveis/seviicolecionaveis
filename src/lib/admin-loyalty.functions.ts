import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const adminSearchLoyaltyUsers = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ query: z.string().trim().min(1).max(255) }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { searchLoyaltyUsers } = await import("./admin-loyalty.server");
    return searchLoyaltyUsers(context.userId, data.query);
  });

export const adminGetUserLoyaltyDetail = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { getUserLoyaltyDetail } = await import("./admin-loyalty.server");
    return getUserLoyaltyDetail(context.userId, data.user_id);
  });

export const adminAdjustUserPoints = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().uuid(),
        delta: z.number().int().min(-1_000_000).max(1_000_000).refine((v) => v !== 0, "delta != 0"),
        description: z.string().trim().max(500).default(""),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { adjustUserPoints } = await import("./admin-loyalty.server");
    return adjustUserPoints(context.userId, data.user_id, data.delta, data.description);
  });

export const adminGetLoyaltyStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getLoyaltyStats } = await import("./admin-loyalty.server");
    return getLoyaltyStats(context.userId);
  });
