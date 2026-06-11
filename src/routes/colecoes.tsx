import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { useCardsCatalog } from "@/hooks/useCardsCatalog";
import { COLLECTION_DESCRIPTIONS } from "@/data/collectionDescriptions";
import { collectionSlug } from "@/lib/slug";
import logoUrl from "@/assets/logo.png";

export const Route = createFileRoute("/colecoes")({
  head: () => ({
    meta: [
      { title: "Coleções de Cartas Pokémon | Sevii Colecionáveis" },
      {
        name: "description",
        content:
          "Explore todas as coleções de cartas Pokémon disponíveis na Sevii Colecionáveis — de Base Set a 151, Team Rocket, Scarlet & Violet e muito mais.",
      },
      { property: "og:title", content: "Coleções de Cartas Pokémon | Sevii Colecionáveis" },
      {
        property: "og:description",
        content:
          "Todas as coleções de cartas Pokémon em um só lugar: Base Set, Jungle, Fossil, Team Rocket, 151, Scarlet & Violet e mais.",
      },
      { property: "og:url", content: "https://seviicolecionaveis.com.br/colecoes" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://seviicolecionaveis.com.br/colecoes" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Coleções de Cartas Pokémon",
          url: "https://seviicolecionaveis.com.br/colecoes",
          inLanguage: "pt-BR",
          isPartOf: {
            "@type": "WebSite",
            name: "Sevii Colecionáveis",
            url: "https://seviicolecionaveis.com.br",
          },
        }),
      },
    ],
  }),
  component: ColecoesPage,
});

function ColecoesPage() {
  const { cards, loading } = useCardsCatalog();

  const collections = useMemo(() => {
    const map = new Map<string, { name: string; count: number; cover: string }>();
    for (const c of cards) {
      const prev = map.get(c.collection);
      if (prev) {
        prev.count += 1;
      } else {
        map.set(c.collection, { name: c.collection, count: 1, cover: c.image });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [cards]);

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
        <div className="mb-10 max-w-3xl">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Coleções
          </p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
            Todas as coleções de cartas Pokémon
          </h1>
          <p className="mt-3 text-muted-foreground">
            Navegue por coleção — de Base Set aos lançamentos mais recentes.
            {collections.length > 0 && ` ${collections.length} coleções disponíveis.`}
          </p>
        </div>

        {loading ? (
          <div className="grid place-items-center py-16 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
              Carregando coleções...
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((c) => {
              const desc = COLLECTION_DESCRIPTIONS[c.name];
              return (
                <Link
                  key={c.name}
                  to="/colecao/$slug"
                  params={{ slug: collectionSlug(c.name) }}
                  className="group flex gap-4 rounded-xl border border-border bg-background p-4 transition hover:border-foreground/30 hover:shadow-sm"
                >
                  <div className="aspect-[5/7] h-28 shrink-0 overflow-hidden rounded-md bg-secondary">
                    <img
                      src={c.cover}
                      alt={c.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold leading-tight group-hover:underline">
                      {c.name}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.count} {c.count === 1 ? "carta" : "cartas"}
                    </p>
                    {desc && (
                      <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{desc}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
