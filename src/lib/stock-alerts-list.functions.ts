import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { supabaseAdmin } from '@/integrations/supabase/client.server'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export const listMyStockAlerts = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context
    const { data, error } = await (supabaseAdmin as any)
      .from('stock_alerts')
      .select('id, card_key, card_name, card_collection, card_number, created_at, notified_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[stock-alerts] list failed', error)
      return { alerts: [] as any[] }
    }
    return { alerts: (data ?? []) as any[] }
  })

const DeleteSchema = z.object({ id: z.string().uuid() })

export const deleteMyStockAlert = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context
    const { error } = await (supabaseAdmin as any)
      .from('stock_alerts')
      .delete()
      .eq('id', data.id)
      .eq('user_id', userId)
    if (error) return { success: false }
    return { success: true }
  })
