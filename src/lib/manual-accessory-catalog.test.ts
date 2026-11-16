import { it, expect } from "vitest";
import { manualAccessoryRows } from "./manual-accessory-catalog";
import { stockShortages, manualTotals } from "./manual-order";
it("manual order preserves accessory variation identifier price image and stock", () => {
  const rows = manualAccessoryRows({
    id: "a",
    title: "Pasta",
    description: null,
    price_cents: 1990,
    stock: 50,
    images: ["base"],
    variants: [{ id: "red", name: "Vermelho", stock: 1, price_cents: 2990, images: ["red"] }],
  });
  expect(rows[0]).toMatchObject({
    cardId: "accessory:a:red",
    priceCents: 2990,
    stock: 1,
    image: "red",
  });
  const item = {
    kind: "catalog" as const,
    cardId: rows[0].cardId,
    name: rows[0].name,
    unitPriceCents: rows[0].priceCents,
    quantity: 2,
  };
  expect(stockShortages([item], { "accessory:a:red": 1 })).toEqual([
    { cardId: "accessory:a:red", name: "Pasta — Vermelho", requested: 2, available: 1 },
  ]);
  expect(
    manualTotals([item], { discountType: "fixed", discountValue: 0, surchargeCents: 0 }, 0).total,
  ).toBe(5980);
});
