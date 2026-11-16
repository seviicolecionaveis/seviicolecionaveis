import { describe, expect, it } from "vitest";
import { canGroupOrder, effectiveFulfillment, groupFee, groupPrimary } from "./fulfillment-groups";

describe("fulfillment groups", () => {
  it("never includes delivered orders", () => expect(canGroupOrder({ status: "delivered" })).toBe(false));
  it("never includes cancelled orders", () => expect(canGroupOrder({ status: "cancelled" })).toBe(false));
  it("never includes shipped orders", () => expect(canGroupOrder({ status: "shipped" })).toBe(false));
  it("includes paid auction orders but not unpaid auctions", () => {
    expect(canGroupOrder({ status: "paid", origin: "auction" })).toBe(true);
    expect(canGroupOrder({ status: "pending", origin: "auction" })).toBe(false);
  });
  it("charges the R$15 fee once", () => expect([true, false, false].map(p => groupFee("delivery", 0, p))).toEqual([1500, 0, 0]));
  it("charges tracked shipping once", () => expect([true, false].map(p => groupFee("tracked", 2380, p))).toEqual([2380, 0]));
  it("transfers primary to the oldest remaining eligible order", () => {
    const orders = [{ id: "a", created_at: "2026-10-01", status: "delivered" }, { id: "b", created_at: "2026-10-02", status: "paid" }, { id: "c", created_at: "2026-10-03", status: "paid" }];
    expect(groupPrimary(orders)?.id).toBe("b");
  });
  it("operational choice does not rewrite auction or payment data", () => {
    const original = { shipping_method: "card_stack", total_cents: 3456, origin: "auction", fulfillment_data: { shipping_method: "arrange", schedule_kind: "event" } };
    expect(effectiveFulfillment(original).schedule_kind).toBe("event");
    expect(effectiveFulfillment(original).total_cents).toBe(3456);
    expect(original.shipping_method).toBe("card_stack");
  });
});