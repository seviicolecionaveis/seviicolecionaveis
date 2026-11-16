import type { Json } from "@/integrations/supabase/types";
import { parseVariants } from "@/lib/accessory-variants";
import { slugify } from "@/lib/slug";
export type StoreProduct = {
  id: string;
  title: string;
  description: string | null;
  price_cents: number;
  stock: number;
  images: string[];
  slug?: string | null;
  sku?: string | null;
  tags?: string[];
  category?: string;
  variants?: Json;
  active?: boolean;
  is_preorder?: boolean;
  release_date?: string | null;
  product_type?: string | null;
  collection?: string | null;
  language?: string | null;
  distribution?: string | null;
  condition?: string | null;
  age_rating?: string | null;
};
export function normalizeProductSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
export function productMatches(p: StoreProduct, q: string) {
  return normalizeProductSearch(
    [p.title, p.description, p.category, p.sku, p.product_type, p.collection, ...(p.tags ?? [])]
      .filter(Boolean)
      .join(" "),
  ).includes(normalizeProductSearch(q));
}
export function productStock(p: StoreProduct) {
  const v = parseVariants(p.variants);
  return v.length ? v.reduce((s, v) => s + Math.max(0, v.stock), 0) : p.stock;
}
export function productPrice(p: StoreProduct) {
  const v = parseVariants(p.variants);
  return v.length ? Math.min(...v.map((v) => v.price_cents ?? p.price_cents)) : p.price_cents;
}
export function productCover(p: StoreProduct) {
  return parseVariants(p.variants).find((v) => v.images.length)?.images[0] ?? p.images[0];
}
export function productSlug(p: StoreProduct) {
  return p.slug || slugify(p.title);
}
export function stockLabel(stock: number) {
  return stock <= 0 ? "Esgotado" : stock <= 3 ? "Poucas unidades" : `${stock} em estoque`;
}
export const formatProductPrice = (c: number) =>
  `R$ ${(c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
