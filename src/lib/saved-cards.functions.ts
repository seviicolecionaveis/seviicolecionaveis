import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listSavedCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listSavedCardsServer } = await import("./saved-cards.server");
    return listSavedCardsServer(context.userId);
  });

export const deleteSavedCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ cardId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { deleteSavedCardServer } = await import("./saved-cards.server");
    await deleteSavedCardServer(context.userId, data.cardId);
    return { ok: true };
  });

export const getMpCustomerForCheckout = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getMpCustomerIdForUser } = await import("./saved-cards.server");
    const customerId = await getMpCustomerIdForUser(context.userId);
    return { customerId };
  });
