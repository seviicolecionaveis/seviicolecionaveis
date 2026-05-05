import rawCards from "./cards.json";

export type Finish = "Normal" | "Foil" | "Reverse Foil" | "Pokebola" | "Promo";
export type Language = "Português" | "Inglês" | "Italiano" | "Espanhol";

export interface Card {
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

export const CARDS: Card[] = rawCards as Card[];

export const COLLECTIONS = Array.from(
  new Set(CARDS.map((c) => c.collection).filter(Boolean)),
).sort();

export const FINISHES = Array.from(
  new Set(CARDS.map((c) => c.finish).filter(Boolean)),
) as Finish[];

export const LANGUAGES = Array.from(
  new Set(CARDS.map((c) => c.language).filter(Boolean)),
) as Language[];
