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

export const EXTRA_COLLECTIONS = [
  // Era WOTC (clássicas)
  "Base Set",
  "Base Set 1st Edition",
  "Base Set 2",
  "Jungle",
  "Fossil",
  "Team Rocket",
  "Gym Heroes",
  "Gym Challenge",
  "Neo Genesis",
  "Neo Discovery",
  "Neo Revelation",
  "Neo Destiny",
  "Legendary Collection",
  "Expedition Base Set",
  "Aquapolis",
  "Skyridge",

  // Era EX (Nintendo)
  "EX Ruby & Sapphire",
  "EX Sandstorm",
  "EX Dragon",
  "EX Team Magma vs Team Aqua",
  "EX Hidden Legends",
  "EX FireRed & LeafGreen",
  "EX Team Rocket Returns",
  "EX Deoxys",
  "EX Emerald",
  "EX Unseen Forces",
  "EX Delta Species",
  "EX Legend Maker",
  "EX Holon Phantoms",
  "EX Crystal Guardians",
  "EX Dragon Frontiers",
  "EX Power Keepers",

  // Diamond & Pearl
  "Diamond & Pearl",
  "DP - Mysterious Treasures",
  "DP - Secret Wonders",
  "DP - Great Encounters",
  "DP - Majestic Dawn",
  "DP - Legends Awakened",
  "DP - Stormfront",

  // Platinum
  "Platinum",
  "PL - Rising Rivals",
  "PL - Supreme Victors",
  "PL - Arceus",

  // HeartGold & SoulSilver
  "HeartGold & SoulSilver",
  "HGSS - Unleashed",
  "HGSS - Undaunted",
  "HGSS - Triumphant",
  "Call of Legends",

  // Black & White
  "Black & White",
  "BW - Emerging Powers",
  "BW - Noble Victories",
  "BW - Next Destinies",
  "BW - Dark Explorers",
  "BW - Dragons Exalted",
  "BW - Boundaries Crossed",
  "BW - Plasma Storm",
  "BW - Plasma Freeze",
  "BW - Plasma Blast",
  "BW - Legendary Treasures",

  // XY
  "XY - Kalos Starter Set",
  "XY",
  "XY - Flashfire",
  "XY - Furious Fists",
  "XY - Phantom Forces",
  "XY - Primal Clash",
  "XY - Roaring Skies",
  "XY - Ancient Origins",
  "XY - BREAKthrough",
  "XY - BREAKpoint",
  "XY - Generations",
  "XY - Fates Collide",
  "XY - Steam Siege",
  "XY - Evolutions",

  // Sun & Moon
  "SM - Sol e Lua",
  "SM - Guardiões Ascendentes",
  "SM - Sombras Ardentes",
  "SM - Invasão Carmim",
  "SM - Ultra Prisma",
  "SM - Luz Proibida",
  "SM - Tempestade Celestial",
  "SM - Trovões Perdidos",
  "SM - Sintonia Mental",
  "SM - Eclipse Cósmico",
  "SM - Destinos Ocultos",
  "SM - Detective Pikachu",
  "SM - Dragões Soberanos",
  "SM - Promos",

  // Sword & Shield
  "SSH - Espada e Escudo",
  "RCL - Rixa Rebelde",
  "DAA - Escuridão Incandescente",
  "VIV - Voltagem Vívida",
  "SHF - Destinos Brilhantes",
  "BST - Estilos de Batalha",
  "CRE - Reinado de Calamidade",
  "EVS - Evoluções de Eevee",
  "CRZ - Coroação Estelar",
  "FST - Estrelas Fusão",
  "BRS - Astros Cintilantes",
  "ASR - Estrelas Radiantes",
  "LOR - Origem Perdida",
  "SIT - Silvestre Tempestuoso",
  "PGO - Pokémon GO",
  "CRZ - Tempestade Prateada",
  "SWSH Promos",

  // Scarlet & Violet
  "SVI - Escarlate e Violeta",
  "PAL - Evoluções em Paldea",
  "OBF - Destinos de Obsidiana",
  "MEW - 151",
  "PAR - Paradoxo Temporal",
  "PAF - Destinos de Paldea",
  "TEF - Forças Temporais",
  "TWM - Máscaras do Crepúsculo",
  "SFA - Fábulas Nebulosas",
  "SCR - Coroa Estelar",
  "SSP - Faísca Surpreendente",
  "PRE - Evoluções Pré-históricas",
  "JTG - Aventuras Conjuntas",
  "DRI - Ritmos Destinados",
  "BLK - Chamas Brancas",
  "WHT - Trovões Negros",
  "SVP - Escarlate e Violeta Promos",

  // Mega Evolution Era
  "MEG - Mega Evolução",
  "MEP - Mega Evolução Promos",

  // Coleções especiais
  "CEL - Celebrações",
  "Hidden Fates",
  "NBSP - Nintendo Black Star Promos",
  "WOTC Promos",

  // Antigos códigos PT-BR mantidos por compatibilidade
  "151 - Collection 151",
  "BUS - Sombras Ardentes",
  "PHF - Força Fantasma",
  "EE9 - Astros Cintilantes",
  "AOR - Origens Ancestrais",
  "FFI - Punhos Furiosos",
  "FL - FireRed & LeafGreen",
  "FCO - Fusão de Destinos",
  "STS - Cerco de Vapor",
  "PRC - Conflito Primitivo",
];

export const COLLECTIONS = Array.from(
  new Set([...CARDS.map((c) => c.collection).filter(Boolean), ...EXTRA_COLLECTIONS]),
).sort();

export const FINISHES: Finish[] = ["Normal", "Reverse Foil", "Foil", "Pokebola", "Masterball", "Energia", "Promo", "Ímã", "Shattered Holo", "Illustration Rare", "Ultra Rara", "Black Star Promo", "Double Rare"];

const EXTRA_LANGUAGES: Language[] = ["Japonês", "Chinês"];
export const LANGUAGES = Array.from(
  new Set([...CARDS.flatMap((c) => c.languages.map((l) => l.language)).filter(Boolean), ...EXTRA_LANGUAGES]),
) as Language[];
