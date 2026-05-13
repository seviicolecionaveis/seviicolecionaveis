import { createFileRoute } from "@tanstack/react-router";

const BATCH_SIZE = 40; // ~2 min por lote (margem segura no Worker)

type SupabaseAdmin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];
type ScrapeLigaPokemon = (typeof import("@/utils/cardPrices.server"))["scrapeLigaPokemon"];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processBatch(
  onlyMissing: boolean,
  supabaseAdmin: SupabaseAdmin,
  scrapeLigaPokemon: ScrapeLigaPokemon,
) {
  // 1. Cartas com estoque
  const { data: variants, error: vErr } = await supabaseAdmin
    .from("cards")
    .select("name, collection, card_number, finish, language")
    .gt("stock", 0);
  if (vErr) throw vErr;

  // 2. Deduplica
  const seen = new Set<string>();
  const dedup = (variants ?? []).filter((v) => {
    const k = `${v.name}__${v.collection}__${v.card_number}__${v.finish}__${v.language}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // 3. Filtra as que já têm preço
  let pool = dedup;
  if (onlyMissing) {
    // Pula variantes que já têm preço OU que já foram tentadas recentemente (com ou sem erro).
    // Variantes com erro são reprocessadas a cada 7 dias para checar se o problema foi resolvido.
    const retryAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabaseAdmin
      .from("card_prices")
      .select(
        "card_name, collection, card_number, finish, language, price_cents, last_error, updated_at",
      );
    const have = new Set(
      (existing ?? [])
        .filter((p) => {
          // Tem preço válido → pula
          if (p.price_cents != null && !p.last_error) return true;
          // Tem erro recente (< 7 dias) → pula desta vez
          if (p.last_error && p.updated_at && p.updated_at > retryAfter) return true;
          return false;
        })
        .map(
          (p) => `${p.card_name}__${p.collection}__${p.card_number}__${p.finish}__${p.language}`,
        ),
    );
    pool = dedup.filter(
      (v) => !have.has(`${v.name}__${v.collection}__${v.card_number}__${v.finish}__${v.language}`),
    );
  }

  const remaining = pool.length;
  const batch = pool.slice(0, BATCH_SIZE);

  let updated = 0;
  let errors = 0;

  for (const v of batch) {
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
      console.error("[update-prices] erro variante", v, e);
    }
    await sleep(150);
  }

  return { processed: batch.length, updated, errors, remaining: remaining - batch.length };
}

export const Route = createFileRoute("/api/public/hooks/update-prices")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const [{ supabaseAdmin }, { scrapeLigaPokemon }] = await Promise.all([
          import("@/integrations/supabase/client.server"),
          import("@/utils/cardPrices.server"),
        ]);
        const url = new URL(request.url);
        const onlyMissing = url.searchParams.get("onlyMissing") !== "false";

        const { data: run } = await supabaseAdmin
          .from("price_update_runs")
          .insert({ status: "running", trigger: "cron" })
          .select("id")
          .single();

        try {
          const result = await processBatch(onlyMissing, supabaseAdmin, scrapeLigaPokemon);

          if (run) {
            await supabaseAdmin
              .from("price_update_runs")
              .update({
                status: "completed",
                finished_at: new Date().toISOString(),
                total_variants: result.processed,
                updated_count: result.updated,
                error_count: result.errors,
                notes: `${result.remaining} variante(s) restante(s)`,
              })
              .eq("id", run.id);
          }

          return Response.json({ ok: true, ...result });
        } catch (e) {
          if (run) {
            await supabaseAdmin
              .from("price_update_runs")
              .update({
                status: "failed",
                finished_at: new Date().toISOString(),
                notes: (e as Error).message,
              })
              .eq("id", run.id);
          }
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
