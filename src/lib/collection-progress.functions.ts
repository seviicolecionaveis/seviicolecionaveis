import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const Schema = z.object({ collection: z.string().min(1).max(255) })

/**
 * Returns the set of card IDs (from `cards` table) the current user has
 * already purchased in this collection (orders with status paid/preparing/
 * shipped/delivered).
 */
export const getOwnedCardIdsInCollection = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    const { data: rows, error } = await (supabase as any)
      .from('order_items')
      .select('card_id, cards!inner(id, collection), orders!inner(user_id, status)')
      .eq('orders.user_id', userId)
      .in('orders.status', ['paid', 'preparing', 'shipped', 'delivered'])
      .eq('cards.collection', data.collection)
    if (error) {
      console.error('[collection-progress] failed', error)
      return { ownedCardIds: [] as string[] }
    }
    const ids = new Set<string>()
    for (const r of (rows ?? []) as Array<{ card_id: string | null }>) {
      if (r.card_id) ids.add(r.card_id)
    }
    return { ownedCardIds: Array.from(ids) }
  })
