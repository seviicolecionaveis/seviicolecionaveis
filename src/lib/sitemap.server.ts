import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEST_ADMIN_CARD_ID } from "@/lib/test-card";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function buildSitemapXml(origin: string): Promise<string> {
  const urls: { loc: string; lastmod?: string }[] = [
    { loc: `${origin}/` },
    { loc: `${origin}/cartas` },
    { loc: `${origin}/colecoes` },
    { loc: `${origin}/mais-vendidas` },
    { loc: `${origin}/produtos-lacrados` },
    { loc: `${origin}/imas` },
    { loc: `${origin}/acessorios` },
    { loc: `${origin}/sobre` },
    { loc: `${origin}/faq` },
    { loc: `${origin}/tipos-de-carta` },
    { loc: `${origin}/envios` },
    { loc: `${origin}/favoritos` },
  ];

  const cardsAll: any[] = [];
  const CHUNK = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from("cards")
      .select("id, name, collection, card_number, updated_at")
      .neq("id", TEST_ADMIN_CARD_ID)
      .range(from, from + CHUNK - 1);
    if (error) break;
    const batch = data ?? [];
    cardsAll.push(...batch);
    if (batch.length < CHUNK) break;
    from += CHUNK;
  }

  const seenCard = new Set<string>();
  const collections = new Map<string, string>();
  for (const c of cardsAll) {
    const key = `${c.name}__${c.collection}__${c.card_number}`;
    if (!seenCard.has(key)) {
      seenCard.add(key);
      const slug = slugify(`${c.collection}-${c.card_number}-${c.name}`);
      urls.push({ loc: `${origin}/carta/${slug}`, lastmod: c.updated_at });
    }
    const prev = collections.get(c.collection);
    if (!prev || (c.updated_at && c.updated_at > prev)) {
      collections.set(c.collection, c.updated_at);
    }
  }
  for (const [name, lastmod] of collections.entries()) {
    urls.push({ loc: `${origin}/colecao/${slugify(name)}`, lastmod });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ""}</url>`,
  )
  .join("\n")}
</urlset>`;
}
