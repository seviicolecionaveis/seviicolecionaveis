import { describe, it, expect } from "vitest";
import { isNoDiscountItem, noDiscountSubtotalCents } from "./no-discount-items";

describe("cartas sem desconto adicional", () => {
  it("Mega Greninja ex 122/086 Illustration Rare não aceita desconto", () => {
    expect(isNoDiscountItem({ name: "Mega Greninja ex", number: "122/086", finish: "Illustration Rare" })).toBe(true);
  });
  it("outras cartas continuam aceitando", () => {
    expect(isNoDiscountItem({ name: "Pikachu", number: "001/086", finish: "Normal" })).toBe(false);
  });
  it("soma só o valor da carta bloqueada", () => {
    expect(
      noDiscountSubtotalCents([
        { name: "Mega Greninja ex", number: "122/086", finish: "Illustration Rare", unitPrice: 600, quantity: 1 },
        { name: "Pikachu", number: "001/086", finish: "Normal", unitPrice: 10, quantity: 2 },
      ]),
    ).toBe(60000);
  });
});
