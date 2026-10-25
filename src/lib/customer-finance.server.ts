import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin as db } from '@/integrations/supabase/client.server';
import type { Database, Json } from '@/integrations/supabase/types';
import { confirmedRefund } from './customer-finance';
import { sendTransactionalEmailSafe } from './email/send.server';

type Refund = Database['public']['Tables']['customer_refunds']['Row'];
type Attempt = Database['public']['Tables']['customer_payment_attempts']['Row'];
function objectResult<T>(data: Json): T { return data as unknown as T; }
export async function assertFinanceAdmin(actor: string) {
  const { error } = await db.rpc('finance_assert_admin', { p_actor: actor });
  if (error) throw new Error('Acesso permitido somente a administradores ativos.');
}
export const hashRefundToken = (token: string) => createHash('sha256').update(token).digest('hex');
function validHash(token: string, hash: string) {
  if (!/^[a-f0-9]{64}$/.test(token) || !/^[a-f0-9]{64}$/.test(hash)) return false;
  return timingSafeEqual(Buffer.from(hashRefundToken(token), 'hex'), Buffer.from(hash, 'hex'));
}
export async function financeAction(id: string, actor: string, action: string, reason: string, extras?: { hash?: string; amount?: number; reference?: string }) {
  const { data, error } = await db.rpc('finance_refund_action', {
    p_id: id, p_actor: actor, p_action: action, p_reason: reason,
    p_hash: extras?.hash, p_external: extras?.amount, p_reference: extras?.reference,
  });
  if (error) throw new Error('Não foi possível executar esta ação: verifique situação, limite e justificativa.');
  return objectResult<Refund>(data);
}
export async function sendFinanceNotice(r: Refund, event: string, link?: string) {
  const { data: order } = await db.from('orders').select('email,recipient_name').eq('id', r.order_id).single();
  const result = order?.email ? await sendTransactionalEmailSafe({
    templateName: 'customer-finance', recipientEmail: order.email,
    idempotencyKey: `finance:${r.id}:${event}:${r.token_version}`,
    templateData: { recipientName: order.recipient_name, orderId: r.order_id, amountCents: r.amount_cents, reason: r.reason, event, link },
  }) : { success: false, reason: 'missing_recipient' };
  await db.from('customer_refunds').update({ email_status: result.success ? 'sent' : 'failed' }).eq('id', r.id);
  if (event !== 'invite') {
    const { data: setting } = await db.from('app_settings').select('value').eq('key', 'schedule_confirmation_email').maybeSingle();
    const v = setting?.value;
    const recipient = v && typeof v === 'object' && !Array.isArray(v) && typeof v.email === 'string' ? v.email : 'seviicolecionaveis@gmail.com';
    await sendTransactionalEmailSafe({ templateName: 'customer-finance', recipientEmail: recipient,
      idempotencyKey: `finance-store:${r.id}:${event}`, templateData: { orderId: r.order_id, amountCents: r.amount_cents, reason: r.reason, event, link: 'https://seviicolecionaveis.com.br/admin/reembolsos' } });
  }
  return result.success;
}
export async function createFinanceRefund(actor: string, input: { orderId: string; itemId?: string; amountCents: number; reason: string; key: string }) {
  await assertFinanceAdmin(actor);
  const token = randomBytes(32).toString('hex');
  const { data, error } = await db.rpc('finance_create_refund', { p_order: input.orderId, p_item: input.itemId ?? null as unknown as string, p_actor: actor, p_amount: input.amountCents, p_reason: input.reason, p_hash: hashRefundToken(token), p_key: input.key });
  if (error) throw new Error('Não foi possível criar: confira pagamento confirmado, item e limite disponível.');
  const r = objectResult<Refund>(data);
  // A replay must never send a new token whose hash was not stored.
  const { data: stored } = await db.from('customer_refunds').select('token_hash').eq('id', r.id).single();
  if (stored?.token_hash !== hashRefundToken(token)) return { refund: r, sent: r.email_status === 'sent' };
  const sent = await sendFinanceNotice(r, 'invite', `https://seviicolecionaveis.com.br/reembolso/${r.id}#${token}`);
  return { refund: r, sent };
}
export async function renewFinanceRefund(actor: string, id: string, reason: string) {
  const token = randomBytes(32).toString('hex');
  const r = await financeAction(id, actor, 'renew', reason, { hash: hashRefundToken(token) });
  return { sent: await sendFinanceNotice(r, 'invite', `https://seviicolecionaveis.com.br/reembolso/${id}#${token}`) };
}
export async function readRefundLink(id: string, token: string) {
  const { data: r } = await db.from('customer_refunds').select('*').eq('id', id).maybeSingle();
  if (!r || !validHash(token, r.token_hash) || r.status === 'revoked') throw new Error('Link inválido ou revogado.');
  const expired = Date.parse(r.token_expires_at) <= Date.now();
  if (expired && r.status === 'awaiting_choice') throw new Error('Este link expirou. Solicite um novo à loja.');
  const { data: order } = await db.from('orders').select('recipient_name').eq('id', r.order_id).single();
  return { id: r.id, orderId: r.order_id, name: order?.recipient_name?.split(/\s+/)[0] ?? '', amountCents: r.amount_cents, reason: r.reason, status: r.status };
}
export async function chooseFinanceRefund(id: string, token: string, choice: 'credit' | 'original') {
  const { data, error } = await db.rpc('finance_choose_refund', { p_id: id, p_hash: hashRefundToken(token), p_choice: choice });
  if (error) throw new Error('Link expirado, inválido ou já utilizado. Nenhum novo crédito foi gerado.');
  const r = objectResult<Refund>(data);
  await sendFinanceNotice(r, choice === 'credit' ? 'credited' : 'awaiting_approval');
  return { status: r.status };
}
export async function processFinanceRefund(actor: string, id: string, reason: string) {
  const r = await financeAction(id, actor, 'process', reason);
  try {
    if (r.provider_cents === 0) {
      const done = await financeAction(id, actor, 'complete', reason, { amount: 0 });
      await sendFinanceNotice(done, 'refunded'); return done;
    }
    if (!r.provider_id) return r; // Original non-MP payment requires explicit manual completion.
    const { getPixPayment, refundMercadoPagoPayment, getMercadoPagoRefund } = await import('./mercadopago.server');
    const original = await getPixPayment(r.provider_id);
    if (original.external_reference !== r.order_id || original.currency_id !== 'BRL' || (original.amount_cents ?? 0) < r.provider_cents) throw new Error('Original payment mismatch');
    const result = r.provider_refund_id
      ? await getMercadoPagoRefund(r.provider_id, r.provider_refund_id)
      : await refundMercadoPagoPayment(r.provider_id, r.provider_cents, `sevii-refund:${r.id}`);
    const saved = await db.from('customer_refunds').update({ provider_refund_id: String(result.id) }).eq('id', r.id).select('id').single();
    if (saved.error || !saved.data) throw new Error('Refund evidence persistence failed');
    // Query the particular refund, never infer success from the payment's aggregate state.
    const remote = await getMercadoPagoRefund(r.provider_id, String(result.id));
    if (confirmedRefund(remote, r.provider_cents)) {
      const done = await financeAction(id, actor, 'complete', 'Estorno confirmado no Mercado Pago', { amount: r.provider_cents, reference: String(remote.id) });
      await sendFinanceNotice(done, 'refunded'); return done;
    }
    await sendFinanceNotice(r, 'processing'); return r;
  } catch {
    // Timeouts have an unknown result: same persisted key on retry, capacity remains committed.
    const review = await financeAction(id, actor, 'review', 'Retorno externo pendente de conciliação');
    await sendFinanceNotice(review, 'review'); return review;
  }
}
export async function reserveStoreCredit(orderId: string, userId: string, credit: number, provider: string, environment: 'sandbox' | 'live' = 'live') {
  if (!credit) return null;
  const { data, error } = await db.rpc('finance_reserve_payment', { p_order: orderId, p_user: userId, p_credit: credit, p_provider: provider, p_key: `checkout:${orderId}` });
  if (error) throw new Error('Saldo indisponível ou outra tentativa de pagamento em aberto.');
  const attempt = objectResult<Attempt>(data);
  const saved = await db.from('customer_payment_attempts').update({provider_environment:environment}).eq('id',attempt.id).select('id').single();
  if (saved.error) throw new Error('Não foi possível registrar ambiente de pagamento.');
  return {...attempt,provider_environment:environment};
}
export async function prepareExistingCreditPayment(orderId: string, owner: string, actor: string | null, requested: number) {
  const { data: attempts, error } = await db.from('customer_payment_attempts').select('*').eq('order_id', orderId).order('created_at', { ascending: false });
  if (error) throw new Error('Não foi possível conferir as tentativas anteriores.');
  const active = attempts?.find(t => ['reserved', 'pending', 'approved', 'review'].includes(t.status));
  if (active) {
    if (!(await releaseStoreCreditIfTerminal(orderId))) throw new Error('Pagamento anterior ainda está em aberto. Aguarde a confirmação ou expiração.');
  }
  if (!requested) return null;
  if (!actor || actor !== owner) throw new Error('Somente o titular autenticado pode autorizar uso do saldo.');
  // Do not reserve against an older provider payment whose outcome is unknown.
  const { data: order } = await db.from('orders').select('mercadopago_payment_id,stripe_session_id').eq('id',orderId).single();
  if (order?.mercadopago_payment_id && !active) {
    const { getPixPayment } = await import('./mercadopago.server');
    const old = await getPixPayment(order.mercadopago_payment_id);
    if (!['cancelled','rejected'].includes(old.status)) throw new Error('Concilie o pagamento anterior antes de usar saldo.');
  }
  if (order?.stripe_session_id) throw new Error('Concilie o pagamento anterior com cartão antes de usar saldo.');
  const { data, error: reserveError } = await db.rpc('finance_reserve_payment', { p_order: orderId, p_user: owner, p_credit: requested, p_provider: 'mercadopago', p_key: `existing:${orderId}:${randomBytes(16).toString('hex')}` });
  if (reserveError) throw new Error('Saldo indisponível ou tentativa em aberto.');
  return objectResult<Attempt>(data);
}
export async function attachCreditProvider(attempt: Attempt | null, providerId: string) {
  if (!attempt) return;
  const { data, error } = await db.from('customer_payment_attempts').update({ provider_id: providerId, status: 'pending' }).eq('id', attempt.id).eq('status', 'reserved').select('id').single();
  if (error || !data) throw new Error('Pagamento criado; aguarde a conciliação antes de tentar novamente.');
}
export async function settleStoreCredit(orderId: string, ref?: { mercadopagoPaymentId?: string; stripePaymentIntent?: string }) {
  const { data: t, error } = await db.from('customer_payment_attempts').select('*').eq('order_id', orderId).neq('status', 'released').maybeSingle();
  if (error) throw new Error('Não foi possível conferir pagamento com saldo.');
  if (!t) {
    const { count } = await db.from('customer_payment_attempts').select('id', { count: 'exact', head: true }).eq('order_id',orderId);
    if (count) throw new Error('Pagamento tardio após liberação de saldo: conciliação necessária.');
    return;
  }
  if (t.status === 'approved') return;
  let providerId = t.provider_id; let amount = 0; let currency = 'BRL';
  if (t.provider === 'mercadopago') {
    if (!ref?.mercadopagoPaymentId || ref.mercadopagoPaymentId !== providerId) throw new Error('Tentativa de pagamento diferente: conciliação necessária.');
    const { getPixPayment } = await import('./mercadopago.server');
    const remote = await getPixPayment(providerId ?? '');
    if (remote.status !== 'approved' || remote.external_reference !== orderId) throw new Error('Pagamento ainda não confirmado.');
    amount = remote.amount_cents ?? -1; currency = remote.currency_id ?? '';
  } else if (t.provider === 'stripe') {
    const { createStripeClient } = await import('./stripe.server');
    const stripe = createStripeClient(t.provider_environment === 'sandbox' ? 'sandbox' : 'live');
    const session = await stripe.checkout.sessions.retrieve(providerId ?? '');
    if (session.payment_status !== 'paid' || session.metadata?.orderId !== orderId) throw new Error('Pagamento ainda não confirmado.');
    amount = session.amount_total ?? -1; currency = (session.currency ?? '').toUpperCase();
  }
  const { error: settleError } = await db.rpc('finance_settle_payment', { p_attempt: t.id, p_provider_id: providerId ?? null as unknown as string, p_amount: amount, p_currency: currency });
  if (settleError) throw new Error('Pagamento precisa de conciliação; saldo não foi debitado novamente.');
}
export async function releaseStoreCreditIfTerminal(orderId: string) {
  const { data: t } = await db.from('customer_payment_attempts').select('*').eq('order_id', orderId).in('status', ['reserved','pending']).maybeSingle();
  if (!t) return true;
  if (!t.provider_id) return false; // Unknown creation outcome must never free funds automatically.
  if (t.provider === 'mercadopago') {
    const { getPixPayment } = await import('./mercadopago.server');
    const remote = await getPixPayment(t.provider_id);
    if (!['cancelled','rejected'].includes(remote.status)) return false;
  } else if (t.provider === 'stripe') {
    const { createStripeClient } = await import('./stripe.server');
    const session = await createStripeClient(t.provider_environment === 'sandbox' ? 'sandbox' : 'live').checkout.sessions.retrieve(t.provider_id);
    if (session.status !== 'expired') return false;
  } else return false;
  const { error } = await db.rpc('finance_release_payment', { p_attempt: t.id, p_provider_id: t.provider_id });
  if (error) throw new Error('Não foi possível liberar a reserva.');
  return true;
}