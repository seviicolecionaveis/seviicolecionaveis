import { describe, expect, it } from "vitest";
import {
  AUCTION_CARD_PAYMENT_ENABLED,
  auctionOrder,
  cardPaymentAllowedForOrder,
} from "./auction-payment-methods";

describe("cardPaymentAllowedForOrder", () => {
  it("bloqueia cartão em pedido de leilão por origin", () => {
    expect(cardPaymentAllowedForOrder("auction", null)).toBe(false);
  });

  it("bloqueia cartão em pedido de leilão por auction_id", () => {
    expect(cardPaymentAllowedForOrder("site", "c2898c0a-4a72-4b06-9a2b-4b1c1d4a0001")).toBe(false);
  });

  it("permite cartão em pedido normal do site", () => {
    expect(cardPaymentAllowedForOrder("site", null)).toBe(true);
    expect(cardPaymentAllowedForOrder(null, null)).toBe(true);
  });

  it("detecta leilão por origin ou auction_id", () => {
    expect(auctionOrder("auction", null)).toBe(true);
    expect(auctionOrder("manual", "c2898c0a-4a72-4b06-9a2b-4b1c1d4a0002")).toBe(true);
    expect(auctionOrder("manual", null)).toBe(false);
  });

  it("cartão de leilão começa desabilitado", () => {
    expect(AUCTION_CARD_PAYMENT_ENABLED).toBe(false);
  });
});
