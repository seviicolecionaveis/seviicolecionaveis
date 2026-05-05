import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface ScrapeInput {
  cardName: string;
  collection: string;
  cardNumber: string;
  finish: string;
  language: string;
}

const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/search";

// Mapeia o "finish" interno para um termo que ajuda na busca no Liga Pokémon
function finishHint(finish: string): string {
  switch (finish) {
    case "Normal":
      return "normal";
    case "Foil":
      return "holo";
    case "Reverse Foil":
      return "reverse";
    case "Pokebola":
      return "poke ball";
    case "Energia":
      return "master ball";
    case "Promo":
      return "promo";
    default:
      return "";
  }
}

// Idioma para filtro
function languageHint(language: string): string {
  if (language === "Português") return "português";
  if (language === "Inglês") return "inglês";
  if (language === "Espanhol") return "espanhol";
  if (language === "Italiano") return "italiano";
  return "";
}

interface ScrapedPrice {
  priceCents: number | null;
  sourceUrl: string | null;
  error: string | null;
}

async function scrapeLigaPokemon(input: ScrapeInput): Promise<ScrapedPrice> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return { priceCents: null, sourceUrl: null, error: "FIRECRAWL_API_KEY não configurado" };
  }

  // Monta query: nome + número + coleção (curta) + acabamento + idioma
  // Ex: "Pikachu 058 Equilíbrio Perfeito reverse português site:ligapokemon.com.br"
  const collectionShort = input.collection.replace(/^[A-Z]{2,4}\s*-\s*/, "").trim();
  const cardNumberShort = input.cardNumber.split("/")[0];
  const query = `${input.cardName} ${cardNumberShort} ${collectionShort} ${finishHint(input.finish)} ${languageHint(input.language)} site:ligapokemon.com.br`.trim();

  let searchData: any;
  try {
    const searchRes = await fetch(FIRECRAWL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: 1,
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
    });

    if (!searchRes.ok) {
      const text = await searchRes.text();
      return { priceCents: null, sourceUrl: null, error: `Firecrawl ${searchRes.status}: ${text.slice(0, 200)}` };
    }

    searchData = await searchRes.json();
  } catch (e) {
    return { priceCents: null, sourceUrl: null, error: `Erro de rede: ${(e as Error).message}` };
  }

  // Resultados podem vir em data.web ou data
  const results: any[] = searchData?.data?.web ?? searchData?.data ?? [];
  const hit = results.find((r: any) => r?.url?.includes("ligapokemon.com.br"));

  if (!hit) {
    return { priceCents: null, sourceUrl: null, error: "Carta não encontrada no Liga Pokémon" };
  }

  const markdown: string = hit.markdown ?? "";
  const sourceUrl: string = hit.url;

  // Extrai TODOS os preços R$ X,XX do markdown (página de listagem mostra vários vendedores)
  const priceMatches = Array.from(markdown.matchAll(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g));
  if (priceMatches.length === 0) {
    return { priceCents: null, sourceUrl, error: "Nenhum preço encontrado na página" };
  }

  // Filtra preços que aparecem perto de "NM" (próxima ou mesma linha)
  const lines = markdown.split("\n");
  const nmPrices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ctx = `${lines[i - 1] ?? ""}\n${line}\n${lines[i + 1] ?? ""}`;
    if (!/\bNM\b/.test(ctx)) continue;
    const matches = line.matchAll(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g);
    for (const m of matches) {
      const value = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
      if (!isNaN(value) && value > 0) nmPrices.push(value);
    }
  }

  // Se não conseguimos isolar NM, usa todos os preços (fallback)
  const pool = nmPrices.length > 0 ? nmPrices : priceMatches.map((m) =>
    parseFloat(m[1].replace(/\./g, "").replace(",", "."))
  ).filter((n) => !isNaN(n) && n > 0);

  if (pool.length === 0) {
    return { priceCents: null, sourceUrl, error: "Preços inválidos" };
  }

  const minPrice = Math.min(...pool);
  // Acrescenta 3% conforme regra de negócio
  const finalPrice = minPrice * 1.03;
  const priceCents = Math.round(finalPrice * 100);

  return { priceCents, sourceUrl, error: null };
}

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
