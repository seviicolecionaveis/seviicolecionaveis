import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getEmailLogs = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      hours: z.number().int().min(1).max(720).default(168),
      template: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(100),
    }).parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { isAdmin } = await import("@/lib/order-cancellation.server");
    if (!(await isAdmin(context.userId))) throw new Response("Acesso negado", { status: 403 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.hours * 3600 * 1000).toISOString();

    const { data: rows, error } = await (supabaseAdmin as any)
      .from("email_send_log")
      .select("message_id, template_name, recipient_email, status, error_message, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Response(error.message, { status: 500 });

    // Deduplicate by message_id (keep latest)
    const seen = new Map<string, any>();
    for (const r of rows ?? []) {
      const key = r.message_id ?? r.id;
      if (!seen.has(key)) seen.set(key, r);
    }
    let latest = Array.from(seen.values());

    if (data.template) latest = latest.filter((r) => r.template_name === data.template);
    if (data.status) latest = latest.filter((r) => r.status === data.status);

    const stats = {
      total: latest.length,
      sent: latest.filter((r) => r.status === "sent").length,
      pending: latest.filter((r) => r.status === "pending").length,
      failed: latest.filter((r) => ["failed", "dlq"].includes(r.status)).length,
      suppressed: latest.filter((r) => r.status === "suppressed").length,
    };

    const templates = Array.from(
      new Set((rows ?? []).map((r: any) => r.template_name as string)),
    ).sort() as string[];

    return {
      logs: latest.slice(0, data.limit),
      stats,
      templates,
    };
  });
