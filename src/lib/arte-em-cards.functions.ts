import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const validateArteEmCardsCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ code: z.string().trim().min(1).max(40) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { validateCodeForUser } = await import("./arte-em-cards.server");
    const result = await validateCodeForUser(context.userId, data.code);
    if (result.valid) {
      return {
        valid: true as const,
        code: result.code,
        cycleEnd: result.cycleEnd.toISOString(),
      };
    }
    return { valid: false as const, reason: result.reason };
  });

export const getMyArteEmCardsCode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { findActiveCodeForUser, getCurrentCycleBounds } = await import(
      "./arte-em-cards.server"
    );
    const active = await findActiveCodeForUser(context.userId);
    const { cycleEnd } = getCurrentCycleBounds();
    if (!active) {
      return {
        hasCode: false as const,
        nextCycleEnd: cycleEnd.toISOString(),
      };
    }
    return {
      hasCode: true as const,
      code: active.code,
      cycleEnd: active.cycleEnd.toISOString(),
    };
  });
