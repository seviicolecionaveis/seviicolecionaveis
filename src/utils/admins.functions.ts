import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { grantAdminServer, listAdminsServer, revokeAdminServer } from "./admins.server";

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listAdminsServer(context.userId));

export const grantAdmin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().trim().email().max(255) }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => grantAdminServer(context.userId, data.email));

export const revokeAdmin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => revokeAdminServer(context.userId, data.user_id));
