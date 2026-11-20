import { isPaidOrderStatus } from "./order-status";
import { isHandDeliveryArea, isAracajuCep, isHandDeliveryFeePaid, type AreaAddress } from "./hand-delivery";
import { addDaysYmd, HAND_DELIVERY_FEE_CENTS, localParts, MIN_LEAD_MS, toIso, validateSchedule } from "./scheduling";

/** Hub rules do not modify an order, a payment, or a stack deadline. */
export interface HubOrderEligibility {
  status: string;
  tracking_code?: string | null;
  tracking_url?: string | null;
  operational_status?: string | null;
  operational_tracking_code?: string | null;
}

export function isHubOrderEligible(order: HubOrderEligibility): boolean {
  return isPaidOrderStatus(order.status)
    && !["shipped", "delivered"].includes(order.status)
    && !["shipped", "delivered", "cancelled"].includes(order.operational_status ?? "")
    && !order.tracking_code?.trim()
    && !order.tracking_url?.trim()
    && !order.operational_tracking_code?.trim();
}

export type HubMode = "pickup" | "event" | "delivery" | "tracked" | "stack";

export function hubModes(address: AreaAddress | null, activeStack: boolean): HubMode[] {
  const modes: HubMode[] = ["pickup", "event"];
  if (isHandDeliveryArea(address)) modes.push("delivery");
  // No shipping quote without an address; malformed/unknown locality is not a permission.
  if (address?.city?.trim() && address.state?.trim() && /^\d{8}$/.test((address.cep ?? "").replace(/\D/g, ""))
    && !isAracajuCep(address.cep) && !isHandDeliveryArea({ ...address, cep: null })) modes.push("tracked");
  if (activeStack) modes.push("stack");
  return modes;
}

/** Customer alteration/cancellation requires MORE than 24 hours, not >=24. */
export function canChangeHubSchedule(at: string | null, now: Date): boolean {
  if (!at || !Number.isFinite(now.getTime())) return false;
  const timestamp = new Date(at).getTime();
  return Number.isFinite(timestamp) && timestamp - now.getTime() > MIN_LEAD_MS;
}

export function deliveryPaymentDeadline(at: string): string | null {
  const timestamp = new Date(at).getTime();
  if (!Number.isFinite(timestamp)) return null;
  // Validate weekday/time independently of whether the date has already passed.
  if (validateSchedule("delivery", at, new Date(timestamp - MIN_LEAD_MS)) !== null) return null;
  return new Date(timestamp - MIN_LEAD_MS).toISOString();
}

export interface PaidDeliveryRebooking {
  kind: "rebooked";
  at: string;
  feeCents: number;
  amountDueCents: number;
  feeStatus: "confirmed";
}

/** Availability is supplied by the authoritative calendar; no browser timezone or charge. */
export function rebookPaidDelivery(
  cancelledAt: string,
  feeStatus: string | null,
  now: Date,
  unavailableDays: ReadonlySet<string> = new Set(),
): PaidDeliveryRebooking | { kind: "blocked" } | { kind: "needs_admin" } {
  if (!isHandDeliveryFeePaid(feeStatus) || !canChangeHubSchedule(cancelledAt, now)
    || deliveryPaymentDeadline(cancelledAt) === null) return { kind: "blocked" };
  let day = addDaysYmd(localParts(cancelledAt).ymd, 1);
  for (let i = 0; i < 366; i++, day = addDaysYmd(day, 1)) {
    const at = toIso(day, "19:00");
    if (!unavailableDays.has(day) && validateSchedule("delivery", at, now) === null) {
      return { kind: "rebooked", at, feeCents: HAND_DELIVERY_FEE_CENTS, amountDueCents: 0, feeStatus: "confirmed" };
    }
  }
  return { kind: "needs_admin" };
}

export interface GroupPaymentExpectation {
  reference: string;
  providerId: string;
  amountCents: number;
  expiresAt: string;
  state: "pending" | "paid" | "expired" | "cancelled";
}

export interface VerifiedGroupPayment {
  id: string;
  reference: string;
  currency: string;
  amount: number;
  method: string;
  status: string;
  approvedAt: string | null;
}

/** Only an already server-fetched provider response may enter this classifier. */
export function assessGroupPix(
  expected: GroupPaymentExpectation,
  payment: VerifiedGroupPayment,
): "reject" | "pending" | "confirmed" | "duplicate" | "late" {
  if (!Number.isSafeInteger(expected.amountCents) || expected.amountCents <= 0
    || !expected.reference || !expected.providerId
    || payment.reference !== expected.reference || payment.id !== expected.providerId
    || payment.currency !== "BRL" || payment.method !== "pix"
    || payment.amount !== expected.amountCents / 100) return "reject";
  if (payment.status !== "approved") return "pending";
  const approvedAt = payment.approvedAt ? new Date(payment.approvedAt).getTime() : NaN;
  const expiresAt = new Date(expected.expiresAt).getTime();
  if (!Number.isFinite(approvedAt) || !Number.isFinite(expiresAt)) return "reject";
  if (expected.state === "paid") return "duplicate";
  if (expected.state !== "pending" || approvedAt >= expiresAt) return "late";
  return "confirmed";
}