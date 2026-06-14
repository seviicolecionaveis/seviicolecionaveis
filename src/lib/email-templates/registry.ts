import type { ComponentType } from 'react'
import { template as loyaltyProgramLaunchTemplate } from './loyalty-program-launch'
import { template as giftVoucherTemplate } from './gift-voucher'
import { template as couponBroadcastTemplate } from './coupon-broadcast'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'loyalty-program-launch': loyaltyProgramLaunchTemplate,
  'gift-voucher': giftVoucherTemplate,
  'coupon-broadcast': couponBroadcastTemplate,
}
