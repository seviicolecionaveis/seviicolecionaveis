import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export type WinnerChangePreview = {
  itemId: string; itemName: string; sourceOrderId: string; sourceName: string;
  previousBidId: string; candidateBidId: string; candidateName: string;
  amountCents: number; quantity: number; matchedUserId: string | null;
  matchedName: string | null; needsIdentification: boolean;
};

export const previewAuctionWinnerChange = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ itemId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc('admin_preview_auction_winner_change', { p_item_id: data.itemId });
    if (error) throw new Error(error.message);
    return result as unknown as WinnerChangePreview;
  });

export const changeAuctionWinner = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    itemId: z.string().uuid(), sourceOrderId: z.string().uuid(), candidateBidId: z.string().uuid(),
    targetUserId: z.string().uuid(), amountCents: z.number().int().positive(),
    reason: z.string().trim().min(3).max(500), operationId: z.string().uuid(),
    confirmed: z.literal(true),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc('admin_change_auction_winner', {
      p_item_id: data.itemId, p_source_order_id: data.sourceOrderId,
      p_candidate_bid_id: data.candidateBidId, p_target_user_id: data.targetUserId,
      p_amount_cents: data.amountCents, p_reason: data.reason, p_operation_id: data.operationId,
    });
    if (error) throw new Error(error.message);
    return result as unknown as { targetOrderId: string; sourceOrderId: string; alreadyApplied: boolean };
  });