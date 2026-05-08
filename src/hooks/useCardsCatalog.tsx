import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Card, CardCategory, Condition, Finish, FinishVariant, Language, LanguageVariant, RawCard } from "@/data/cards";
import { CONDITIONS } from "@/data/cards";

const FINISH_PRIORITY: Finish[] = ["Promo", "Pokebola", "Energia", "Foil", "Reverse Foil", "Normal"];
const FINISH_ORDER: Finish[] = ["Normal", "Reverse Foil", "Foil", "Pokebola", "Energia", "Promo"];
const LANGUAGE_ORDER: Language[] = ["Português", "Inglês", "Espanhol", "Italiano"];

function pickHeadlineFinish(variants: FinishVariant[]): Finish {
  const available = variants.filter((v) => v.stock > 0);
  const pool = available.length ? available : variants;
  for (const f of FINISH_PRIORITY) if (pool.some((v) => v.finish === f)) return f;
  return pool[0]?.finish ?? "Normal";
}

function buildCards(raw: RawCard[]): Card[] {
  const map = new Map<string, {
    id: string; name: string; image: string; number: string; collection: string;
    category: CardCategory;
    byLanguage: Map<Language, Map<string, FinishVariant>>;
  }>();
  for (const c of raw) {
    const key = `${c.name}__${c.collection}__${c.number}`;
    let wc = map.get(key);
    if (!wc) {
      wc = { id: key, name: c.name, image: c.image, number: c.number, collection: c.collection, category: c.category ?? "Pokémon", byLanguage: new Map() };
      map.set(key, wc);
    }
    if (wc.image.includes("placehold.co") && !c.image.includes("placehold.co")) wc.image = c.image;
    let langMap = wc.byLanguage.get(c.language);
    if (!langMap) { langMap = new Map(); wc.byLanguage.set(c.language, langMap); }
    const vKey = `${c.finish}|${c.condition}`;
    const existing = langMap.get(vKey);
    if (existing) {
      existing.stock += c.stock;
      if (c.price != null) existing.price = existing.price == null ? c.price : Math.min(existing.price, c.price);
    } else {
      langMap.set(vKey, { finish: c.finish, condition: c.condition, stock: c.stock, price: c.price });
    }
  }
  const out: Card[] = [];
  for (const wc of map.values()) {
    const languages: LanguageVariant[] = [];
    for (const [lang, finishMap] of wc.byLanguage.entries()) {
      const finishes = Array.from(finishMap.values()).sort((a, b) => {
        const f = FINISH_ORDER.indexOf(a.finish) - FINISH_ORDER.indexOf(b.finish);
        if (f !== 0) return f;
        return CONDITIONS.indexOf(a.condition) - CONDITIONS.indexOf(b.condition);
      });
      languages.push({ language: lang, finishes, stock: finishes.reduce((s, f) => s + f.stock, 0) });
    }
    languages.sort((a, b) => LANGUAGE_ORDER.indexOf(a.language) - LANGUAGE_ORDER.indexOf(b.language));
    const allVariants = languages.flatMap((l) => l.finishes);
    const totalStock = languages.reduce((s, l) => s + l.stock, 0);
    const prices = allVariants.map((v) => v.price).filter((p): p is number => p != null);
    const primary = languages.find((l) => l.stock > 0)?.language ?? languages[0]?.language ?? "Português";
    out.push({
      id: wc.id, name: wc.name, image: wc.image, number: wc.number, collection: wc.collection,
      languages, variants: allVariants, language: primary, stock: totalStock,
      price: prices.length ? Math.min(...prices) : null, finish: pickHeadlineFinish(allVariants),
      category: wc.category,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

let cache: Card[] | null = null;
let inFlight: Promise<Card[]> | null = null;
const listeners = new Set<(c: Card[]) => void>();

async function loadCards(): Promise<Card[]> {
  const all: any[] = [];
  const CHUNK = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("cards")
      .select("name, card_number, collection, language, finish, condition, stock, base_price_cents, image, category")
      .range(from, from + CHUNK - 1);
    if (error) { console.error("loadCards", error); break; }
    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < CHUNK) break;
    from += CHUNK;
  }
  const raw: RawCard[] = all.map((r, i) => ({
    id: i,
    name: r.name as string,
    image: (r.image as string) || `https://placehold.co/400x560/eeeeee/999999?text=${encodeURIComponent(r.name as string)}`,
    number: r.card_number as string,
    collection: r.collection as string,
    finish: r.finish as Finish,
    language: r.language as Language,
    condition: ((r.condition as Condition) ?? "NM"),
    stock: (r.stock as number) ?? 0,
    price: r.base_price_cents != null ? (r.base_price_cents as number) / 100 : null,
    category: (r.category as CardCategory) ?? "Pokémon",
  }));
  return buildCards(raw);
}

function refresh(): Promise<Card[]> {
  if (!inFlight) {
    inFlight = loadCards().then((c) => {
      cache = c;
      listeners.forEach((l) => l(c));
      return c;
    }).finally(() => { inFlight = null; });
  }
  return inFlight;
}

export function useCardsCatalog() {
  const [cards, setCards] = useState<Card[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let mounted = true;
    const listener = (c: Card[]) => { if (mounted) { setCards(c); setLoading(false); } };
    listeners.add(listener);
    if (!cache) {
      refresh().then((c) => mounted && setCards(c)).finally(() => mounted && setLoading(false));
    } else {
      setLoading(false);
    }
    return () => { mounted = false; listeners.delete(listener); };
  }, []);

  return { cards, loading, refresh: async () => { const c = await refresh(); setCards(c); } };
}

export function invalidateCardsCache() { cache = null; }
