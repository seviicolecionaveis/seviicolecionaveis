import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EmailLogRow = {
  message_id: string;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
  subject: string | null;
  body_html: string | null;
  from_email: string | null;
  batch_id: string | null;
};

export type EmailLogGroup = {
  key: string;
  template_name: string;
  batch_id: string | null;
  created_at: string; // most recent
  recipients_count: number;
  status_counts: Record<string, number>;
  items: EmailLogRow[];
};

export const getEmailLogs = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      hours: z.number().int().min(1).max(720).default(168),
      template: z.string().optional(),
      status: z.string().optional(),
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
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
      .select(
        "message_id, template_name, recipient_email, status, error_message, created_at, subject, body_html, from_email, batch_id",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Response(error.message, { status: 500 });

    // Deduplicate by message_id (keep latest = first, since desc order)
    // Merge rows sharing the same message_id: latest row wins for status/error/date,
    // but fill in subject/body_html/from_email/batch_id from any sibling row that has them
    // (the initial 'pending' row carries those fields; the later 'sent' row does not).
    const seen = new Map<string, EmailLogRow>();
    for (const r of (rows ?? []) as EmailLogRow[]) {
      const key = r.message_id ?? (r as any).id;
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, { ...r });
      } else {
        existing.subject = existing.subject ?? r.subject ?? null;
        existing.body_html = existing.body_html ?? r.body_html ?? null;
        existing.from_email = existing.from_email ?? r.from_email ?? null;
        existing.batch_id = existing.batch_id ?? r.batch_id ?? null;
      }
    }

    let latest = Array.from(seen.values());

    // Filters
    if (data.template) latest = latest.filter((r) => r.template_name === data.template);
    if (data.status) {
      if (data.status === "failed") {
        latest = latest.filter((r) => ["failed", "dlq"].includes(r.status));
      } else {
        latest = latest.filter((r) => r.status === data.status);
      }
    }
    if (data.search) {
      const q = data.search.toLowerCase();
      latest = latest.filter(
        (r) =>
          (r.recipient_email ?? "").toLowerCase().includes(q) ||
          (r.template_name ?? "").toLowerCase().includes(q) ||
          (r.subject ?? "").toLowerCase().includes(q),
      );
    }

    // Global stats (on filtered set, counts individual recipients)
    const stats = {
      total: latest.length,
      sent: latest.filter((r) => r.status === "sent").length,
      pending: latest.filter((r) => r.status === "pending").length,
      failed: latest.filter((r) => ["failed", "dlq"].includes(r.status)).length,
      suppressed: latest.filter((r) => r.status === "suppressed").length,
    };

    // Group: prefer batch_id; else group by (template_name + minute) when >1
    const buckets = new Map<string, EmailLogRow[]>();
    for (const r of latest) {
      const minute = (r.created_at ?? "").slice(0, 16); // YYYY-MM-DDTHH:MM
      const key = r.batch_id
        ? `b:${r.batch_id}`
        : `t:${r.template_name}|${minute}`;
      const arr = buckets.get(key) ?? [];
      arr.push(r);
      buckets.set(key, arr);
    }

    const groups: EmailLogGroup[] = Array.from(buckets.entries()).map(([key, items]) => {
      // If not a real batch and only 1 item, keep as ungrouped single row
      const counts: Record<string, number> = {};
      for (const it of items) counts[it.status] = (counts[it.status] ?? 0) + 1;
      const created = items.reduce(
        (acc, it) => (it.created_at > acc ? it.created_at : acc),
        items[0].created_at,
      );
      return {
        key,
        template_name: items[0].template_name,
        batch_id: items[0].batch_id ?? null,
        created_at: created,
        recipients_count: items.length,
        status_counts: counts,
        items,
      };
    });

    // Sort groups by most recent
    groups.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    const total = groups.length;
    const start = (data.page - 1) * data.pageSize;
    const paged = groups.slice(start, start + data.pageSize);

    const templates = Array.from(
      new Set((rows ?? []).map((r: any) => r.template_name as string)),
    ).sort() as string[];

    return {
      groups: paged,
      stats,
      templates,
      pagination: {
        page: data.page,
        pageSize: data.pageSize,
        totalGroups: total,
        totalPages: Math.max(1, Math.ceil(total / data.pageSize)),
      },
    };
  });
