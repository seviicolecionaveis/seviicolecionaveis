import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { useCardsCatalog } from "@/hooks/useCardsCatalog";
import { useCardStats } from "@/hooks/useCardStats";
import { cardSlug } from "@/lib/slug";
import logoUrl from "@/assets/logo.png";

export const Route = createFileRoute("/mais-vendidas")({
  head: () => ({
    meta: [
      { title: "Cartas Pokémon Mais Vendidas | Sevii Colecionáveis" },
      { name: "description", content: "As cartas Pokémon mais vendidas na Sevii Colecionáveis — confira os destaques do momento e garanta as suas." },
      { property: "og:title", content: "Cartas Pokémon Mais Vendidas | Sevii Colecionáveis" },
      { property: "og:description", content: "As cartas Pokémon mais vendidas da Sevii Colecionáveis." },
      { property: "og:url", content: "https://seviicolecionaveis.com.br/mais-vendidas" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "canonical", href: "https://seviicolecionaveis.com.br/mais-vendidas" },
    ],
  }),
  component: MaisVendidasPage,
});

function MaisVendidasPage() {
  const { cards, loading } = useCardsCatalog();
  const stats = useCardStats();

  const top = useMemo(() => {
    return [...cards]
      .map((c) => ({ c, sold: stats.sales.get(c.id) ?? 0 }))
      .filter((x) => x.sold > 0 && x.c.stock > 0)
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 24);
  }, [cards, stats]);

  return (
    <div className="min-h-screen text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoUrl} alt="Sevii Colecionáveis" width={224} height={56} className="h-12 w-auto sm:h-14" />
          </Link>
          <SiteNav className="hidden md:flex" />
        </div>
        <div className="md:hidden border-t border-border px-4 py-3">
          <SiteNav className="-mx-1 overflow-x-auto" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="mb-8 max-w-3xl">
          <h1 className="text-3xl font-bold sm:text-4xl">Cartas Mais Vendidas</h1>
          <p className="mt-3 text-muted-foreground">
            Os destaques do momento na Sevii Colecionáveis — as cartas que mais saíram nos últimos pedidos. Quem demorar, perde.
          </p>
        </div>

        {loading ? (
          <div className="grid place-items-center py-16 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
              Carregando ranking...
            </div>
          </div>
        ) : top.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Em breve! Assim que houver vendas registradas com estoque disponível, elas aparecem aqui.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 md:grid-cols-4">
            {top.map(({ c, sold }, i) => (
              <Link
                key={c.id}
                to="/carta/$slug"
                params={{ slug: cardSlug(c.name, c.collection, c.number) }}
                className="group relative flex flex-col"
              >
                <div className="absolute left-2 top-2 z-10 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background">
                  #{i + 1}
                </div>
                <div className="aspect-[3/4] overflow-hidden rounded-lg bg-secondary">
                  <img
                    src={c.image}
                    alt={c.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                </div>
                <div className="mt-2">
                  <p className="line-clamp-1 text-sm font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.collection} · #{c.number}</p>
                  <p className="mt-1 text-[11px] font-medium text-primary">
                    {sold} vendida{sold > 1 ? "s" : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
