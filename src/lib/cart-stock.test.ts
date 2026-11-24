import { describe, expect, it } from "vitest";
import { findCartShortages, sellableStock } from "./cart-stock";

describe("cart stock check", () => {
  it("flags an item sold out after it was added to the cart", () => {
    const r = findCartShortages([{ id: "a", cardId: "c1", quantity: 2 }], [{ id: "c1", stock: 0 }]);
    expect(r).toEqual([{ item: { id: "a", cardId: "c1", quantity: 2 }, available: 0 }]);
  });
  it("discounts units reserved for an in-person event", () => {
    expect(sellableStock({ id: "c1", stock: 2, event_reserved: 2 })).toBe(0);
  });
  it("reports partial availability", () => {
    const r = findCartShortages([{ id: "a", cardId: "c1", quantity: 3 }], [{ id: "c1", stock: 1 }]);
    expect(r[0]?.available).toBe(1);
  });
  it("keeps items with enough stock", () => {
    expect(findCartShortages([{ id: "a", cardId: "c1", quantity: 2 }], [{ id: "c1", stock: 2 }])).toEqual([]);
  });
  it("treats a card missing from the catalog as sold out", () => {
    expect(findCartShortages([{ id: "a", cardId: "c1", quantity: 1 }], [])[0]?.available).toBe(0);
  });
});
