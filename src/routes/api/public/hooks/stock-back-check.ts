import { createFileRoute } from '@tanstack/react-router'

const SITE_URL = 'https://seviicolecionaveis.com.br'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * Verifica cartas que voltaram ao estoque (stock > 0) e enfileira email
 * para todos os alertas pendentes daquela carta. Cron job chama de minuto em minuto.
 */
export const Route = createFileRoute('/api/public/hooks/stock-back-check')({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { sendTransactionalEmailSafe } = await import('@/lib/email/send.server')

        const admin = supabaseAdmin as any

        // Buscar alertas pendentes
        const { data: alerts, error: alertsErr } = await admin
          .from('stock_alerts')
          .select('id, card_key, card_name, card_collection, card_number, email')
          .is('notified_at', null)
          .limit(500)

        if (alertsErr) {
          console.error('[stock-back-check] alerts fetch failed', alertsErr)
          return new Response(JSON.stringify({ error: 'alerts_fetch_failed' }), { status: 500 })
        }
        if (!alerts || alerts.length === 0) {
          return Response.json({ ok: true, checked: 0, sent: 0 })
        }

        // Para cada alerta único por card_key, verificar se carta tem estoque
        const byKey = new Map<string, typeof alerts>()
        for (const a of alerts) {
          const arr = byKey.get(a.card_key) ?? []
          arr.push(a)
          byKey.set(a.card_key, arr)
        }

        let sentCount = 0
        const notifiedIds: string[] = []

        for (const [, group] of byKey) {
          const first = group[0]
          // card_key format pattern: name__collection__number ou similar.
          // Fazer query por (name, collection, card_number) para checar estoque total
          const { data: cards } = await admin
            .from('cards')
            .select('id, name, collection, card_number, image, stock')
            .eq('name', first.card_name)
            .eq('collection', first.card_collection)
            .eq('card_number', first.card_number)

          if (!cards || cards.length === 0) continue
          const totalStock = cards.reduce((s: number, c: any) => s + (c.stock ?? 0), 0)
          if (totalStock <= 0) continue

          const cardImage = cards.find((c: any) => c.image)?.image ?? null
          const slug = slugify(
            `${first.card_name}-${first.card_collection}-${first.card_number}`,
          )
          const cardUrl = `${SITE_URL}/carta/${slug}`

          for (const a of group) {
            const res = await sendTransactionalEmailSafe({
              templateName: 'back-in-stock',
              recipientEmail: a.email,
              idempotencyKey: `back-in-stock-${a.id}`,
              templateData: {
                cardName: a.card_name,
                collection: a.card_collection,
                cardNumber: a.card_number,
                cardImage,
                cardUrl,
              },
            })
            if (res.success) {
              sentCount++
              notifiedIds.push(a.id)
            }
          }
        }

        if (notifiedIds.length > 0) {
          await admin
            .from('stock_alerts')
            .update({ notified_at: new Date().toISOString() })
            .in('id', notifiedIds)
        }

        return Response.json({ ok: true, checked: alerts.length, sent: sentCount })
      },
    },
  },
})
