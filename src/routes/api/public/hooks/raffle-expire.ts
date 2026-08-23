import { createFileRoute } from "@tanstack/react-router";
import { verifyCronAuth } from "@/lib/cron-auth.server";

export const Route = createFileRoute("/api/public/hooks/raffle-expire")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = verifyCronAuth(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await (supabaseAdmin as any).rpc("raffle_expire_reservations");
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        return Response.json({ ok: true, expired: data ?? 0 });
      },
    },
  },
});
