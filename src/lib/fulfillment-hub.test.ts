import { describe, expect, it } from "vitest";
import { assessGroupPix, canChangeHubSchedule, deliveryPaymentDeadline, hubModes, isHubOrderEligible, rebookPaidDelivery, type GroupPaymentExpectation, type VerifiedGroupPayment } from "./fulfillment-hub";

describe("Hub eligibility", () => {
  it.each(["pending", "cancelled", "shipped", "delivered", "refunded", "cancellation_requested"])("does not select %s orders", (status) => {
    expect(isHubOrderEligible({ status })).toBe(false);
  });
  it.each(["paid", "preparing", "separated", "awaiting_pickup", "cards_pending_delivery"])("includes paid-stage %s orders", (status) => {
    expect(isHubOrderEligible({ status })).toBe(true);
  });
  it("excludes recorded tracking, including the operational overlay", () => {
    expect(isHubOrderEligible({ status: "paid", tracking_code: "BR123" })).toBe(false);
    expect(isHubOrderEligible({ status: "paid", tracking_url: "https://tracking.example/123" })).toBe(false);
    expect(isHubOrderEligible({ status: "paid", operational_tracking_code: "BR456" })).toBe(false);
  });
  it.each(["delivered", "shipped", "cancelled"])("excludes operational %s without rewriting the paid auction", (operational_status) => {
    const order = { status: "paid", operational_status };
    expect(isHubOrderEligible(order)).toBe(false);
    expect(order.status).toBe("paid");
  });
});

describe("Hub modes", () => {
  it("Aracaju has delivery but never Correios", () => {
    expect(hubModes({ city: " Aracajú ", state: "SE", cep: "49000-000" }, false)).toEqual(["pickup", "event", "delivery"]);
  });
  it("outside Aracaju has tracked shipping but never hand delivery", () => {
    expect(hubModes({ city: "Salvador", state: "BA", cep: "40000-000" }, false)).toEqual(["pickup", "event", "tracked"]);
  });
  it("blocks Correios for Aracaju CEP even if city is inconsistent", () => {
    expect(hubModes({ city: "Salvador", state: "BA", cep: "49000-000" }, false)).not.toContain("tracked");
  });
  it("an inconsistent CEP cannot enable Correios for an Aracaju address", () => {
    expect(hubModes({ city: "Aracaju", state: "SE", cep: "40000-000" }, false)).not.toContain("tracked");
  });
  it("offers stack only with an active stack", () => {
    expect(hubModes(null, true)).toContain("stack");
    expect(hubModes(null, false)).not.toContain("stack");
  });
});

const scheduled = "2026-11-26T22:00:00.000Z"; // Thursday 19h Fortaleza

describe("Paid delivery cancellation and rebooking", () => {
  it("requires MORE than 24h for customer changes", () => {
    expect(canChangeHubSchedule(scheduled, new Date("2026-11-25T21:59:59Z"))).toBe(true);
    expect(canChangeHubSchedule(scheduled, new Date("2026-11-25T22:00:00Z"))).toBe(false);
    expect(canChangeHubSchedule(scheduled, new Date("2026-11-25T22:00:01Z"))).toBe(false);
  });
  it("delivery payment closes Wednesday 19h Fortaleza", () => {
    expect(deliveryPaymentDeadline(scheduled)).toBe("2026-11-25T22:00:00.000Z");
  });
  it("rejects invalid dates and non-Thursday delivery", () => {
    expect(deliveryPaymentDeadline("invalid")).toBeNull();
    expect(deliveryPaymentDeadline("2026-11-27T22:00:00Z")).toBeNull();
    expect(canChangeHubSchedule("invalid", new Date())).toBe(false);
  });
  it("reuses the R$15 and schedules the next Thursday automatically", () => {
    expect(rebookPaidDelivery(scheduled, "confirmed", new Date("2026-11-20T16:00:00Z"))).toEqual({
      kind: "rebooked", at: "2026-12-03T22:00:00.000Z", feeCents: 1500, amountDueCents: 0, feeStatus: "confirmed",
    });
  });
  it("the new appointment can still be altered with more than 24h", () => {
    const result = rebookPaidDelivery(scheduled, "paid", new Date("2026-11-20T16:00:00Z"));
    expect(result.kind).toBe("rebooked");
    if (result.kind !== "rebooked") throw new Error("Expected rebooking");
    expect(canChangeHubSchedule(result.at, new Date("2026-12-02T21:59:00Z"))).toBe(true);
  });
  it("skips unavailable Thursdays without charging again", () => {
    const result = rebookPaidDelivery(scheduled, "confirmed", new Date("2026-11-20T16:00:00Z"), new Set(["2026-12-03"]));
    expect(result).toMatchObject({ at: "2026-12-10T22:00:00.000Z", amountDueCents: 0 });
  });
  it("does not grant free delivery to an unpaid customer", () => {
    expect(rebookPaidDelivery(scheduled, "pending", new Date("2026-11-20T16:00:00Z"))).toEqual({ kind: "blocked" });
  });
  it("within 24h cannot rebook itself", () => {
    expect(rebookPaidDelivery(scheduled, "confirmed", new Date("2026-11-25T22:00:00Z"))).toEqual({ kind: "blocked" });
  });
  it("if no date is available, leaves payment for administrative resolution", () => {
    const dates = new Set<string>();
    for (let i = 1; i <= 366; i++) {
      dates.add(new Date(Date.UTC(2026, 10, 26 + i)).toISOString().slice(0, 10));
    }
    expect(rebookPaidDelivery(scheduled, "confirmed", new Date("2026-11-20T16:00:00Z"), dates)).toEqual({ kind: "needs_admin" });
  });
});

const expected: GroupPaymentExpectation = { reference: "group-attempt-1", providerId: "123456", amountCents: 1500, expiresAt: "2026-11-25T22:00:00Z", state: "pending" };
const approved: VerifiedGroupPayment = { id: "123456", reference: "group-attempt-1", currency: "BRL", amount: 15, method: "pix", status: "approved", approvedAt: "2026-11-25T21:59:00Z" };

describe("Group Pix verification", () => {
  it("confirms only the exact R$15 group payment", () => expect(assessGroupPix(expected, approved)).toBe("confirmed"));
  it.each([{ amount: 14.99 }, { amount: 15.001 }, { currency: "USD" }, { method: "credit_card" }, { reference: "other-group" }, { id: "999" }])("rejects mismatched provider data %j", (patch) => {
    expect(assessGroupPix(expected, { ...approved, ...patch })).toBe("reject");
  });
  it("does not confirm pending provider payments", () => {
    expect(assessGroupPix(expected, { ...approved, status: "pending", approvedAt: null })).toBe("pending");
  });
  it("repeated approval is a no-op", () => expect(assessGroupPix({ ...expected, state: "paid" }, approved)).toBe("duplicate"));
  it("late approval never reactivates an expired appointment", () => {
    expect(assessGroupPix({ ...expected, state: "expired" }, approved)).toBe("late");
    expect(assessGroupPix(expected, { ...approved, approvedAt: expected.expiresAt })).toBe("late");
  });
  it("rejects approval without a trustworthy timestamp", () => {
    expect(assessGroupPix(expected, { ...approved, approvedAt: null })).toBe("reject");
  });
});