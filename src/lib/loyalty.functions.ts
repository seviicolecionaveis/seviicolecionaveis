import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyLoyaltyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const [balRes, lifeRes, tierRes, multRes] = await Promise.all([
      supabaseAdmin.rpc("user_points_balance", { _user_id: userId }),
      supabaseAdmin.rpc("user_lifetime_earned", { _user_id: userId }),
      supabaseAdmin.rpc("user_tier", { _user_id: userId }),
      supabaseAdmin.rpc("user_tier_multiplier_bp", { _user_id: userId }),
    ]);

    const balance = Number(balRes.data ?? 0) || 0;
    const lifetimeEarned = Number(lifeRes.data ?? 0) || 0;
    const tier = (tierRes.data as string) || "bronze";
    const multiplierBp = Number(multRes.data ?? 10000) || 10000;

    const { data: history } = await supabaseAdmin
      .from("loyalty_points_ledger")
      .select("id, delta, reason, description, order_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    // Próxima expiração: crédito mais antigo ainda "não consumido" por débitos.
    // Aproximação: data do crédito positivo mais antigo + 12 meses, se houver saldo > 0.
    let nextExpirationAt: string | null = null;
    if (balance > 0) {
      const { data: oldest } = await supabaseAdmin
        .from("loyalty_points_ledger")
        .select("created_at")
        .eq("user_id", userId)
        .gt("delta", 0)
        .in("reason", ["signup", "birthday", "order_earned", "admin_adjust", "refund"])
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (oldest) {
        const d = new Date(oldest.created_at);
        d.setMonth(d.getMonth() + 12);
        nextExpirationAt = d.toISOString();
      }
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("birth_date")
      .eq("user_id", userId)
      .maybeSingle();

    return {
      balance,
      lifetimeEarned,
      tier,
      multiplierBp,
      nextExpirationAt,
      birthDate: profile?.birth_date ?? null,
      history: history ?? [],
    };
  });

export const previewPointsRedemption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        points: z.number().int().min(0).max(10_000_000),
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
