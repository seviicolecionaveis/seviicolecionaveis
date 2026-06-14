import * as React from "react";
import { render } from "@react-email/components";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTransactionalEmailServer } from "@/lib/email/send.server";
import { TEMPLATES } from "@/lib/email-templates/registry";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Response("Erro ao verificar permissão", { status: 500 });
  if (!data) throw new Response("Acesso negado", { status: 403 });
}

export interface CouponRow {
  id: string;
  code: string;
  percent: number | null;
  amount_cents: number | null;
  balance_cents: number | null;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  active: boolean;
  user_id: string | null;
  user_email: string | null;
  notes: string | null;
  created_at: string;
  last_email_status?: string | null;
  last_email_at?: string | null;
  last_email_error?: string | null;
}

async function lastEmailFor(
  recipient: string | null,
  sinceIso: string,
): Promise<{ status: string | null; at: string | null; error: string | null }> {
  if (!recipient) return { status: null, at: null, error: null };
  const { data } = await supabaseAdmin
    .from("email_send_log")
    .select("status, created_at, error_message, message_id")
    .eq("recipient_email", recipient.toLowerCase())
    .in("template_name", ["gift-voucher", "coupon-broadcast"])
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(20);
  if (!data || data.length === 0)
    return { status: null, at: null, error: null };
  // Latest row per message_id, then pick most recent non-pending if available
  const byMsg = new Map<string, any>();
  for (const r of data) {
    if (!byMsg.has((r as any).message_id)) byMsg.set((r as any).message_id, r);
  }
  const latest = [...byMsg.values()][0] as any;
  return {
    status: latest.status ?? null,
    at: latest.created_at ?? null,
    error: latest.error_message ?? null,
  };
}

async function emailForUserId(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

export async function listCouponsServer(userId: string): Promise<CouponRow[]> {
  await assertAdmin(userId);
  const { data, error } = await supabaseAdmin
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Response(error.message, { status: 500 });
  const rows: CouponRow[] = [];
  for (const c of data ?? []) {
    const user_email = await emailForUserId((c as any).user_id);
    const last = user_email
      ? await lastEmailFor(user_email, (c as any).created_at)
      : { status: null, at: null, error: null };
    rows.push({
      ...(c as any),
      user_email,
      last_email_status: last.status,
      last_email_at: last.at,
      last_email_error: last.error,
    });
  }
  return rows;
}

interface CreateBroadcastInput {
  code: string;
  percent: number | null;
  amount_cents: number | null;
  max_uses: number;
  expires_at: string | null;
  message: string | null;
  send_email: boolean;
}

export async function createBroadcastCouponServer(
  userId: string,
  input: CreateBroadcastInput,
) {
  await assertAdmin(userId);
  const code = input.code.trim().toUpperCase();

  const { data: existing } = await supabaseAdmin
    .from("coupons")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (existing) throw new Response("Já existe um cupom com esse código.", { status: 400 });

  const { data: inserted, error } = await supabaseAdmin
    .from("coupons")
    .insert({
      code,
      percent: input.percent,
      amount_cents: input.amount_cents,
      max_uses: input.max_uses,
      expires_at: input.expires_at,
      user_id: null,
      active: true,
      notes: input.message ?? null,
    })
    .select()
    .single();
  if (error) throw new Response(error.message, { status: 500 });

  let recipients = 0;
  let queued = 0;
  if (input.send_email) {
    // Fetch all confirmed users via auth admin pagination
    const emails = new Set<string>();
    let page = 1;
    while (page < 50) {
      const { data: list, error: lerr } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (lerr) break;
      for (const u of list.users) {
        if (u.email) emails.add(u.email.toLowerCase());
      }
      if (!list.users.length || list.users.length < 1000) break;
      page++;
    }
    recipients = emails.size;
    for (const email of emails) {
      const res = await sendTransactionalEmailServer({
        templateName: "coupon-broadcast",
        recipientEmail: email,
        idempotencyKey: `coupon-broadcast:${inserted.id}:${email}`,
        templateData: {
          code: inserted.code,
          percent: inserted.percent,
          amountCents: inserted.amount_cents,
          expiresAt: inserted.expires_at,
          message: input.message,
        },
      });
      if (res.success) queued++;
    }
  }

  return { coupon: inserted, recipients, queued };
}

interface CreateVoucherInput {
  code: string;
  email: string;
  percent: number | null;
  amount_cents: number | null;
  expires_at: string | null;
  notes: string | null;
}

export async function createGiftVoucherServer(
  userId: string,
  input: CreateVoucherInput,
) {
  await assertAdmin(userId);
  const code = input.code.trim().toUpperCase();
  const email = input.email.trim().toLowerCase();

  // Find target user
  let targetId: string | null = null;
  let page = 1;
  while (page < 50 && !targetId) {
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw new Response(error.message, { status: 500 });
    const u = list.users.find((x) => x.email?.toLowerCase() === email);
    if (u) targetId = u.id;
    if (!list.users.length || list.users.length < 1000) break;
    page++;
  }
  if (!targetId)
    throw new Response("Usuário não encontrado. Peça para fazer login pelo menos uma vez.", {
      status: 404,
    });

  const { data: existing } = await supabaseAdmin
    .from("coupons")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (existing) throw new Response("Já existe um cupom com esse código.", { status: 400 });

  const { data: inserted, error } = await supabaseAdmin
    .from("coupons")
    .insert({
      code,
      percent: input.percent,
      amount_cents: input.amount_cents,
      balance_cents:
        input.amount_cents && input.amount_cents > 0 ? input.amount_cents : null,
      max_uses: input.amount_cents && input.amount_cents > 0 ? 100_000 : 1,
      expires_at: input.expires_at,
      user_id: targetId,
      active: true,
      notes: input.notes,
    })
    .select()
    .single();
  if (error) throw new Response(error.message, { status: 500 });
  return { coupon: { ...inserted, user_email: email } };
}

export interface UpdateCouponInput {
  code?: string;
  percent?: number | null;
  amount_cents?: number | null;
  balance_cents?: number | null;
  max_uses?: number;
  expires_at?: string | null;
  notes?: string | null;
  active?: boolean;
}

export async function updateCouponServer(
  userId: string,
  couponId: string,
  patch: UpdateCouponInput,
) {
  await assertAdmin(userId);
  const { data: existing, error: getErr } = await supabaseAdmin
    .from("coupons")
    .select("*")
    .eq("id", couponId)
    .maybeSingle();
  if (getErr) throw new Response(getErr.message, { status: 500 });
  if (!existing) throw new Response("Cupom não encontrado.", { status: 404 });

  const updates: Record<string, any> = {};

  if (patch.code !== undefined) {
    const code = patch.code.trim().toUpperCase();
    if (code !== existing.code) {
      const { data: dup } = await supabaseAdmin
        .from("coupons")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (dup) throw new Response("Já existe um cupom com esse código.", { status: 400 });
      updates.code = code;
    }
  }
  if (patch.percent !== undefined) updates.percent = patch.percent;
  if (patch.amount_cents !== undefined) updates.amount_cents = patch.amount_cents;
  if (patch.balance_cents !== undefined) updates.balance_cents = patch.balance_cents;
  if (patch.max_uses !== undefined) updates.max_uses = patch.max_uses;
  if (patch.expires_at !== undefined) updates.expires_at = patch.expires_at;
  if (patch.notes !== undefined) updates.notes = patch.notes;
  if (patch.active !== undefined) updates.active = patch.active;

  // Sanity: exatamente um tipo de desconto
  const finalPercent = updates.percent !== undefined ? updates.percent : existing.percent;
  const finalAmount =
    updates.amount_cents !== undefined ? updates.amount_cents : existing.amount_cents;
  if ((finalPercent && finalAmount) || (!finalPercent && !finalAmount)) {
    throw new Response(
      "Informe percentual OU valor (exatamente um).",
      { status: 400 },
    );
  }

  if (Object.keys(updates).length === 0) return { ok: true };

  const { error } = await supabaseAdmin
    .from("coupons")
    .update(updates as any)
    .eq("id", couponId);
  if (error) throw new Response(error.message, { status: 500 });
  return { ok: true };
}

export async function incrementCouponMaxUsesServer(
  userId: string,
  couponId: string,
  delta: number,
) {
  await assertAdmin(userId);
  const { data: existing, error: getErr } = await supabaseAdmin
    .from("coupons")
    .select("max_uses")
    .eq("id", couponId)
    .maybeSingle();
  if (getErr) throw new Response(getErr.message, { status: 500 });
  if (!existing) throw new Response("Cupom não encontrado.", { status: 404 });
  const next = Math.max(1, (existing.max_uses ?? 1) + delta);
  const { error } = await supabaseAdmin
    .from("coupons")
    .update({ max_uses: next, active: true })
    .eq("id", couponId);
  if (error) throw new Response(error.message, { status: 500 });
  return { ok: true, max_uses: next };
}

export async function sendGiftVoucherEmailServer(
  userId: string,
  couponId: string,
) {
  await assertAdmin(userId);
  const { data: coupon, error } = await supabaseAdmin
    .from("coupons")
    .select("*")
    .eq("id", couponId)
    .maybeSingle();
  if (error || !coupon) throw new Response("Cupom não encontrado.", { status: 404 });
  if (!coupon.user_id)
    throw new Response("Este cupom não está vinculado a um usuário.", { status: 400 });

  const email = await emailForUserId(coupon.user_id);
  if (!email) throw new Response("E-mail do usuário não encontrado.", { status: 404 });

  let recipientName: string | null = null;
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("user_id", coupon.user_id)
      .maybeSingle();
    recipientName = (profile as any)?.full_name?.split(" ")[0] ?? null;
  } catch {}

  // Pick template by type: amount → gift-voucher; percent → coupon-broadcast (personalized)
  const isAmount = coupon.amount_cents && coupon.amount_cents > 0;
  const templateName = isAmount ? "gift-voucher" : "coupon-broadcast";
  const templateData = isAmount
    ? {
        recipientName,
        code: coupon.code,
        amountCents: coupon.amount_cents,
        expiresAt: coupon.expires_at,
      }
    : {
        code: coupon.code,
        percent: coupon.percent,
        amountCents: null,
        expiresAt: coupon.expires_at,
        message: `${recipientName ? `Olá, ${recipientName}! ` : ""}Liberamos um cupom exclusivo pra você.`,
      };

  const res = await sendTransactionalEmailServer({
    templateName,
    recipientEmail: email,
    idempotencyKey: `voucher-send:${coupon.id}:${Date.now()}`,
    templateData,
  });
  if (!res.success) throw new Response(res.error || res.reason || "Falha ao enviar e-mail.", { status: 500 });
  return { ok: true, email };
}

export async function setCouponActiveServer(
  userId: string,
  couponId: string,
  active: boolean,
) {
  await assertAdmin(userId);
  const { error } = await supabaseAdmin
    .from("coupons")
    .update({ active })
    .eq("id", couponId);
  if (error) throw new Response(error.message, { status: 500 });
  return { ok: true };
}

async function countAllUserEmails(): Promise<number> {
  const emails = new Set<string>();
  let page = 1;
  while (page < 50) {
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) break;
    for (const u of list.users) if (u.email) emails.add(u.email.toLowerCase());
    if (!list.users.length || list.users.length < 1000) break;
    page++;
  }
  return emails.size;
}

export async function countBroadcastRecipientsServer(userId: string) {
  await assertAdmin(userId);
  return { count: await countAllUserEmails() };
}

export interface CouponUsageRow {
  order_id: string;
  number: number | null;
  created_at: string;
  status: string | null;
  subtotal_cents: number | null;
  discount_cents: number | null;
  total_cents: number | null;
  user_id: string | null;
  user_email: string | null;
}

export async function getCouponUsageServer(
  userId: string,
  couponId: string,
): Promise<{ code: string; rows: CouponUsageRow[] }> {
  await assertAdmin(userId);
  const { data: coupon, error: cErr } = await supabaseAdmin
    .from("coupons")
    .select("id, code")
    .eq("id", couponId)
    .maybeSingle();
  if (cErr) throw new Response(cErr.message, { status: 500 });
  if (!coupon) throw new Response("Cupom não encontrado", { status: 404 });

  const { data: orders, error: oErr } = await supabaseAdmin
    .from("orders")
    .select(
      "id, number, created_at, status, subtotal_cents, discount_cents, total_cents, user_id, coupon_code",
    )
    .eq("coupon_code", (coupon as any).code)
    .order("created_at", { ascending: false })
    .limit(200);
  if (oErr) throw new Response(oErr.message, { status: 500 });

  const rows: CouponUsageRow[] = [];
  for (const o of orders ?? []) {
    const email = await emailForUserId((o as any).user_id);
    rows.push({
      order_id: (o as any).id,
      number: (o as any).number ?? null,
      created_at: (o as any).created_at,
      status: (o as any).status ?? null,
      subtotal_cents: (o as any).subtotal_cents ?? null,
      discount_cents: (o as any).discount_cents ?? null,
      total_cents: (o as any).total_cents ?? null,
      user_id: (o as any).user_id ?? null,
      user_email: email,
    });
  }
  return { code: (coupon as any).code, rows };
}

interface PreviewInput {
  kind: "broadcast" | "voucher";
  code: string;
  percent: number | null;
  amount_cents: number | null;
  expires_at: string | null;
  message?: string | null;
  recipient_email?: string | null;
}

export async function previewCouponEmailServer(
  userId: string,
  input: PreviewInput,
) {
  await assertAdmin(userId);
  let recipientName: string | null = null;
  if (input.kind === "voucher" && input.recipient_email) {
    // Best-effort name lookup
    const email = input.recipient_email.toLowerCase();
    let page = 1;
    while (page < 50) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error) break;
      const u = list.users.find((x) => x.email?.toLowerCase() === email);
      if (u) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("user_id", u.id)
          .maybeSingle();
        recipientName = ((profile as any)?.full_name?.split(" ")[0]) ?? null;
        break;
      }
      if (!list.users.length || list.users.length < 1000) break;
      page++;
    }
  }

  const isAmount = input.kind === "voucher" && !!input.amount_cents;
  const templateName = isAmount ? "gift-voucher" : "coupon-broadcast";
  const entry = TEMPLATES[templateName];
  if (!entry) throw new Response("Template não encontrado", { status: 500 });

  const data: Record<string, any> = isAmount
    ? {
        recipientName,
        code: input.code,
        amountCents: input.amount_cents,
        expiresAt: input.expires_at,
      }
    : {
        code: input.code,
        percent: input.percent,
        amountCents: input.amount_cents,
        expiresAt: input.expires_at,
        message:
          input.kind === "voucher"
            ? `${recipientName ? `Olá, ${recipientName}! ` : ""}Liberamos um cupom exclusivo pra você.`
            : input.message ?? null,
      };

  const subject =
    typeof entry.subject === "function" ? entry.subject(data) : entry.subject;
  const element = React.createElement(entry.component as any, data);
  const html = await render(element);
  return { html, subject };
}

