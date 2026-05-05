// Server-only helpers for scraping prices from Liga Pokémon via Firecrawl.
export interface ScrapeInput {
  cardName: string;
  collection: string;
  cardNumber: string;
  finish: string;
  language: string;
}

export interface ScrapedPrice {
  priceCents: number | null;
  sourceUrl: string | null;
  error: string | null;
}

const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/search";

function finishHint(finish: string): string {
  switch (finish) {
    case "Normal": return "normal";
    case "Foil": return "holo";
    case "Reverse Foil": return "reverse";
    case "Pokebola": return "poke ball";
    case "Energia": return "master ball";
    case "Promo": return "promo";
    default: return "";
  }
}

function languageHint(language: string): string {
  if (language === "Português") return "português";
  if (language === "Inglês") return "inglês";
  if (language === "Espanhol") return "espanhol";
  if (language === "Italiano") return "italiano";
  return "";
}

export async function scrapeLigaPokemon(input: ScrapeInput): Promise<ScrapedPrice> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return { priceCents: null, sourceUrl: null, error: "FIRECRAWL_API_KEY não configurado" };
  }

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

  const results: any[] = searchData?.data?.web ?? searchData?.data ?? [];
  const hit = results.find((r: any) => r?.url?.includes("ligapokemon.com.br"));

  if (!hit) {
    return { priceCents: null, sourceUrl: null, error: "Carta não encontrada no Liga Pokémon" };
  }

  const markdown: string = hit.markdown ?? "";
  const sourceUrl: string = hit.url;

  const priceMatches = Array.from(markdown.matchAll(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g));
  if (priceMatches.length === 0) {
    return { priceCents: null, sourceUrl, error: "Nenhum preço encontrado na página" };
  }

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

  const pool = nmPrices.length > 0 ? nmPrices : priceMatches.map((m) =>
    parseFloat(m[1].replace(/\./g, "").replace(",", "."))
  ).filter((n) => !isNaN(n) && n > 0);

  if (pool.length === 0) {
    return { priceCents: null, sourceUrl, error: "Preços inválidos" };
  }

  const minPrice = Math.min(...pool);
  const finalPrice = minPrice * 1.03;
  const priceCents = Math.round(finalPrice * 100);

  return { priceCents, sourceUrl, error: null };
}
