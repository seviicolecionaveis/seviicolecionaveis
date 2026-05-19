import rawCards from "./cards.json";

export type Finish = "Normal" | "Foil" | "Reverse Foil" | "Pokebola" | "Masterball" | "Energia" | "Promo" | "Ímã" | "Shattered Holo" | "Illustration Rare" | "Ultra Rara" | "Black Star Promo" | "Double Rare";
export type Language = "Português" | "Inglês" | "Italiano" | "Espanhol" | "Japonês" | "Chinês";
export type Condition = "M" | "NM" | "SP" | "MP" | "HP" | "D";
export type CardCategory = "Pokémon" | "Treinador" | "Energia";

export const CARD_CATEGORIES: CardCategory[] = ["Pokémon", "Treinador", "Energia"];

export const CONDITIONS: Condition[] = ["M", "NM", "SP", "MP", "HP", "D"];
export const CONDITION_LABEL: Record<Condition, string> = {
  M: "M (Lacrada)",
  NM: "NM (Praticamente nova)",
  SP: "SP (Levemente usada)",
  MP: "MP (Moderadamente usada)",
  HP: "HP (Muito usada)",
  D: "D (Danificada)",
};

export interface RawCard {
  id: number;
  name: string;
  image: string;
  number: string;
  collection: string;
  finish: Finish;
  language: Language;
  condition: Condition;
  stock: number;
  price: number | null;
  category?: CardCategory;
}

export interface FinishVariant {
  finish: Finish;
  condition: Condition;
  stock: number;
  price: number | null;
}

export interface LanguageVariant {
  language: Language;
  finishes: FinishVariant[];
  stock: number;
}

export interface Card {
  id: string;
  name: string;
  image: string;
  number: string;
  collection: string;
  languages: LanguageVariant[];
  variants: FinishVariant[];
  language: Language;
  stock: number;
  price: number | null;
  finish: Finish;
  category: CardCategory;
}

const RAW: RawCard[] = (rawCards as any[]).map((c) => ({
  ...c,
  condition: (c.condition as Condition) ?? "NM",
})) as RawCard[];

const FINISH_PRIORITY: Finish[] = ["Promo", "Masterball", "Pokebola", "Energia", "Foil", "Reverse Foil", "Normal"];
const FINISH_ORDER: Finish[] = ["Normal", "Reverse Foil", "Foil", "Pokebola", "Masterball", "Energia", "Promo"];
const LANGUAGE_ORDER: Language[] = ["Português", "Inglês", "Espanhol", "Italiano", "Japonês", "Chinês"];

function pickHeadlineFinish(variants: FinishVariant[]): Finish {
  const available = variants.filter((v) => v.stock > 0);
  const pool = available.length ? available : variants;
  for (const f of FINISH_PRIORITY) {
    if (pool.some((v) => v.finish === f)) return f;
  }
  return pool[0]?.finish ?? "Normal";
}

function groupKey(c: RawCard) {
  return `${c.name}__${c.collection}__${c.number}`;
}

interface WorkingCard {
  id: string;
  name: string;
  image: string;
  number: string;
  collection: string;
  // language -> (finish|condition) -> variant
  byLanguage: Map<Language, Map<string, FinishVariant>>;
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
  if (wc.image.includes("placehold.co") && !c.image.includes("placehold.co")) {
    wc.image = c.image;
  }
  let langMap = wc.byLanguage.get(c.language);
  if (!langMap) {
    langMap = new Map();
    wc.byLanguage.set(c.language, langMap);
  }
  const vKey = `${c.finish}|${c.condition}`;
  const existing = langMap.get(vKey);
  if (existing) {
    existing.stock += c.stock;
    if (c.price != null) {
      existing.price = existing.price == null ? c.price : Math.min(existing.price, c.price);
    }
  } else {
    langMap.set(vKey, { finish: c.finish, condition: c.condition, stock: c.stock, price: c.price });
  }
}

const finalCards: Card[] = [];
for (const wc of map.values()) {
  const languages: LanguageVariant[] = [];
  for (const [lang, finishMap] of wc.byLanguage.entries()) {
    const finishes = Array.from(finishMap.values()).sort((a, b) => {
      const f = FINISH_ORDER.indexOf(a.finish) - FINISH_ORDER.indexOf(b.finish);
      if (f !== 0) return f;
      return CONDITIONS.indexOf(a.condition) - CONDITIONS.indexOf(b.condition);
    });
    const langStock = finishes.reduce((s, f) => s + f.stock, 0);
    languages.push({ language: lang, finishes, stock: langStock });
  }
  languages.sort(
    (a, b) => LANGUAGE_ORDER.indexOf(a.language) - LANGUAGE_ORDER.indexOf(b.language),
  );

  const allVariants: FinishVariant[] = languages.flatMap((l) => l.finishes);
  const totalStock = languages.reduce((s, l) => s + l.stock, 0);
  const prices = allVariants.map((v) => v.price).filter((p): p is number => p != null);

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
    category: "Pokémon",
    stock: totalStock,
    price: prices.length ? Math.min(...prices) : null,
    finish: pickHeadlineFinish(allVariants),
  });
}

export const CARDS: Card[] = finalCards.sort((a, b) => a.name.localeCompare(b.name));

// Coleções adicionadas manualmente a pedido (mantidas mesmo sem estoque cadastrado)
export const EXTRA_COLLECTIONS = [
  "MEW - 151",
  "VIV - Voltagem Vívida",
  "ASR - Estrelas Radiantes",
  "TEF - Forças Temporais",
  "SSH - Espada e Escudo",
  "CRI - Caos Ascendente",
  "EVO - Evolutions",
  "FLF - Flash de Fogo",
  "UPR - Ultraprisma",
  "FST - Golpe Fusão",
  "TK6B - XY Trainer Kit - Sylveon",
];

export const COLLECTIONS = Array.from(
  new Set([...CARDS.map((c) => c.collection).filter(Boolean), ...EXTRA_COLLECTIONS]),
).sort();

export const FINISHES: Finish[] = ["Normal", "Reverse Foil", "Foil", "Pokebola", "Masterball", "Energia", "Promo", "Ímã", "Shattered Holo", "Illustration Rare", "Ultra Rara", "Black Star Promo", "Double Rare"];

const EXTRA_LANGUAGES: Language[] = ["Japonês", "Chinês"];
export const LANGUAGES = Array.from(
  new Set([...CARDS.flatMap((c) => c.languages.map((l) => l.language)).filter(Boolean), ...EXTRA_LANGUAGES]),
) as Language[];
