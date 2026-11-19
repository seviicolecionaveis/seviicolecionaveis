import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ process: vi.fn(), settle: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/customer-finance.server", () => ({ settleStoreCredit: mocks.settle, releaseStoreCreditIfTerminal: vi.fn() }));
vi.mock("@/lib/checkout-fulfillment.server", () => ({ processPaidCheckoutFulfillment: mocks.process }));
vi.mock("@/lib/email/send.server", () => ({ sendTransactionalEmailSafe: vi.fn() }));
vi.mock("@/lib/schedule-confirmation.server", () => ({ sendScheduleConfirmations: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
import { markOrderPaid } from "./orders.server";

describe("already paid fulfillment recovery", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(["paid", "preparing", "separated", "awaiting_pickup", "cards_pending_delivery"])("%s retries fulfillment without repeating stock or credit", async (status) => {
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "new", status } }) }) }) });
    await markOrderPaid("new");
    expect(mocks.process).toHaveBeenCalledWith("new", true);
    expect(mocks.settle).not.toHaveBeenCalled();
    expect(mocks.from.mock.calls).toEqual([["orders"]]);
  });
});