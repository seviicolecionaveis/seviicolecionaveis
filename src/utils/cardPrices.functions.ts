import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { scrapeLigaPokemon, type ScrapeInput } from "./cardPrices.server";

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

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const result = await scrapeLigaPokemon(data);

    const { error } = await supabase.from("card_prices").upsert(
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
