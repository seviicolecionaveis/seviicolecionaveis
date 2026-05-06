// Server-only helpers for scraping prices from Liga Pokémon via Firecrawl.
// Strategy: search to find the canonical card URL, then scrape that page and
// parse the "Preço Médio de Venda no Marketplace" table, which lists the
// MIN / AVG / MAX price per finish ("Extras"). We use the MIN price of the
// requested finish so different variants get different prices.
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

const FIRECRAWL_SEARCH = "https://api.firecrawl.dev/v2/search";
const FIRECRAWL_SCRAPE = "https://api.firecrawl.dev/v2/scrape";

// Map our internal finish names to the labels used by Liga Pokémon in the
// "Preço Médio por Extras" table. Each entry lists every label/abbrev that
// should match this finish (case-insensitive, exact match against the line).
const FINISH_LABELS: Record<string, string[]> = {
  Normal: ["Normal", "Normal / Sem Extras", "N"],
  Foil: ["Foil", "F", "Holo Foil"],
  "Reverse Foil": ["Reverse Foil", "RF"],
  Pokebola: ["Pokeball Foil", "Pokebola Foil", "Poke Ball", "Pokeball", "PB"],
  Energia: ["Master Ball", "Masterball Foil", "Master Ball Foil", "MB"],
  Promo: ["Promo", "P"],
};

function languageHint(language: string): string {
  if (language === "Português") return "português";
  if (language === "Inglês") return "inglês";
  if (language === "Espanhol") return "espanhol";
  if (language === "Italiano") return "italiano";
  return "";
}

function parseBRL(value: string): number | null {
  const m = value.match(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}

/**
 * Parse the "Preço Médio de Venda no Marketplace" block.
 * Format (one line each, blank lines between):
 *   <abbrev>      e.g. "N", "F", "RF"
 *   <full label>  e.g. "Normal", "Foil", "Reverse Foil"
 *   R$ <min>
 *   R$ <avg>
 *   R$ <max>
 *
 * Returns a map of normalizedLabel -> minPrice (in BRL).
 */
function parseExtrasTable(markdown: string): Map<string, number> {
  const out = new Map<string, number>();
  const startIdx = markdown.indexOf("Preço Médio de Venda no Marketplace");
  if (startIdx === -1) return out;
  // Limit to until the next major section to avoid grabbing unrelated prices.
  const endIdx = markdown.indexOf("[Comprar no Marketplace", startIdx);
  const section = markdown.slice(
    startIdx,
    endIdx === -1 ? startIdx + 4000 : endIdx,
  );

  const lines = section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (let i = 0; i < lines.length; i++) {
    // Look for a label line followed by 3 price lines.
    const label = lines[i];
    if (label.startsWith("R$") || label.startsWith("[")) continue;
    if (label.length > 40) continue;
    if (i + 3 >= lines.length) break;
    const p1 = parseBRL(lines[i + 1]);
    const p2 = parseBRL(lines[i + 2]);
    const p3 = parseBRL(lines[i + 3]);
    if (p1 == null || p2 == null || p3 == null) continue;
    // Use the lowest of the three (MIN).
    const min = Math.min(p1, p2, p3);
    out.set(label.toLowerCase(), min);
  }
  return out;
}

function findFinishPrice(
  table: Map<string, number>,
  finish: string,
): number | null {
  const labels = FINISH_LABELS[finish] ?? [finish];
  for (const lbl of labels) {
    const v = table.get(lbl.toLowerCase());
    if (v != null) return v;
  }
  return null;
}

async function findCardUrl(
  input: ScrapeInput,
  apiKey: string,
): Promise<{ url: string | null; error: string | null }> {
  const collectionShort = input.collection.replace(/^[A-Z]{2,4}\s*-\s*/, "").trim();
  // Remove leading zeros: "060" -> "60" (Liga normalmente usa o número limpo)
  const cardNumberShort = input.cardNumber.split("/")[0].replace(/^0+/, "") || "0";
  // Não incluímos o idioma na query: a página da carta no Liga é única e
  // contém todos os idiomas/finishes na mesma tabela. Adicionar "português"
  // ou "inglês" só atrapalha o ranking do Google.
  const query = `${input.cardName} ${cardNumberShort} ${collectionShort} site:ligapokemon.com.br`.trim();

  try {
    const res = await fetch(FIRECRAWL_SEARCH, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, limit: 5 }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { url: null, error: `Firecrawl search ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = await res.json();
    const results: any[] = data?.data?.web ?? data?.data ?? [];
    const cardNumberRaw = input.cardNumber.split("/")[0];
    // Match contra número com ou sem zeros à esquerda
    const matchesNumber = (u: string) =>
      u.includes(`(${cardNumberRaw}/`) ||
      u.includes(`(${cardNumberShort}/`) ||
      u.includes(`%20${cardNumberRaw}`) ||
      u.includes(`%20${cardNumberShort}`);
    const card =
      results.find(
        (r: any) =>
          r?.url?.includes("ligapokemon.com.br") &&
          r?.url?.includes("view=cards") &&
          matchesNumber(r.url),
      ) ??
      results.find(
        (r: any) =>
          r?.url?.includes("ligapokemon.com.br") && r?.url?.includes("view=cards"),
      ) ??
      results.find((r: any) => r?.url?.includes("ligapokemon.com.br"));
    return { url: card?.url ?? null, error: card ? null : "Carta não encontrada no Liga Pokémon" };
  } catch (e) {
    return { url: null, error: `Erro de rede (search): ${(e as Error).message}` };
  }
}

async function scrapePage(
  url: string,
  apiKey: string,
): Promise<{ markdown: string | null; error: string | null }> {
  try {
    const res = await fetch(FIRECRAWL_SCRAPE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { markdown: null, error: `Firecrawl scrape ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = await res.json();
    const md = data?.data?.markdown ?? null;
    if (!md) return { markdown: null, error: "Página sem conteúdo" };
    return { markdown: md, error: null };
  } catch (e) {
    return { markdown: null, error: `Erro de rede (scrape): ${(e as Error).message}` };
  }
}

export async function scrapeLigaPokemon(input: ScrapeInput): Promise<ScrapedPrice> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return { priceCents: null, sourceUrl: null, error: "FIRECRAWL_API_KEY não configurado" };
  }

  // 1. Find the canonical card page URL via search.
  const { url, error: urlErr } = await findCardUrl(input, apiKey);
  if (!url) {
    return { priceCents: null, sourceUrl: null, error: urlErr ?? "URL não encontrada" };
  }

  // 2. Scrape that page directly.
  const { markdown, error: scrapeErr } = await scrapePage(url, apiKey);
  if (!markdown) {
    return { priceCents: null, sourceUrl: url, error: scrapeErr };
  }

  // 3. Parse the "Preço Médio por Extras" table.
  const table = parseExtrasTable(markdown);
  if (table.size === 0) {
    return { priceCents: null, sourceUrl: url, error: "Tabela de preços por extras não encontrada" };
  }

  // 4. Pick the price for the requested finish.
  const minPrice = findFinishPrice(table, input.finish);
  if (minPrice == null) {
    const available = Array.from(table.keys()).join(", ");
    return {
      priceCents: null,
      sourceUrl: url,
      error: `Finish "${input.finish}" indisponível no Liga Pokémon (disponíveis: ${available})`,
    };
  }

  // 5. Apply 3% markup.
  const finalPrice = minPrice * 1.03;
  return { priceCents: Math.round(finalPrice * 100), sourceUrl: url, error: null };
}
