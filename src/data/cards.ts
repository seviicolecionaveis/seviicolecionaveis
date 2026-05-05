import rawCards from "./cards.json";

export type Finish = "Normal" | "Foil" | "Reverse Foil" | "Pokebola" | "Energia" | "Promo";
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

export interface LanguageVariant {
  language: Language;
  finishes: FinishVariant[];
  stock: number; // sum across finishes for this language
}

export interface Card {
  id: string;
  name: string;
  image: string;
  number: string;
  collection: string;
  // All language groups, each with its own finishes
  languages: LanguageVariant[];
  // Flattened finishes across all languages (for filtering)
  variants: FinishVariant[];
  // Aggregates for listing/filtering
  language: Language; // primary language (first available)
  stock: number;
  price: number | null; // lowest available price across all variants
  finish: Finish; // representative finish (most "premium" available, for badge)
}

const RAW: RawCard[] = rawCards as RawCard[];

const FINISH_PRIORITY: Finish[] = ["Promo", "Pokebola", "Energia", "Foil", "Reverse Foil", "Normal"];
const FINISH_ORDER: Finish[] = ["Normal", "Reverse Foil", "Foil", "Pokebola", "Energia", "Promo"];
const LANGUAGE_ORDER: Language[] = ["Português", "Inglês", "Espanhol", "Italiano"];

function pickHeadlineFinish(variants: FinishVariant[]): Finish {
  const available = variants.filter((v) => v.stock > 0);
  const pool = available.length ? available : variants;
  for (const f of FINISH_PRIORITY) {
    if (pool.some((v) => v.finish === f)) return f;
  }
  return pool[0]?.finish ?? "Normal";
}

// Group ignoring language so the same card across idiomas vira uma única entrada
function groupKey(c: RawCard) {
  return `${c.name}__${c.collection}__${c.number}`;
}

interface WorkingCard {
  id: string;
  name: string;
  image: string;
  number: string;
  collection: string;
  byLanguage: Map<Language, Map<Finish, FinishVariant>>;
}

const map = new Map<string, WorkingCard>();
for (const c of RAW) {
  const key = groupKey(c);
  let wc = map.get(key);
  if (!wc) {
    wc = {
      id: key,
      name: c.name,
      image: c.image,
      number: c.number,
      collection: c.collection,
      byLanguage: new Map(),
    };
    map.set(key, wc);
  }
  // Prefer non-placeholder image
  if (wc.image.includes("placehold.co") && !c.image.includes("placehold.co")) {
    wc.image = c.image;
  }
  let langMap = wc.byLanguage.get(c.language);
  if (!langMap) {
    langMap = new Map();
    wc.byLanguage.set(c.language, langMap);
  }
  const existing = langMap.get(c.finish);
  if (existing) {
    existing.stock += c.stock;
    if (c.price != null) {
      existing.price =
        existing.price == null ? c.price : Math.min(existing.price, c.price);
    }
  } else {
    langMap.set(c.finish, { finish: c.finish, stock: c.stock, price: c.price });
  }
}

const finalCards: Card[] = [];
for (const wc of map.values()) {
  const languages: LanguageVariant[] = [];
  for (const [lang, finishMap] of wc.byLanguage.entries()) {
    const finishes = Array.from(finishMap.values()).sort(
      (a, b) => FINISH_ORDER.indexOf(a.finish) - FINISH_ORDER.indexOf(b.finish),
    );
    const langStock = finishes.reduce((s, f) => s + f.stock, 0);
    languages.push({ language: lang, finishes, stock: langStock });
  }
  languages.sort(
    (a, b) => LANGUAGE_ORDER.indexOf(a.language) - LANGUAGE_ORDER.indexOf(b.language),
  );

  const allVariants: FinishVariant[] = languages.flatMap((l) => l.finishes);
  const totalStock = languages.reduce((s, l) => s + l.stock, 0);
  const prices = allVariants.map((v) => v.price).filter((p): p is number => p != null);

  // Choose primary language: prefer one with stock, in LANGUAGE_ORDER
  const primary =
    languages.find((l) => l.stock > 0)?.language ?? languages[0]?.language ?? "Português";

  finalCards.push({
    id: wc.id,
    name: wc.name,
    image: wc.image,
    number: wc.number,
    collection: wc.collection,
    languages,
    variants: allVariants,
    language: primary,
    stock: totalStock,
    price: prices.length ? Math.min(...prices) : null,
    finish: pickHeadlineFinish(allVariants),
  });
}

export const CARDS: Card[] = finalCards.sort((a, b) => a.name.localeCompare(b.name));

export const COLLECTIONS = Array.from(
  new Set(CARDS.map((c) => c.collection).filter(Boolean)),
).sort();

export const FINISHES: Finish[] = ["Normal", "Reverse Foil", "Foil", "Pokebola", "Energia", "Promo"];

export const LANGUAGES = Array.from(
  new Set(CARDS.flatMap((c) => c.languages.map((l) => l.language)).filter(Boolean)),
) as Language[];
