// Ordenação padrão de cartas para exibição em pedidos e carrinho.
// Regras:
// 1) Agrupar por categoria: Pokémon (por Tipo) → Treinador (por Subtipo) → Energia.
// 2) Dentro de cada grupo, ordenar por nome (A→Z).

export const POKEMON_TYPE_ORDER = [
  "Água",
  "Dragão",
  "Elétrico",
  "Fada",
  "Fogo",
  "Incolor",
  "Lutador",
  "Metálico",
  "Planta",
  "Psíquico",
  "Sombrio",
] as const;

export interface SortMeta {
  category?: string | null; // "Pokémon" | "Treinador" | "Energia"
  pokemonType?: string | null;
  trainerSubcategory?: string | null;
  name?: string | null;
}

// Chave [bucket, subGroup] onde menor = mais cedo.
export function groupSortKey(meta: SortMeta): [number, string] {
  const category = (meta.category ?? "Pokémon").trim();
  if (category === "Energia") return [3, ""];
  if (category === "Treinador") {
    const sub = (meta.trainerSubcategory ?? "\uFFFF").trim() || "\uFFFF";
    return [2, sub.toLocaleLowerCase("pt-BR")];
  }
  // Pokémon (default)
  const type = (meta.pokemonType ?? "").trim();
  const idx = POKEMON_TYPE_ORDER.indexOf(type as any);
  return [1, idx === -1 ? `zz_${type.toLocaleLowerCase("pt-BR")}` : String(idx).padStart(3, "0")];
}

export function sortByCardGroup<T>(items: T[], getMeta: (item: T) => SortMeta): T[] {
  return [...items].sort((a, b) => {
    const ka = groupSortKey(getMeta(a));
    const kb = groupSortKey(getMeta(b));
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    if (ka[1] !== kb[1]) return ka[1].localeCompare(kb[1], "pt-BR");
    const na = (getMeta(a).name ?? "").toString();
    const nb = (getMeta(b).name ?? "").toString();
    return na.localeCompare(nb, "pt-BR");
  });
}
