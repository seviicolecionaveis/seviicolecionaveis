import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
const pageSchema = z.object({ page: z.number().int().min(0).max(100000).default(0), userId: z.string().uuid().optional() });
export const getCreditStatement = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(d => pageSchema.parse(d)).handler(async ({ context, data }) => {
  const { assertFinanceAdmin } = await import('./customer-finance.server');
  if (data.userId && data.userId !== context.userId) await assertFinanceAdmin(context.userId);
  const id = data.userId ?? context.userId;
  const [account, entries] = await Promise.all([
    context.supabase.from('customer_credit_accounts').select('*').eq('user_id',id).maybeSingle(),
    context.supabase.from('customer_credit_entries').select('*', { count: 'exact' }).eq('user_id',id).order('created_at',{ ascending:false }).range(data.page*25,data.page*25+24),
  ]);
  if (account.error || entries.error) throw new Error('Não foi possível carregar o saldo.');
  return { balanceCents: account.data?.balance_cents ?? 0, reservedCents: account.data?.reserved_cents ?? 0, entries: entries.data ?? [], total: entries.count ?? 0 };
});
export const listFinanceRefunds = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(d => z.object({ page:z.number().int().min(0).default(0), query:z.string().max(150).default(''), status:z.string().max(30).default(''), choice:z.enum(['','credit','original']).default(''), from:z.string().max(30).default(''), to:z.string().max(30).default('') }).parse(d)).handler(async ({ context, data }) => {
  const { assertFinanceAdmin } = await import('./customer-finance.server'); await assertFinanceAdmin(context.userId);
  let q = context.supabase.from('customer_refunds').select('id,user_id,order_id,item_id,amount_cents,reason,choice,status,token_expires_at,created_at,provider_cents,credit_cents,provider_refund_id,email_status,orders!inner(email,recipient_name,total_cents,refunded_cents)', { count:'exact' }).order('created_at',{ascending:false});
  if (data.status && data.status !== 'expired') q=q.eq('status',data.status);
  if (data.status === 'expired') q=q.eq('status','awaiting_choice').lt('token_expires_at',new Date().toISOString());
  if (data.choice) q=q.eq('choice',data.choice);
  if (data.from) q=q.gte('created_at',data.from);
  if (data.to) q=q.lte('created_at',`${data.to}T23:59:59.999Z`);
  const term=data.query.trim();
  if (/^[a-f0-9-]{36}$/i.test(term)) q=q.or(`id.eq.${term},order_id.eq.${term},user_id.eq.${term}`);
  else if (term) {
    const safe=term.replace(/[^\p{L}\p{N}@. +_-]/gu,'');
    q=q.or(`email.ilike.%${safe}%,recipient_name.ilike.%${safe}%`,{ referencedTable:'orders' });
  }
  const { data: rows, error, count } = await q.range(data.page*25,data.page*25+24);
  if(error) throw new Error('Não foi possível carregar reembolsos.'); return { rows:rows??[], total:count??0 };
});
export const createRefund = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({orderId:z.string().uuid(),itemId:z.string().uuid().optional(),amountCents:z.number().int().positive().max(100000000),reason:z.string().trim().min(5).max(1000),key:z.string().uuid(),confirmed:z.literal(true)}).parse(d)).handler(async({context,data})=>{
  const {createFinanceRefund}=await import('./customer-finance.server'); return createFinanceRefund(context.userId,data);
});
export const adjustCredit = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({userId:z.string().uuid(),amountCents:z.number().int().min(-100000000).max(100000000).refine(n=>n!==0),reason:z.string().trim().min(5).max(1000),key:z.string().uuid(),confirmed:z.literal(true)}).parse(d)).handler(async({context,data})=>{
  const {assertFinanceAdmin}=await import('./customer-finance.server'); await assertFinanceAdmin(context.userId);
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server'); const {error}=await supabaseAdmin.rpc('finance_adjust_credit',{p_user:data.userId,p_actor:context.userId,p_amount:data.amountCents,p_reason:data.reason,p_key:data.key});
  if(error) throw new Error('Ajuste recusado: cliente inexistente, saldo reservado ou conflito de operação.'); return {ok:true};
});
const linkInput=z.object({id:z.string().uuid(),token:z.string().regex(/^[a-f0-9]{64}$/)});
export const getRefundChoice = createServerFn({method:'POST'}).inputValidator(d=>linkInput.parse(d)).handler(async({data})=>{
  const {readRefundLink}=await import('./customer-finance.server'); return readRefundLink(data.id,data.token);
});
export const confirmRefundChoice = createServerFn({method:'POST'}).inputValidator(d=>linkInput.extend({choice:z.enum(['credit','original']),confirmed:z.literal(true)}).parse(d)).handler(async({data})=>{
  const {chooseFinanceRefund}=await import('./customer-finance.server'); return chooseFinanceRefund(data.id,data.token,data.choice);
});
export const refundAdminAction=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({id:z.string().uuid(),action:z.enum(['renew','revoke','approve','decline','process','manual_complete','resend_notice']),reason:z.string().trim().min(5).max(1000),reference:z.string().trim().min(3).max(100).optional(),confirmed:z.literal(true)}).parse(d)).handler(async({context,data})=>{
  const service=await import('./customer-finance.server'); await service.assertFinanceAdmin(context.userId);
  if(data.action==='renew') return service.renewFinanceRefund(context.userId,data.id,data.reason);
  if(data.action==='process') return service.processFinanceRefund(context.userId,data.id,data.reason);
  if(data.action==='resend_notice') {
    const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
    const {data:r}=await supabaseAdmin.from('customer_refunds').select('*').eq('id',data.id).single();
    if(!r || r.status==='awaiting_choice') throw new Error('Reenvie o convite renovando o link.');
    return {sent:await service.sendFinanceNotice(r,r.status)};
  }
  if(data.action==='manual_complete') {
    if(!data.reference) throw new Error('Informe comprovante ou referência da devolução efetiva.');
    const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
    const {data:r}=await supabaseAdmin.from('customer_refunds').select('*').eq('id',data.id).single();
    if(!r || r.provider_id || !['processing','review','failed'].includes(r.status)) throw new Error('Estorno Mercado Pago deve ser conciliado pela integração.');
    const done=await service.financeAction(data.id,context.userId,'complete',data.reason,{amount:r.provider_cents,reference:data.reference});
    await service.sendFinanceNotice(done,'refunded'); return done;
  }
  const r=await service.financeAction(data.id,context.userId,data.action,data.reason);
  await service.sendFinanceNotice(r,r.status); return r;
});
export const getRefundOrderContext=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({orderId:z.string().uuid()}).parse(d)).handler(async({context,data})=>{
  const {assertFinanceAdmin}=await import('./customer-finance.server'); await assertFinanceAdmin(context.userId);
  const {data:order,error}=await context.supabase.from('orders').select('id,user_id,email,recipient_name,total_cents,refunded_cents,order_items(id,card_name,quantity,unit_price_cents,refund_cents)').eq('id',data.orderId).single();
  if(error) throw new Error('Pedido não encontrado.');
  const {data:refunds}=await context.supabase.from('customer_refunds').select('amount_cents,status').eq('order_id',data.orderId);
  const committed=(refunds??[]).filter(r=>!['declined','revoked','refunded','credited'].includes(r.status)).reduce((s,r)=>s+r.amount_cents,0);
  return {...order,committedCents:committed,remainingCents:Math.max(0,order.total_cents-(order.refunded_cents??0)-committed)};
});
export const getFinanceAudit=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({id:z.string().uuid()}).parse(d)).handler(async({context,data})=>{
  const {assertFinanceAdmin}=await import('./customer-finance.server'); await assertFinanceAdmin(context.userId);
  const {data:rows,error}=await context.supabase.from('customer_finance_audit').select('*').eq('refund_id',data.id).order('created_at',{ascending:false});
  if(error) throw new Error('Não foi possível carregar histórico.');return rows??[];
});