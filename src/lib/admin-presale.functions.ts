import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ProductSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(5000).default(""),
  image_url: z.string().url().nullable().optional(),
  image_urls: z.array(z.string().url()).default([]),
  price_cents: z.number().int().min(0).max(100_000_000),
  quantity: z.number().int().min(0).max(1_000_000).default(0),
  language: z.string().trim().max(20).nullable().optional(),
  release_year: z.number().int().min(1900).max(2100).nullable().optional(),
  available_from: z.string().nullable().optional(),
  whatsapp_button_text: z.string().trim().min(1).max(120).default("Quero reservar o meu!"),
  whatsapp_message_template: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .default('Olá! Vim do site e gostaria de reservar o meu "[nome do produto]".'),
  sort_order: z.number().int().default(0),
});

const PageUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/i, "slug inválido")
    .transform((s) => s.toLowerCase()),
  title: z.string().trim().min(1).max(200),
  is_active: z.boolean().default(false),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  sort_order: z.number().int().default(0),
  products: z.array(ProductSchema).default([]),
});

export const adminListPresalePages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./admin-presale.server");
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("presale_pages")
      .select("*, presale_products(count)")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) return { pages: [] as any[] };
    return { pages: data ?? [] };
  });

export const adminGetPresalePage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { assertAdmin } = await import("./admin-presale.server");
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: page } = await supabaseAdmin
      .from("presale_pages")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!page) return { page: null, products: [] };
    const { data: products } = await supabaseAdmin
      .from("presale_products")
      .select("*")
      .eq("page_id", data.id)
      .order("sort_order", { ascending: true });
    return { page, products: products ?? [] };
  });

export const adminUpsertPresalePage = createServerFn({ method: "POST" })
  .inputValidator((d) => PageUpsertSchema.parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { assertAdmin } = await import("./admin-presale.server");
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const pageRow = {
      slug: data.slug,
      title: data.title,
      is_active: data.is_active,
      starts_at: data.starts_at ?? null,
      ends_at: data.ends_at ?? null,
      sort_order: data.sort_order,
    };

    let pageId = data.id;
    if (pageId) {
      const { error } = await supabaseAdmin.from("presale_pages").update(pageRow).eq("id", pageId);
      if (error) return { success: false, error: error.message };
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("presale_pages")
        .insert(pageRow)
        .select("id")
        .single();
      if (error || !created) return { success: false, error: error?.message ?? "insert falhou" };
      pageId = created.id;
    }

    // Sync products: delete missing, upsert provided
    const { data: existing } = await supabaseAdmin
      .from("presale_products")
      .select("id")
      .eq("page_id", pageId);
    const keepIds = new Set(data.products.filter((p) => p.id).map((p) => p.id!));
    const toDelete = (existing ?? []).filter((e) => !keepIds.has(e.id)).map((e) => e.id);
    if (toDelete.length) {
      await supabaseAdmin.from("presale_products").delete().in("id", toDelete);
    }

    for (let i = 0; i < data.products.length; i++) {
      const p = data.products[i];
      const row = {
        page_id: pageId,
        name: p.name,
        description: p.description ?? "",
        image_url: p.image_url ?? null,
        price_cents: p.price_cents,
        quantity: p.quantity,
        language: p.language ?? null,
        release_year: p.release_year ?? null,
        available_from: p.available_from ?? null,
        whatsapp_button_text: p.whatsapp_button_text,
        whatsapp_message_template: p.whatsapp_message_template,
        sort_order: i,
      };
      if (p.id) {
        await supabaseAdmin.from("presale_products").update(row).eq("id", p.id);
      } else {
        await supabaseAdmin.from("presale_products").insert(row);
      }
    }

    return { success: true, id: pageId };
  });

export const adminTogglePresalePage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { assertAdmin } = await import("./admin-presale.server");
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("presale_pages")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    return { success: !error };
  });

export const adminDeletePresalePage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { assertAdmin } = await import("./admin-presale.server");
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("presale_pages").delete().eq("id", data.id);
    return { success: !error };
  });
