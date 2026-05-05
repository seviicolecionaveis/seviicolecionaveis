import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { CARDS, type Card } from "@/data/cards";
import { CardItem } from "@/components/catalog/CardItem";
import { CardModal } from "@/components/catalog/CardModal";
import { Filters, type FilterState } from "@/components/catalog/Filters";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PokéVault — Catálogo de Cartas Pokémon" },
      {
        name: "description",
        content:
          "Catálogo completo de cartas Pokémon com filtros por tipo, coleção, condição, idioma e preço. Galeria visual com estoque em tempo real.",
      },
      { property: "og:title", content: "PokéVault — Catálogo de Cartas Pokémon" },
      {
        property: "og:description",
        content: "Encontre cartas Pokémon raras e colecionáveis com filtros avançados.",
      },
    ],
  }),
  component: Index,
});

const DEFAULT_FILTERS: FilterState = {
  finishes: [],
  collection: "",
  languages: [],
  inStockOnly: false,
  priceMin: "",
  priceMax: "",
  numberQuery: "",
};

type Sort = "relevance" | "price-asc" | "price-desc" | "name";

function Index() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("relevance");
  const [active, setActive] = useState<Card | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(() => {
    const hasMin = filters.priceMin !== "";
    const hasMax = filters.priceMax !== "";
    const min = hasMin ? Number(filters.priceMin) : -Infinity;
    const max = hasMax ? Number(filters.priceMax) : Infinity;
    const priceFilterActive = hasMin || hasMax;
    const q = query.trim().toLowerCase();
    const numQ = filters.numberQuery.trim().toLowerCase();

    const list = CARDS.filter((c) => {
      if (filters.finishes.length && !filters.finishes.includes(c.finish)) return false;
      if (filters.collection && c.collection !== filters.collection) return false;
      if (filters.languages.length && !filters.languages.includes(c.language)) return false;
      if (filters.inStockOnly && c.stock === 0) return false;
      if (priceFilterActive) {
        if (c.price == null) return false;
        if (c.price < min || c.price > max) return false;
      }
      if (numQ && !c.number.toLowerCase().includes(numQ)) return false;
      if (q) {
        const hay = `${c.name} ${c.collection}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const priceVal = (p: number | null) => (p == null ? Infinity : p);
    switch (sort) {
      case "price-asc":
        return [...list].sort((a, b) => priceVal(a.price) - priceVal(b.price));
      case "price-desc":
        return [...list].sort((a, b) => priceVal(b.price) - priceVal(a.price));
      case "name":
        return [...list].sort((a, b) => a.name.localeCompare(b.name));
      default:
        return list;
    }
  }, [filters, query, sort]);

  const reset = () => {
    setFilters(DEFAULT_FILTERS);
    setQuery("");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-background font-bold">
              P
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight uppercase sm:text-lg">
                PokéVault
              </h1>
              <p className="hidden text-[10px] uppercase tracking-widest text-muted-foreground sm:block">
                Cartas Pokémon • Catálogo
              </p>
            </div>
          </div>

          <div className="relative hidden flex-1 max-w-md md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, coleção, raridade..."
              className="w-full rounded-full bg-secondary pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
            />
          </div>

          <button
            onClick={() => setDrawerOpen(true)}
            className="flex lg:hidden items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-medium"
          >
            <SlidersHorizontal className="h-4 w-4" /> Filtros
          </button>
        </div>

        <div className="md:hidden border-t border-border px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-full rounded-full bg-secondary pl-10 pr-4 py-2 text-sm focus:outline-none"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:flex">
        {/* Sidebar desktop */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-28">
            <Filters filters={filters} onChange={setFilters} onReset={reset} />
          </div>
        </aside>

        {/* Drawer mobile */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-foreground/40"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="absolute right-0 top-0 h-full w-[85%] max-w-sm overflow-y-auto bg-background p-6 shadow-xl">
              <div className="mb-6 flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-widest">Filtros</h3>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="rounded-full p-1 hover:bg-secondary"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <Filters filters={filters} onChange={setFilters} onReset={reset} />
            </div>
          </div>
        )}

        <section className="flex-1 min-w-0">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
              {filtered.length === 1 ? "carta encontrada" : "cartas encontradas"}
            </p>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium focus:outline-none"
            >
              <option value="relevance">Relevância</option>
              <option value="price-desc">Preço: Maior → Menor</option>
              <option value="price-asc">Preço: Menor → Maior</option>
              <option value="name">Nome (A-Z)</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma carta encontrada com os filtros atuais.
              </p>
              <button
                onClick={reset}
                className="mt-4 text-sm font-medium underline underline-offset-2"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((card) => (
                <CardItem key={card.id} card={card} onClick={() => setActive(card)} />
              ))}
            </div>
          )}
        </section>
      </main>

      <CardModal card={active} onClose={() => setActive(null)} />

      <footer className="border-t border-border mt-16 py-8">
        <p className="text-center text-xs text-muted-foreground">
          © PokéVault — Catálogo de cartas colecionáveis
        </p>
      </footer>
    </div>
  );
}
