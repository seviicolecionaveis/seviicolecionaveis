import rawCards from "./cards.json";

export type Finish = "Normal" | "Foil" | "Reverse Foil" | "Pokebola" | "Promo";
export type Language = "Português" | "Inglês" | "Italiano" | "Espanhol";

export interface RawCard {
  id: number;
  name: string;
  image: string;
  number: string;
  collection: string;
  finish: Finish;
  language: Language;
  stock: number;
  price: number | null;
}

export interface FinishVariant {
  finish: Finish;
  stock: number;
  price: number | null;
}

export interface Card {
  id: string;
  name: string;
  image: string;
  number: string;
  collection: string;
  language: Language;
  variants: FinishVariant[];
  // Aggregates for listing/filtering
  stock: number;
  price: number | null; // lowest available price across variants (or null)
  finish: Finish; // representative finish (most "premium" available, for badge)
}

const RAW: RawCard[] = rawCards as RawCard[];

// Priority for picking the "headline" finish badge on the card thumbnail
const FINISH_PRIORITY: Finish[] = ["Promo", "Pokebola", "Foil", "Reverse Foil", "Normal"];

function pickHeadlineFinish(variants: FinishVariant[]): Finish {
  const available = variants.filter((v) => v.stock > 0);
  const pool = available.length ? available : variants;
  for (const f of FINISH_PRIORITY) {
    if (pool.some((v) => v.finish === f)) return f;
  }
  return pool[0]?.finish ?? "Normal";
}

function groupKey(c: RawCard) {
  return `${c.name}__${c.collection}__${c.number}__${c.language}`;
}

const map = new Map<string, Card>();
for (const c of RAW) {
  const key = groupKey(c);
  const existing = map.get(key);
  if (!existing) {
    const variant: FinishVariant = { finish: c.finish, stock: c.stock, price: c.price };
    map.set(key, {
      id: key,
      name: c.name,
      image: c.image,
      number: c.number,
      collection: c.collection,
      language: c.language,
      variants: [variant],
      stock: c.stock,
      price: c.price,
      finish: c.finish,
    });
  } else {
    // Merge variant: if same finish exists, sum stock and keep min price
    const sameFinish = existing.variants.find((v) => v.finish === c.finish);
    if (sameFinish) {
      sameFinish.stock += c.stock;
      if (c.price != null) {
        sameFinish.price =
          sameFinish.price == null ? c.price : Math.min(sameFinish.price, c.price);
      }
    } else {
      existing.variants.push({ finish: c.finish, stock: c.stock, price: c.price });
    }
    existing.stock += c.stock;
    // image: prefer one that isn't a placeholder
    if (existing.image.includes("placehold.co") && !c.image.includes("placehold.co")) {
      existing.image = c.image;
    }
  }
}

// Finalize aggregates
for (const card of map.values()) {
  // Sort variants by priority (Normal first, then Reverse Foil, Foil, etc.)
  const order: Finish[] = ["Normal", "Reverse Foil", "Foil", "Pokebola", "Promo"];
  card.variants.sort((a, b) => order.indexOf(a.finish) - order.indexOf(b.finish));
  const prices = card.variants.map((v) => v.price).filter((p): p is number => p != null);
  card.price = prices.length ? Math.min(...prices) : null;
  card.finish = pickHeadlineFinish(card.variants);
}

export const CARDS: Card[] = Array.from(map.values()).sort((a, b) =>
  a.name.localeCompare(b.name),
);

export const COLLECTIONS = Array.from(
  new Set(CARDS.map((c) => c.collection).filter(Boolean)),
).sort();

export const FINISHES: Finish[] = ["Normal", "Reverse Foil", "Foil", "Pokebola", "Promo"];

export const LANGUAGES = Array.from(
  new Set(CARDS.map((c) => c.language).filter(Boolean)),
) as Language[];
