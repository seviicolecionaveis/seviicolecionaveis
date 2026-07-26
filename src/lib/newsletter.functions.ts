import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Public: subscribe to newsletter
export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        firstName: z.string().trim().max(80).optional(),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    const { upsertContact, ensureNewsletterListId } = await import(
      "./brevo.server"
    );
    const listId = await ensureNewsletterListId();
    await upsertContact({
      email: data.email,
      firstName: data.firstName ?? null,
      listIds: [listId],
      attributes: { OPT_IN: true, SOURCE: "site_footer" },
    });
    return { ok: true };
  });

// Admin: connection status + counts
export const getBrevoStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Response("Acesso negado", { status: 403 });

    if (!process.env.BREVO_API_KEY) {
      return { configured: false as const };
    }
    try {
      const { getAccount, ensureNewsletterListId, ensureCustomersListId } =
        await import("./brevo.server");
      const account = await getAccount();
      const newsletterListId = await ensureNewsletterListId();
      const customersListId = await ensureCustomersListId();
      return {
        configured: true as const,
        connected: true as const,
        accountEmail: account.email,
        newsletterListId,
        customersListId,
      };
    } catch (e: any) {
      return {
        configured: true as const,
        connected: false as const,
        error: e?.message ?? "Falha ao conectar Brevo",
      };
    }
  });

// Admin: sync all existing customers (profiles with email) into Brevo Clientes list
export const syncExistingCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Response("Acesso negado", { status: 403 });

    const { upsertContact, ensureCustomersListId, ensureNewsletterListId } =
      await import("./brevo.server");
    const customersListId = await ensureCustomersListId();
    const newsletterListId = await ensureNewsletterListId();

    // page through users via auth admin
    let page = 1;
    let total = 0;
    let synced = 0;
    let failed = 0;
    const PER_PAGE = 200;
    while (page < 50) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: PER_PAGE,
      });
      if (error) throw new Response(error.message, { status: 500 });
      const users = list?.users ?? [];
      if (users.length === 0) break;

      // fetch matching profiles in one query
      const ids = users.map((u) => u.id);
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name, whatsapp, birth_date")
        .in("user_id", ids);
      const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

      for (const u of users) {
        if (!u.email) continue;
        total++;
        const p = byId.get(u.id);
        const firstName = (p?.full_name ?? "").trim().split(/\s+/)[0] || null;
        const lastName =
          (p?.full_name ?? "").trim().split(/\s+/).slice(1).join(" ") || null;
        try {
          await upsertContact({
            email: u.email,
            firstName,
            lastName,
            sms: p?.whatsapp ?? null,
            birthday: p?.birth_date ?? null,
            listIds: [customersListId, newsletterListId],
            attributes: { SOURCE: "account_sync" },
          });
          synced++;
        } catch (e) {
          console.error("[syncExistingCustomers]", u.email, e);
          failed++;
        }
      }

      if (users.length < PER_PAGE) break;
      page++;
    }
    return { total, synced, failed };
  });

// Admin: send loyalty program launch campaign to Newsletter + Clientes lists
export const sendLoyaltyLaunchCampaign = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        senderEmail: z.string().trim().email().max(255),
        senderName: z.string().trim().min(1).max(80),
        subject: z
          .string()
          .trim()
          .min(1)
          .max(150)
          .default("🎉 Novidade: Programa de Pontos Sevii"),
      })
      .parse(d)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Response("Acesso negado", { status: 403 });

    const {
      ensureNewsletterListId,
      ensureCustomersListId,
      ensureSender,
      createEmailCampaign,
      sendCampaignNow,
    } = await import("./brevo.server");

    const sender = await ensureSender({
      name: data.senderName,
      email: data.senderEmail,
    });
    if (!sender.active) {
      return {
        ok: false as const,
        reason:
          "Remetente não verificado na Brevo. Confira o e-mail enviado pela Brevo para validar o remetente e tente novamente.",
      };
    }

    const newsletterListId = await ensureNewsletterListId();
    const customersListId = await ensureCustomersListId();

    const html = launchHtml();
    const campaign = await createEmailCampaign({
      name: `Programa de Pontos — lançamento ${new Date()
        .toISOString()
        .slice(0, 16)}`,
      subject: data.subject,
      htmlContent: html,
      sender: { id: sender.id, name: data.senderName, email: data.senderEmail },
      listIds: [newsletterListId, customersListId],
      replyTo: data.senderEmail,
    });
    await sendCampaignNow(campaign.id);
    return { ok: true as const, campaignId: campaign.id };
  });

function launchHtml() {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>Programa de Pontos Sevii</title></head>
<body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="padding:0 24px 16px;text-align:center;">
          <h1 style="margin:0;font-size:26px;line-height:1.2;color:#20a5c9;">Programa de Pontos Sevii 🎉</h1>
        </td></tr>
        <tr><td style="padding:0 24px;font-size:15px;line-height:1.55;">
          <p>Olá! Temos uma novidade especial pra você.</p>
          <p>Agora, <strong>toda compra na Sevii Colecionáveis vira pontos</strong> que valem desconto nas próximas — sem complicação.</p>
        </td></tr>
        <tr><td style="padding:16px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f9fc;border:1px solid #cfeaf3;border-radius:10px;">
            <tr><td style="padding:16px 18px;font-size:14px;line-height:1.6;">
              <strong style="color:#20a5c9;">Como funciona</strong><br />
              • <strong>1 ponto a cada R$ 5,00</strong> em todo pedido pago<br />
              • <strong>100 pontos = R$ 5,00</strong> de desconto<br />
              • <strong>+50 pts</strong> de boas-vindas ao criar conta<br />
              • <strong>+100 pts</strong> no seu aniversário 🎂<br />
              • Níveis <strong>Bronze, Prata e Ouro</strong> com multiplicador de pontos
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:8px 24px 24px;text-align:center;">
          <a href="https://www.seviicolecionaveis.com.br/conta" style="display:inline-block;background:#20a5c9;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;">Ver meus pontos</a>
        </td></tr>
        <tr><td style="padding:0 24px;font-size:13px;color:#64748b;line-height:1.55;">
          <p>Já tem conta? <strong>Cadastre sua data de nascimento</strong> em “Minha conta › Dados” para receber os 100 pontos de aniversário automaticamente.</p>
        </td></tr>
        <tr><td style="padding:24px;text-align:center;font-size:12px;color:#94a3b8;">
          Sevii Colecionáveis · Aracaju, Sergipe<br />
          Cartas originais com garantia de autenticidade
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
