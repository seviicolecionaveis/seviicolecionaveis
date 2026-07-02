import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { sendTransactionalEmailSafe } from '@/lib/email/send.server'
import { cardSlug } from '@/lib/slug'
import { verifyCronAuth } from '@/lib/cron-auth.server'

const SITE_URL = 'https://seviicolecionaveis.com.br'

interface CardRow {
  id: string
  name: string
  collection: string
  card_number: string
  image: string | null
  base_price_cents: number | null
}

interface PriceRow {
  card_name: string
  collection: string
  card_number: string
  price_cents: number | null
}

function priceKey(name: string, collection: string, number: string) {
  return `${name}__${collection}__${number}`.toLowerCase()
}

export const Route = createFileRoute('/api/public/hooks/price-drop-check')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = verifyCronAuth(request)
        if (unauthorized) return unauthorized
        const admin = supabaseAdmin as any

        // 1. Distinct wishlisted card ids
        const { data: wishRows, error: wishErr } = await admin
          .from('wishlist')
          .select('card_key')
          .limit(5000)
        if (wishErr) {
          console.error('[price-drop] wishlist fetch failed', wishErr)
          return new Response(JSON.stringify({ ok: false, error: 'wishlist_fetch_failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        const cardIds = Array.from(
          new Set((wishRows ?? []).map((r: any) => r.card_key).filter((k: string) => UUID_RE.test(k))),
        )
        if (cardIds.length === 0) {
          return new Response(JSON.stringify({ ok: true, checked: 0, sent: 0 }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // 2. Card details
        const { data: cards, error: cardsErr } = await admin
          .from('cards')
          .select('id, name, collection, card_number, image, base_price_cents')
          .in('id', cardIds)
        if (cardsErr) {
          console.error('[price-drop] cards fetch failed', cardsErr)
          return new Response(JSON.stringify({ ok: false, error: 'cards_fetch_failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // 3. All matching card_prices (filter by collections set)
        const collections = Array.from(new Set((cards as CardRow[]).map((c) => c.collection)))
        const { data: priceRows } = await admin
          .from('card_prices')
          .select('card_name, collection, card_number, price_cents')
          .in('collection', collections)

        const priceMap = new Map<string, number>()
        for (const r of (priceRows ?? []) as PriceRow[]) {
          if (r.price_cents == null) continue
          const k = priceKey(r.card_name, r.collection, r.card_number)
          const prev = priceMap.get(k)
          if (prev == null || r.price_cents < prev) priceMap.set(k, r.price_cents)
        }

        // 4. Last watched prices
        const { data: watchRows } = await admin
          .from('card_price_watch')
          .select('card_id, last_min_price_cents')
          .in('card_id', cardIds)
        const watchMap = new Map<string, number>(
          (watchRows ?? []).map((r: any) => [r.card_id as string, r.last_min_price_cents as number]),
        )

        // 5. For each card compute current min
        const drops: Array<{
          card: CardRow
          oldCents: number
          newCents: number
        }> = []
        const upserts: Array<{
          card_id: string
          last_min_price_cents: number
          updated_at: string
          previous_min_price_cents?: number | null
          price_dropped_at?: string | null
        }> = []
        const now = new Date().toISOString()

        for (const card of cards as CardRow[]) {
          const fromPrices = priceMap.get(priceKey(card.name, card.collection, card.card_number))
          const candidates: number[] = []
          if (card.base_price_cents != null) candidates.push(card.base_price_cents)
          if (fromPrices != null) candidates.push(fromPrices)
          if (candidates.length === 0) continue
          const currentMin = Math.min(...candidates)
          const previous = watchMap.get(card.id)
          const row: any = { card_id: card.id, last_min_price_cents: currentMin, updated_at: now }
          if (previous != null && currentMin < previous) {
            row.previous_min_price_cents = previous
            row.price_dropped_at = now
            drops.push({ card, oldCents: previous, newCents: currentMin })
          }
          upserts.push(row)
        }

        // 6. Persist current snapshot
        if (upserts.length > 0) {
          const { error: upErr } = await admin
            .from('card_price_watch')
            .upsert(upserts, { onConflict: 'card_id' })
          if (upErr) console.error('[price-drop] watch upsert failed', upErr)
        }

        if (drops.length === 0) {
          return new Response(
            JSON.stringify({ ok: true, checked: cards?.length ?? 0, sent: 0 }),
            { headers: { 'Content-Type': 'application/json' } },
          )
        }

        // 7. For each drop find wishlist users and their emails
        let totalSent = 0
        for (const drop of drops) {
          const { data: userRows } = await admin
            .from('wishlist')
            .select('user_id')
            .eq('card_key', drop.card.id)
            .limit(1000)
          const userIds = Array.from(new Set((userRows ?? []).map((r: any) => r.user_id as string)))
          if (userIds.length === 0) continue

          const oldPrice = drop.oldCents / 100
          const newPrice = drop.newCents / 100
          const dropPercent = Math.round(((drop.oldCents - drop.newCents) / drop.oldCents) * 100)
          const slug = cardSlug(drop.card.name, drop.card.collection, drop.card.card_number)
          const cardUrl = `${SITE_URL}/carta/${slug}`

          for (const userId of userIds) {
            // Fetch email from auth.users via admin API
            const { data: userResp, error: userErr } =
              await (supabaseAdmin as any).auth.admin.getUserById(userId)
            if (userErr || !userResp?.user?.email) continue
            const email = userResp.user.email as string

            const idemKey = `price-drop-${drop.card.id}-${userId}-${drop.newCents}`
            const res = await sendTransactionalEmailSafe({
              templateName: 'price-drop',
              recipientEmail: email,
              idempotencyKey: idemKey,
              templateData: {
                cardName: drop.card.name,
                collection: drop.card.collection,
                cardNumber: drop.card.card_number,
                cardImage: drop.card.image,
                cardUrl,
                oldPrice,
                newPrice,
                dropPercent,
              },
            })
            if (res.success) totalSent++
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            checked: cards?.length ?? 0,
            drops: drops.length,
            sent: totalSent,
          }),
          { headers: { 'Content-Type': 'application/json' } },
        )
      },
    },
  },
})
