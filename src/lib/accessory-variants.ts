export type AccessoryVariant = {
  id: string;
  name: string;
  color: string | null;
  price_cents: number | null;
  stock: number;
  images: string[];
};

export function parseVariants(raw: unknown): AccessoryVariant[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .map((v) => ({
      id: String(v.id ?? ""),
      name: String(v.name ?? ""),
      color: typeof v.color === "string" && v.color ? v.color : null,
      price_cents:
        v.price_cents == null || v.price_cents === "" ? null : Number(v.price_cents),
      stock: Number(v.stock ?? 0) || 0,
      images: Array.isArray(v.images) ? v.images.map(String) : [],
    }))
    .filter((v) => v.id !== "");
}

/** `accessory:<uuid>` ou `accessory:<uuid>:<variantId>` */
export function parseAccessoryCartId(cartId: string) {
  const rest = cartId.slice("accessory:".length);
  const sep = rest.indexOf(":");
  if (sep === -1) return { accessoryId: rest, variantId: null as string | null };
  return { accessoryId: rest.slice(0, sep), variantId: rest.slice(sep + 1) || null };
}
