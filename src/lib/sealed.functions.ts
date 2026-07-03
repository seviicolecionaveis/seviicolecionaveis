import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sealedSlug } from "@/lib/slug";

export type SealedDetail = {
  id: string;
  title: string;
  description: string | null;
  price_cents: number;
  stock: number;
  images: string[];
  is_preorder: boolean;
  release_date: string | null;
  product_type: string | null;
  collection: string | null;
  language: string | null;
  distribution: string | null;
  condition: string | null;
  age_rating: string | null;
  sku: string | null;
  slug: string;
};

export const getSealedBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }): Promise<SealedDetail | null> => {
    const supabase = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const suffix = data.slug.split("-").pop() ?? "";
    const { data: rows } = await supabase
      .from("sealed_products")
      .select("id, title, description, price_cents, stock, images, is_preorder, release_date, product_type, collection, language, distribution, condition, age_rating, sku")
      .eq("active", true);
    if (!rows) return null;
    const match = rows.find((r) => {
      const idSuffix = r.id.replace(/-/g, "").slice(-6);
      if (idSuffix !== suffix) return false;
      return sealedSlug(r.title, r.id) === data.slug;
    });
    if (!match) return null;
    return {
      ...match,
      images: (match.images ?? []) as string[],
      is_preorder: !!match.is_preorder,
      slug: sealedSlug(match.title, match.id),
    } as SealedDetail;
  });
