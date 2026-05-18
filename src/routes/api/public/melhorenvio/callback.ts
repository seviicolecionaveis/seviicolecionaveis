import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/melhorenvio/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        const redirectTo = (path: string) =>
          new Response(null, { status: 302, headers: { Location: path } });

        if (error) {
          return redirectTo(`/admin?melhorenvio=error&reason=${encodeURIComponent(error)}`);
        }
        if (!code || !state) {
          return redirectTo(`/admin?melhorenvio=error&reason=missing_params`);
        }

        const { verifyState, exchangeCodeForToken } = await import("@/lib/melhorenvio.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const payload = verifyState(state);
        if (!payload) {
          return redirectTo(`/admin?melhorenvio=error&reason=invalid_state`);
        }

        // Confirma que quem iniciou ainda é admin
        const { data: role } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", payload.uid)
          .eq("role", "admin")
          .maybeSingle();
        if (!role) {
          return redirectTo(`/admin?melhorenvio=error&reason=not_admin`);
        }

        try {
          await exchangeCodeForToken(code);
          return redirectTo(`/admin?melhorenvio=connected`);
        } catch (e: any) {
          console.error("[MelhorEnvio callback] erro:", e?.message);
          return redirectTo(
            `/admin?melhorenvio=error&reason=${encodeURIComponent(e?.message ?? "exchange_failed")}`,
          );
        }
      },
    },
  },
});
