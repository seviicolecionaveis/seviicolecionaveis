import { CARD_CATEGORIES, COLLECTIONS, FINISHES, LANGUAGES, POKEMON_TYPES, TRAINER_SUBCATEGORIES, type CardCategory, type Condition, type Finish, type Language, type PokemonType, type TrainerSubcategory } from "@/data/cards";

export interface FilterState {
  categories: CardCategory[];
  trainerSubcategories: TrainerSubcategory[];
  pokemonTypes: PokemonType[];
  finishes: Finish[];
  collection: string;
  languages: Language[];
  conditions: Condition[];
  inStockOnly: boolean;
  priceMin: string;
  priceMax: string;
  numberQuery: string;
}

interface Props {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onReset: () => void;
}

const finishClass: Record<Finish, string> = {
  Normal: "bg-secondary text-foreground border-border",
  Foil: "bg-brand-gold/15 text-foreground border-brand-gold/40",
  "Reverse Foil": "bg-type-psychic/15 text-type-psychic border-type-psychic/30",
  Pokebola: "bg-type-fire/15 text-type-fire border-type-fire/30",
  Masterball: "bg-type-psychic/15 text-type-psychic border-type-psychic/30",
  Rocket: "bg-foreground text-background border-foreground",
  Energia: "bg-type-grass/15 text-type-grass border-type-grass/30",
  Promo: "bg-type-electric/20 text-foreground border-type-electric/40",
  "Ímã": "bg-muted text-foreground border-border",
  "Shattered Holo": "bg-type-dragon/15 text-foreground border-type-dragon/40",
  "Illustration Rare": "bg-type-fairy/20 text-foreground border-type-fairy/40",
  "Ultra Rara": "bg-brand-gold/15 text-foreground border-brand-gold/40",
  "Black Star Promo": "bg-foreground text-background border-foreground",
  "Double Rare": "bg-type-fire/15 text-foreground border-type-fire/40",
  Liga: "bg-type-fighting/15 text-type-fighting border-type-fighting/40",
};

export function Filters({ filters, onChange, onReset }: Props) {
  const toggle = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="inline-block rounded bg-foreground px-2 py-1 text-sm font-bold uppercase tracking-widest text-background">Filtros</h3>
        <button
          onClick={onReset}
          className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Limpar
        </button>
      </div>

      <section>
        <h4 className="mb-3 inline-block rounded bg-foreground px-2 py-1 text-xs font-bold uppercase tracking-widest text-background">
          Tipo de carta
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {CARD_CATEGORIES.map((cat) => {
            const active = filters.categories.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => onChange({ ...filters, categories: toggle(filters.categories, cat) })}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/30"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {filters.categories.includes("Treinador") && (
        <section>
          <h4 className="mb-3 inline-block rounded bg-foreground px-2 py-1 text-xs font-bold uppercase tracking-widest text-background">
            Subtipo de Treinador
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {TRAINER_SUBCATEGORIES.map((sub) => {
              const active = filters.trainerSubcategories.includes(sub);
              return (
                <button
                  key={sub}
                  onClick={() => onChange({ ...filters, trainerSubcategories: toggle(filters.trainerSubcategories, sub) })}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  {sub}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h4 className="mb-3 inline-block rounded bg-foreground px-2 py-1 text-xs font-bold uppercase tracking-widest text-background">
          Extras
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {FINISHES.map((f) => {
            const active = filters.finishes.includes(f);
            return (
              <button
                key={f}
                onClick={() => onChange({ ...filters, finishes: toggle(filters.finishes, f) })}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? finishClass[f]
                    : "border-border bg-background text-muted-foreground hover:border-foreground/30"
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h4 className="mb-3 inline-block rounded bg-foreground px-2 py-1 text-xs font-bold uppercase tracking-widest text-background">
          Coleção
        </h4>
        <select
          value={filters.collection}
          onChange={(e) => onChange({ ...filters, collection: e.target.value })}
          className="w-full rounded-md border border-border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
        >
          <option value="">Todas as coleções</option>
          {COLLECTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </section>

      <section>
        <h4 className="mb-3 inline-block rounded bg-foreground px-2 py-1 text-xs font-bold uppercase tracking-widest text-background">
          Numeração
        </h4>
        <input
          type="text"
          placeholder="Ex: 094/131"
          value={filters.numberQuery}
          onChange={(e) => onChange({ ...filters, numberQuery: e.target.value })}
          className="w-full rounded-md border border-border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
        />
      </section>

      <section>
        <h4 className="mb-3 inline-block rounded bg-foreground px-2 py-1 text-xs font-bold uppercase tracking-widest text-background">
          Idioma
        </h4>
        <div className="space-y-2">
          {LANGUAGES.map((l) => (
            <label key={l} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={filters.languages.includes(l)}
                onChange={() =>
                  onChange({ ...filters, languages: toggle(filters.languages, l) })
                }
                className="rounded border-border accent-foreground"
              />
              {l}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h4 className="mb-3 inline-block rounded bg-foreground px-2 py-1 text-xs font-bold uppercase tracking-widest text-background">
          Faixa de preço (R$)
        </h4>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            placeholder="Mín"
            value={filters.priceMin}
            onChange={(e) => onChange({ ...filters, priceMin: e.target.value })}
            className="w-full rounded-md border border-border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          />
          <span className="text-muted-foreground">—</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="Máx"
            value={filters.priceMax}
            onChange={(e) => onChange({ ...filters, priceMax: e.target.value })}
            className="w-full rounded-md border border-border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
          />
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Cartas sem preço cadastrado serão ocultadas ao usar este filtro.
        </p>
      </section>

      <section>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={filters.inStockOnly}
            onChange={(e) => onChange({ ...filters, inStockOnly: e.target.checked })}
            className="rounded border-border accent-foreground"
          />
          Somente em estoque
        </label>
      </section>
    </div>
  );
}
