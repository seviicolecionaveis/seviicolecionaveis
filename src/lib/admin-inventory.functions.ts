import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseVariants } from "@/lib/accessory-variants";
import { z } from "zod";
export type InventoryRow = {
  id: string;
  kind: "card" | "sealed" | "panel" | "accessory";
  title: string;
  description: string | null;
  category: string;
  stock: number;
  price_cents: number;
  images: string[];
  active: boolean;
  sku: string | null;
  slug: string | null;
  tags: string[];
  variants: ReturnType<typeof parseVariants>;
  productCategory: string;
  is_preorder: boolean;
  release_date: string | null;
  product_type: string | null;
  collection: string | null;
  language: string | null;
  distribution: string | null;
  condition: string | null;
  age_rating: string | null;
  sort_order: number;
};
export const listInventoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!admin) throw new Error("Acesso negado.");
    const db = context.supabase;
    const rows: InventoryRow[] = [];
    for (const table of ["cards", "sealed_products", "panels", "accessories"] as const) {
      let from = 0;
      while (true) {
        const { data, error } = await db
          .from(table)
          .select("*")
          .range(from, from + 999);
        if (error) throw new Error("Não foi possível carregar o estoque.");
        for (const p of data ?? []) {
          const c = p as unknown as Record<string, any>;
          rows.push({
            id: c.id,
            is_preorder: c.is_preorder ?? false,
            release_date: c.release_date ?? null,
            product_type: c.product_type ?? null,
            collection: c.collection ?? null,
            language: c.language ?? null,
            distribution: c.distribution ?? null,
            condition: c.condition ?? null,
            age_rating: c.age_rating ?? null,
            sort_order: c.sort_order ?? 0,
            productCategory: c.category ?? "",
            kind:
              table === "cards"
                ? "card"
                : table === "sealed_products"
                  ? "sealed"
                  : table === "panels"
                    ? "panel"
                    : "accessory",
            title: c.title ?? c.name,
            description: c.description ?? null,
            category:
              table === "cards"
                ? "Cartas"
                : table === "sealed_products"
                  ? "Produtos Lacrados"
                  : table === "panels"
                    ? "Painéis"
                    : "Acessórios",
            stock: c.stock ?? 0,
            price_cents: c.price_cents ?? c.base_price_cents ?? 0,
            images: c.images ?? (c.image ? [c.image] : []),
            active: c.active ?? true,
            sku: c.sku ?? c.card_number ?? null,
            slug: c.slug ?? null,
            tags: c.tags ?? [],
            variants: parseVariants(c.variants),
          });
        }
        if ((data ?? []).length < 1000) break;
        from += 1000;
      }
    }
    return rows;
  });
export const toggleInventoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        kind: z.enum(["sealed", "panel", "accessory"]),
        active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!admin) throw new Error("Acesso negado.");
    const table =
      data.kind === "accessory"
        ? "accessories"
        : data.kind === "sealed"
          ? "sealed_products"
          : "panels";
    const { error } = await context.supabase
      .from(table)
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error("Não foi possível alterar o produto.");
    return { ok: true };
  });
