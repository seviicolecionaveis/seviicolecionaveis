import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listAdminsServer } = await import("./admins.server");
    return listAdminsServer(context.userId);
  });

export const grantAdmin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().trim().email().max(255) }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { grantAdminServer } = await import("./admins.server");
    return grantAdminServer(context.userId, data.email);
  });

export const revokeAdmin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { revokeAdminServer } = await import("./admins.server");
    return revokeAdminServer(context.userId, data.user_id);
  });
