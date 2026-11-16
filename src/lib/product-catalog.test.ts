import { describe, it, expect } from "vitest";
import {
  normalizeProductSearch,
  productMatches,
  productStock,
  productPrice,
  productSlug,
  stockLabel,
  type StoreProduct,
} from "./product-catalog";
const p: StoreProduct = {
  id: "a",
  title: "Pasta Pokémon",
  description: "Proteção de coleção",
  price_cents: 1990,
  stock: 5,
  images: [],
  sku: "ABC-12",
  tags: ["Edição especial"],
};
describe("accessory rules", () => {
  it("finds accent insensitive names descriptions tags and SKU", () => {
    expect(productMatches(p, "POKEMON")).toBe(true);
    expect(productMatches(p, "protecao")).toBe(true);
    expect(productMatches(p, "edicao")).toBe(true);
    expect(productMatches(p, "abc-12")).toBe(true);
    expect(productMatches(p, "inexistente")).toBe(false);
  });
  it("counts stock per variant, not base stock", () => {
    expect(
      productStock({
        ...p,
        variants: [
          { id: "red", name: "Vermelho", stock: 1 },
          { id: "blue", name: "Azul", stock: 2 },
        ],
      }),
    ).toBe(3);
  });
  it("uses the lowest variant price and persisted slug", () => {
    expect(
      productPrice({
        ...p,
        variants: [
          { id: "a", price_cents: 750 },
          { id: "b", price_cents: 1000 },
        ],
      }),
    ).toBe(750);
    expect(productSlug({ ...p, slug: "pasta-pokemon-2" })).toBe("pasta-pokemon-2");
  });
  it("marks three or fewer available units as low stock", () => {
    expect(stockLabel(3)).toBe("Poucas unidades");
    expect(stockLabel(0)).toBe("Esgotado");
    expect(stockLabel(4)).toBe("4 em estoque");
  });
});
