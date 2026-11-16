import { isPaidOrderStatus } from "./order-status";
import { HAND_DELIVERY_FEE_CENTS } from "./scheduling";

export interface GroupOrder {
  id: string;
  created_at: string;
  status: string;
  origin?: string | null;
  fulfillment_group_id?: string | null;
  fulfillment_service_order_id?: string | null;
  fulfillment_group_code?: number | null;
  fulfillment_data?: Record<string, unknown> | null;
  is_group_primary?: boolean | null;
}

export function canGroupOrder(o: Pick<GroupOrder, "status" | "origin">): boolean {
  if (["delivered", "cancelled", "shipped", "refunded", "cancellation_requested"].includes(o.status)) return false;
  return o.origin !== "auction" || isPaidOrderStatus(o.status);
}

/** The overlay is operational only: original tender, totals and auction fields stay intact. */
export function effectiveFulfillment<T extends { fulfillment_data?: unknown }>(o: T): T & Record<string, any> {
  const d = o.fulfillment_data;
  return d && typeof d === "object" && !Array.isArray(d) ? { ...o, ...d } : { ...o };
}

export function groupPrimary(orders: GroupOrder[]): GroupOrder | undefined {
  return orders.filter(canGroupOrder).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))[0];
}

export function groupFee(mode: string, shippingCents: number, primary: boolean): number {
  return primary ? mode === "delivery" ? HAND_DELIVERY_FEE_CENTS : mode === "tracked" ? shippingCents : 0 : 0;
}

export function groupLabel(o: GroupOrder, serviceCode?: number | null): string {
  return o.fulfillment_service_order_id && serviceCode ? `OS #${serviceCode}` : `Grupo #${o.fulfillment_group_code ?? "—"}`;
}