import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTransactionalEmailSafe } from "@/lib/email/send.server";

export async function sendArteEmCardsDiscontinuedNoticeServer(userId: string) {
  // Confirma admin
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) throw new Error("Acesso negado");

  // Busca todos os service_orders com retirada Arte em Cards
  const { data: rows, error } = await supabaseAdmin
    .from("service_orders")
    .select("user_id, recipient_name")
    .eq("method", "arte_em_cards");
  if (error) throw new Error(error.message);

  // Um envio por usuário — dedup mantendo o recipient_name mais recente
  const perUser = new Map<string, { recipientName: string | null }>();
  for (const r of rows ?? []) {
    if (!r.user_id) continue;
    if (!perUser.has(r.user_id)) {
      perUser.set(r.user_id, { recipientName: r.recipient_name ?? null });
    }
  }

  const seenEmails = new Set<string>();
  let enqueued = 0;
  let skipped = 0;

  for (const [uid, info] of perUser) {
    try {
      const { data: userRes } = await (supabaseAdmin as any).auth.admin.getUserById(uid);
      const email: string | undefined = userRes?.user?.email;
      if (!email) {
        skipped++;
        continue;
      }
      const key = email.toLowerCase();
      if (seenEmails.has(key)) {
        skipped++;
        continue;
      }
      seenEmails.add(key);

      const firstName = info.recipientName?.split(/\s+/)[0] ?? null;
      const res = await sendTransactionalEmailSafe({
        templateName: "arte-em-cards-descontinuada",
        recipientEmail: email,
        idempotencyKey: `arte-em-cards-descontinuada-v1-${uid}`,
        templateData: { recipientName: firstName },
      });
      if (res.success) enqueued++;
      else skipped++;
    } catch (e) {
      console.error("[arte-em-cards-notice] erro por usuário", uid, e);
      skipped++;
    }
  }

  return { enqueued, skipped, totalUsers: perUser.size };
}
