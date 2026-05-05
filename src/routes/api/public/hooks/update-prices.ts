import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { scrapeLigaPokemon } from "@/utils/cardPrices.server";

// Pequena pausa entre requisições para não sobrecarregar a Firecrawl
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runUpdate(runId: string) {
  let updated = 0;
  let errors = 0;
  let total = 0;

  try {
    // Busca todas as variantes únicas com estoque
    const { data: variants, error: vErr } = await supabaseAdmin
      .from("cards")
      .select("name, collection, card_number, finish, language")
      .gt("stock", 0);

    if (vErr) throw vErr;

    // Deduplica (uma carta pode ter várias linhas pra mesma combinação)
    const seen = new Set<string>();
    const unique = (variants ?? []).filter((v) => {
      const key = `${v.name}__${v.collection}__${v.card_number}__${v.finish}__${v.language}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    total = unique.length;
    await supabaseAdmin
      .from("price_update_runs")
      .update({ total_variants: total })
      .eq("id", runId);

    for (const v of unique) {
      try {
        const result = await scrapeLigaPokemon({
          cardName: v.name as string,
          collection: v.collection as string,
          cardNumber: v.card_number as string,
          finish: v.finish as string,
          language: v.language as string,
        });

        await supabaseAdmin.from("card_prices").upsert(
          {
            card_name: v.name,
            collection: v.collection,
            card_number: v.card_number,
            finish: v.finish,
            language: v.language,
            price_cents: result.priceCents,
            source_url: result.sourceUrl,
            last_error: result.error,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "card_name,collection,card_number,finish,language" },
        );

        if (result.error) errors++;
        else updated++;
      } catch (e) {
        errors++;
        console.error("Erro variante", v, e);
      }

      // Atualiza contadores a cada 25 cartas para acompanhar progresso
      if ((updated + errors) % 25 === 0) {
        await supabaseAdmin
          .from("price_update_runs")
          .update({ updated_count: updated, error_count: errors })
          .eq("id", runId);
      }

      // Pequena pausa para evitar rate limit
      await sleep(300);
    }

    await supabaseAdmin
      .from("price_update_runs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        updated_count: updated,
        error_count: errors,
      })
      .eq("id", runId);
  } catch (e) {
    console.error("[update-prices] falhou", e);
    await supabaseAdmin
      .from("price_update_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        updated_count: updated,
        error_count: errors,
        notes: (e as Error).message,
      })
      .eq("id", runId);
  }
}

export const Route = createFileRoute("/api/public/hooks/update-prices")({
  server: {
    handlers: {
      POST: async () => {
        // Cria registro de execução
        const { data: run, error } = await supabaseAdmin
          .from("price_update_runs")
          .insert({ status: "running", trigger: "cron" })
          .select("id")
          .single();

        if (error || !run) {
          return new Response(
            JSON.stringify({ error: error?.message ?? "failed to create run" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        // Dispara em background — retorna imediatamente para não dar timeout no cron
        runUpdate(run.id);

        return new Response(
          JSON.stringify({ ok: true, runId: run.id }),
          { status: 202, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
