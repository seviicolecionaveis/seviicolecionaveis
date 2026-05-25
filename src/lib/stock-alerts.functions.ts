import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { sendTransactionalEmailSafe } from '@/lib/email/send.server'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const SubscribeSchema = z.object({
  cardKey: z.string().min(1).max(255),
  cardName: z.string().min(1).max(255),
  cardCollection: z.string().min(1).max(255),
  cardNumber: z.string().min(1).max(64),
})

export const subscribeStockAlert = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SubscribeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context
    const userEmail = (claims as any)?.email as string | undefined
    if (!userEmail) {
      return { success: false, reason: 'no_email' as const }
    }
    const normalizedEmail = userEmail.toLowerCase()

    const { data: suppressed } = await (supabaseAdmin as any)
      .from('suppressed_emails')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()
    if (suppressed) {
      return { success: false, reason: 'email_suppressed' as const }
    }

    const { error } = await (supabaseAdmin as any)
      .from('stock_alerts')
      .upsert(
        {
          card_key: data.cardKey,
          card_name: data.cardName,
          card_collection: data.cardCollection,
          card_number: data.cardNumber,
          email: normalizedEmail,
          user_id: userId,
          notified_at: null,
        },
        { onConflict: 'card_key,email' },
      )

    if (error) {
      console.error('[stock-alert] subscribe failed', error)
      return { success: false, reason: 'insert_failed' as const }
    }
    return { success: true as const }
  })

const NotifySchema = z.object({
  cardKey: z.string().min(1).max(255),
  cardName: z.string().min(1).max(255),
  cardCollection: z.string().min(1).max(255),
  cardNumber: z.string().min(1).max(64),
  cardImage: z.string().max(2048).nullable().optional(),
  cardSlug: z.string().min(1).max(255),
})

const SITE_URL = 'https://seviicolecionaveis.com.br'

export const notifyStockBack = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => NotifySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context
    const { data: roleRow } = await (supabaseAdmin as any)
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle()
    if (!roleRow) {
      throw new Response('Forbidden', { status: 403 })
    }
    const admin = supabaseAdmin as any
    const { data: alerts, error } = await admin
      .from('stock_alerts')
      .select('id, email')
      .eq('card_key', data.cardKey)
      .is('notified_at', null)
      .limit(500)

    if (error) {
      console.error('[stock-alert] fetch failed', error)
      return { success: false, sent: 0 }
    }
    if (!alerts || alerts.length === 0) return { success: true, sent: 0 }

    const cardUrl = `${SITE_URL}/carta/${data.cardSlug}`
    let sent = 0
    for (const a of alerts) {
      const res = await sendTransactionalEmailSafe({
        templateName: 'back-in-stock',
        recipientEmail: a.email,
        idempotencyKey: `back-in-stock-${a.id}`,
        templateData: {
          cardName: data.cardName,
          collection: data.cardCollection,
          cardNumber: data.cardNumber,
          cardImage: data.cardImage ?? null,
          cardUrl,
        },
      })
      if (res.success) sent++
    }

    const ids = alerts.map((a: any) => a.id)
    await admin
      .from('stock_alerts')
      .update({ notified_at: new Date().toISOString() })
      .in('id', ids)

    return { success: true, sent }
  })
