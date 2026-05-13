import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ScrapeInput = {
  cardName: string;
  collection: string;
  cardNumber: string;
  finish: string;
  language: string;
};

export const fetchLigaPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ScrapeInput) => {
    if (!data?.cardName || !data?.finish || !data?.language) {
      throw new Error("cardName, finish e language são obrigatórios");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!role) {
      throw new Error("Apenas administradores podem atualizar preços.");
    }

    const [{ scrapeLigaPokemon }, { supabaseAdmin }] = await Promise.all([
      import("./cardPrices.server"),
      import("@/integrations/supabase/client.server"),
    ]);

    const result = await scrapeLigaPokemon(data);

    const { error } = await supabaseAdmin.from("card_prices").upsert(
      {
        card_name: data.cardName,
        collection: data.collection,
        card_number: data.cardNumber,
        finish: data.finish,
        language: data.language,
        price_cents: result.priceCents,
        source_url: result.sourceUrl,
        last_error: result.error,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "card_name,collection,card_number,finish,language" },
    );

    if (error) {
      throw new Error(`Não foi possível salvar o preço: ${error.message}`);
    }

    return result;
  });
