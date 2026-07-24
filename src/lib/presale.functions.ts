import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export type PaymentOption =
  | { metodo: "pix"; valor_cents: number }
  | { metodo: "cartao_vista"; valor_cents: number }
  | { metodo: "cartao_credito"; valor_total_cents: number; parcelas: number };

export type PublicPresaleProduct = {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  image_urls: string[];
  price_cents: number;
  language: string | null;
  release_year: number | null;
  available_from: string | null;
  whatsapp_button_text: string;
  whatsapp_message_template: string;
  sort_order: number;
  payment_options: PaymentOption[];
};

export type PublicPresalePage = {
  id: string;
  slug: string;
  title: string;
  products: PublicPresaleProduct[];
};

// Public: list active pages (summary)
export const listActivePresalePages = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("presale_pages")
    .select("id, slug, title, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[presale] listActive failed", error);
    return { pages: [] as Array<{ id: string; slug: string; title: string }> };
  }
  return { pages: (data ?? []).map((p) => ({ id: p.id, slug: p.slug, title: p.title })) };
});

// Public: get one page + products by slug (no quantity)
export const getActivePresalePageBySlug = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ slug: z.string().trim().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: page, error } = await supabase
      .from("presale_pages")
      .select("id, slug, title")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error || !page) return { page: null as PublicPresalePage | null };

    const { data: products, error: pErr } = await supabase
      .from("presale_products")
      .select(
        "id, name, description, image_url, image_urls, price_cents, language, release_year, available_from, whatsapp_button_text, whatsapp_message_template, sort_order",
      )
      .eq("page_id", page.id)
      .order("sort_order", { ascending: true });
    if (pErr) {
      console.error("[presale] products failed", pErr);
      return { page: { ...page, products: [] } };
    }
    return { page: { ...page, products: (products ?? []) as PublicPresaleProduct[] } };
  });
