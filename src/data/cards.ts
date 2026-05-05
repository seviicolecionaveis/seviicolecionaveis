export type PokemonType =
  | "fire"
  | "water"
  | "grass"
  | "electric"
  | "psychic"
  | "fighting"
  | "dark"
  | "fairy"
  | "dragon"
  | "colorless"
  | "metal";

export type Condition = "Mint" | "Near Mint" | "Excellent" | "Played" | "Poor";
export type Language = "Português" | "Inglês" | "Japonês" | "Espanhol";

export interface Card {
  id: string;
  name: string;
  type: PokemonType;
  collection: string;
  number: string;
  condition: Condition;
  language: Language;
  stock: number;
  price: number;
  image: string;
  rarity: string;
}

const img = (seed: string) =>
  `https://images.pokemontcg.io/${seed}_hires.png`;

// Real Pokémon TCG card images (CDN público da pokemontcg.io)
export const COLLECTIONS = [
  "Base Set",
  "Jungle",
  "Fossil",
  "Neo Genesis",
  "Evolving Skies",
  "Crown Zenith",
  "Paldea Evolved",
  "Obsidian Flames",
] as const;

export const TYPES: PokemonType[] = [
  "fire",
  "water",
  "grass",
  "electric",
  "psychic",
  "fighting",
  "dark",
  "fairy",
  "dragon",
  "colorless",
  "metal",
];

export const CONDITIONS: Condition[] = ["Mint", "Near Mint", "Excellent", "Played", "Poor"];
export const LANGUAGES: Language[] = ["Português", "Inglês", "Japonês", "Espanhol"];

export const TYPE_LABELS: Record<PokemonType, string> = {
  fire: "Fogo",
  water: "Água",
  grass: "Grama",
  electric: "Elétrico",
  psychic: "Psíquico",
  fighting: "Lutador",
  dark: "Sombrio",
  fairy: "Fada",
  dragon: "Dragão",
  colorless: "Incolor",
  metal: "Metal",
};

export const CARDS: Card[] = [
  { id: "1", name: "Charizard", type: "fire", collection: "Base Set", number: "4/102", condition: "Near Mint", language: "Inglês", stock: 2, price: 4250, image: img("base1-4"), rarity: "Holo Rare" },
  { id: "2", name: "Blastoise", type: "water", collection: "Base Set", number: "2/102", condition: "Mint", language: "Inglês", stock: 1, price: 1850, image: img("base1-2"), rarity: "Holo Rare" },
  { id: "3", name: "Venusaur", type: "grass", collection: "Base Set", number: "15/102", condition: "Excellent", language: "Inglês", stock: 3, price: 920, image: img("base1-15"), rarity: "Holo Rare" },
  { id: "4", name: "Pikachu", type: "electric", collection: "Base Set", number: "58/102", condition: "Near Mint", language: "Português", stock: 12, price: 45, image: img("base1-58"), rarity: "Common" },
  { id: "5", name: "Mewtwo", type: "psychic", collection: "Base Set", number: "10/102", condition: "Mint", language: "Japonês", stock: 1, price: 680, image: img("base1-10"), rarity: "Holo Rare" },
  { id: "6", name: "Alakazam", type: "psychic", collection: "Base Set", number: "1/102", condition: "Near Mint", language: "Inglês", stock: 4, price: 320, image: img("base1-1"), rarity: "Holo Rare" },
  { id: "7", name: "Machamp", type: "fighting", collection: "Base Set", number: "8/102", condition: "Excellent", language: "Inglês", stock: 5, price: 95, image: img("base1-8"), rarity: "Holo Rare" },
  { id: "8", name: "Gyarados", type: "water", collection: "Base Set", number: "6/102", condition: "Played", language: "Português", stock: 7, price: 110, image: img("base1-6"), rarity: "Holo Rare" },
  { id: "9", name: "Raichu", type: "electric", collection: "Base Set", number: "14/102", condition: "Near Mint", language: "Inglês", stock: 3, price: 180, image: img("base1-14"), rarity: "Holo Rare" },
  { id: "10", name: "Zapdos", type: "electric", collection: "Fossil", number: "15/62", condition: "Mint", language: "Inglês", stock: 2, price: 240, image: img("fossil1-15"), rarity: "Holo Rare" },
  { id: "11", name: "Articuno", type: "water", collection: "Fossil", number: "2/62", condition: "Near Mint", language: "Inglês", stock: 4, price: 195, image: img("fossil1-2"), rarity: "Holo Rare" },
  { id: "12", name: "Lugia", type: "psychic", collection: "Neo Genesis", number: "9/111", condition: "Mint", language: "Japonês", stock: 1, price: 1200, image: img("neo1-9"), rarity: "Holo Rare" },
  { id: "13", name: "Umbreon VMAX", type: "dark", collection: "Evolving Skies", number: "215/203", condition: "Mint", language: "Inglês", stock: 2, price: 980, image: img("swsh7-215"), rarity: "Alt Art Secret" },
  { id: "14", name: "Sylveon VMAX", type: "fairy", collection: "Evolving Skies", number: "211/203", condition: "Near Mint", language: "Inglês", stock: 3, price: 285, image: img("swsh7-211"), rarity: "Alt Art Secret" },
  { id: "15", name: "Rayquaza VMAX", type: "dragon", collection: "Evolving Skies", number: "218/203", condition: "Mint", language: "Inglês", stock: 5, price: 165, image: img("swsh7-218"), rarity: "Alt Art Secret" },
  { id: "16", name: "Leafeon VMAX", type: "grass", collection: "Evolving Skies", number: "205/203", condition: "Near Mint", language: "Português", stock: 4, price: 145, image: img("swsh7-205"), rarity: "Alt Art" },
  { id: "17", name: "Glaceon VMAX", type: "water", collection: "Evolving Skies", number: "208/203", condition: "Excellent", language: "Inglês", stock: 6, price: 120, image: img("swsh7-208"), rarity: "Alt Art" },
  { id: "18", name: "Pikachu VMAX", type: "electric", collection: "Crown Zenith", number: "GG70/GG70", condition: "Mint", language: "Inglês", stock: 8, price: 98, image: img("swsh12pt5gg-GG70"), rarity: "Galarian Gallery" },
  { id: "19", name: "Mew VMAX", type: "psychic", collection: "Crown Zenith", number: "GG46/GG70", condition: "Mint", language: "Inglês", stock: 4, price: 75, image: img("swsh12pt5gg-GG46"), rarity: "Galarian Gallery" },
  { id: "20", name: "Charizard ex", type: "fire", collection: "Obsidian Flames", number: "215/197", condition: "Mint", language: "Inglês", stock: 6, price: 220, image: img("sv3-215"), rarity: "Special Illustration" },
  { id: "21", name: "Pidgeot ex", type: "colorless", collection: "Obsidian Flames", number: "217/197", condition: "Near Mint", language: "Inglês", stock: 9, price: 85, image: img("sv3-217"), rarity: "Special Illustration" },
  { id: "22", name: "Iono", type: "colorless", collection: "Paldea Evolved", number: "237/193", condition: "Mint", language: "Japonês", stock: 2, price: 340, image: img("sv2-237"), rarity: "Special Illustration" },
];
