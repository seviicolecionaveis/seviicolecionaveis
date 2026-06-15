import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

async function assertAdmin(userId: string) {
  const { data } = await (supabaseAdmin as any)
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle()
  if (!data) throw new Response('Forbidden', { status: 403 })
}

export const listFlashOffers = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId)
    const { data, error } = await (supabaseAdmin as any)
      .from('flash_offers')
      .select(`
        id, card_id, discount_percent, starts_at, ends_at, max_uses, uses_count, active, created_at,
        card:cards(id, name, collection, card_number, base_price_cents)
      `)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      console.error('[flash-offers] list failed', error)
      return { offers: [] as any[] }
    }
    return { offers: (data ?? []) as any[] }
  })

const CreateSchema = z.object({
  cardId: z.string().uuid(),
  discountPercent: z.number().int().min(1).max(90),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  maxUses: z.number().int().min(1).max(10000).nullable().optional(),
})

export const createFlashOffer = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId)
    const { error } = await (supabaseAdmin as any).from('flash_offers').insert({
      card_id: data.cardId,
      discount_percent: data.discountPercent,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      max_uses: data.maxUses ?? null,
      created_by: context.userId,
      active: true,
    })
    if (error) {
      console.error('[flash-offers] create failed', error)
      return { success: false, error: error.message }
    }
    return { success: true }
  })

const ToggleSchema = z.object({ id: z.string().uuid(), active: z.boolean() })

export const setFlashOfferActive = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ToggleSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId)
    const { error } = await (supabaseAdmin as any)
      .from('flash_offers')
      .update({ active: data.active })
      .eq('id', data.id)
    if (error) return { success: false }
    return { success: true }
  })

const DelSchema = z.object({ id: z.string().uuid() })

export const deleteFlashOffer = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DelSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId)
    const { error } = await (supabaseAdmin as any)
      .from('flash_offers')
      .delete()
      .eq('id', data.id)
    if (error) return { success: false }
    return { success: true }
  })
