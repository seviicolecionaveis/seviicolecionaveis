import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), notifyGroup: vi.fn(), notify: vi.fn(), update: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  rpc: mocks.rpc,
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "new", email: "test@example.com", schedule_kind: "pickup" } }) }) }),
    update: mocks.update,
  }),
} }));
vi.mock("./fulfillment-groups.server", () => ({ notifyGroup: mocks.notifyGroup }));
vi.mock("./fulfillment-alerts.server", () => ({ notifyFulfillmentChange: mocks.notify }));
import { saveCheckoutFulfillment, processPaidCheckoutFulfillment } from "./checkout-fulfillment.server";

describe("checkout grouping payment boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    mocks.update.mockReturnValue({ eq: async () => ({ error: null }) });
  });
  it.each(["pickup", "event", "delivery"])("%s creation only stores intent, never applies a group", async (kind) => {
    await saveCheckoutFulfillment("new", "owner", { shippingMethod: "arrange", schedule: { kind, at: "2030-01-03T22:00:00Z", orderIds: ["earlier", "earlier"] }, address: {} });
    expect(mocks.rpc.mock.calls).toEqual([["save_checkout_fulfillment_intent", expect.objectContaining({ p_order: "new", p_user: "owner", p_ids: ["earlier"] })]]);
    expect(mocks.notifyGroup).not.toHaveBeenCalled();
  });
  it("no selected orders means no intent or mutation", async () => {
    await saveCheckoutFulfillment("new", "owner", { shippingMethod: "arrange", schedule: { kind: "pickup", at: "2030-01-03T22:00:00Z", orderIds: [] }, address: {} });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("unpaid intent cannot notify or mark completion", async () => {
    mocks.rpc.mockResolvedValue({ data: { state: "unpaid" } });
    await processPaidCheckoutFulfillment("new");
    expect(mocks.notifyGroup).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("paid application notifies with a stable key and prior appointments", async () => {
    mocks.rpc.mockResolvedValue({ data: { state: "applied", group_id: "group", previous_schedules: "old time" } });
    await processPaidCheckoutFulfillment("new");
    expect(mocks.notifyGroup).toHaveBeenCalledWith("group", "checkout:new", "customer", true, "old time");
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });
  it("completed retry does not notify again", async () => {
    mocks.rpc.mockResolvedValue({ data: { state: "applied", group_id: "group", notified_at: "2030-01-01" } });
    await processPaidCheckoutFulfillment("new");
    expect(mocks.notifyGroup).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("unavailable selection sends review alert, not a schedule confirmation", async () => {
    mocks.rpc.mockResolvedValue({ data: { state: "needs_review", failure_reason: "Preserved" } });
    await processPaidCheckoutFulfillment("new");
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ action: "needs_review", reviewMessage: "Preserved", dedupeExtra: "checkout-review:new" }));
    expect(mocks.notifyGroup).not.toHaveBeenCalled();
  });
  it("transient failure does not mark completed and can retry", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { message: "transient" } });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await processPaidCheckoutFulfillment("new")).toBe(true);
    expect(mocks.update).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValueOnce({ data: { state: "applied", group_id: "group" } });
    await processPaidCheckoutFulfillment("new");
    expect(mocks.notifyGroup).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
});