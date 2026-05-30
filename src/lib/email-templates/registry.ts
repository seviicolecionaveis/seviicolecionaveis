import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

import { template as orderReceived } from './order-received'
import { template as paymentConfirmed } from './payment-confirmed'
import { template as orderStatusUpdated } from './order-status-updated'
import { template as adminCancellationRequested } from './admin-cancellation-requested'
import { template as backInStock } from './back-in-stock'
import { template as priceDrop } from './price-drop'
import { template as giftVoucher } from './gift-voucher'
import { template as couponBroadcast } from './coupon-broadcast'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'order-received': orderReceived,
  'payment-confirmed': paymentConfirmed,
  'order-status-updated': orderStatusUpdated,
  'admin-cancellation-requested': adminCancellationRequested,
  'back-in-stock': backInStock,
  'price-drop': priceDrop,
  'gift-voucher': giftVoucher,
  'coupon-broadcast': couponBroadcast,
}
