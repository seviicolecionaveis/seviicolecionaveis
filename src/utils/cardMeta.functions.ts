import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cardSlug, collectionSlug } from "@/lib/slug";


const SlugInput = z.object({ slug: z.string().min(1).max(200) });

export const getCardMetaBySlug = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SlugInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("cards")
      .select("name, collection, card_number, image");
    if (!rows) return null;
    const match = rows.find(
      (r) => cardSlug(r.name, r.collection, r.card_number) === data.slug,
    );
    if (!match) return null;
    return {
      name: match.name,
      collection: match.collection,
      number: match.card_number,
      image: match.image || null,
    };
  });

export const getCollectionMetaBySlug = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SlugInput.parse(d))
  .handler(async ({ data }) => {
    const { data: rows } = await supabaseAdmin
      .from("cards")
      .select("collection, image")
      .order("updated_at", { ascending: false });
    if (!rows) return null;
    const match = rows.find((r) => collectionSlug(r.collection) === data.slug);
    if (!match) return null;
    return {
      collection: match.collection,
      image: match.image || null,
      count: rows.filter((r) => collectionSlug(r.collection) === data.slug).length,
    };
  });
