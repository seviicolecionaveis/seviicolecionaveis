import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendArteEmCardsDiscontinuedNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sendArteEmCardsDiscontinuedNoticeServer } = await import(
      "./admin-arte-em-cards-notice.server"
    );
    return sendArteEmCardsDiscontinuedNoticeServer(context.userId);
  });
