import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Apenas administradores.");
}

export const getMelhorEnvioAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    await assertAdmin(userId);
    const { buildAuthorizeUrl, signState } = await import("@/lib/melhorenvio.server");
    const state = signState({ uid: userId, ts: Date.now() });
    return { url: buildAuthorizeUrl(state) };
  });

export const getMelhorEnvioStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { getStoredTokens, getMelhorEnvioBaseUrl } = await import("@/lib/melhorenvio.server");
    const tokens = await getStoredTokens();
    return {
      connected: !!tokens,
      environment: tokens?.environment ?? (process.env.MELHORENVIO_ENVIRONMENT ?? "sandbox"),
      expiresAt: tokens?.expires_at ?? null,
      scope: tokens?.scope ?? null,
      baseUrl: getMelhorEnvioBaseUrl(),
      configured: !!process.env.MELHORENVIO_CLIENT_ID && !!process.env.MELHORENVIO_CLIENT_SECRET,
    };
  });

export const disconnectMelhorEnvio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { deleteStoredTokens } = await import("@/lib/melhorenvio.server");
    await deleteStoredTokens();
    return { ok: true };
  });
