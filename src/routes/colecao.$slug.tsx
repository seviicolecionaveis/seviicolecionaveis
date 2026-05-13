import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useCardsCatalog } from "@/hooks/useCardsCatalog";
import { useCardStats } from "@/hooks/useCardStats";
import { CardItem } from "@/components/catalog/CardItem";
import { CardModal } from "@/components/catalog/CardModal";
import { collectionSlug } from "@/lib/slug";
import type { Card } from "@/data/cards";
import logoUrl from "@/assets/logo.png";

export const Route = createFileRoute("/colecao/$slug")({
  head: ({ params }) => {
    const title = decodeURIComponent(params.slug ?? "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const url = `https://seviicolecionaveis.lovable.app/colecao/${params.slug}`;
    return {
      meta: [
        { title: `${title} — Coleção Pokémon | Sevii Colecionáveis` },
        {
          name: "description",
          content: `Cartas Pokémon da coleção ${title}. Veja estoque, preços e idiomas disponíveis.`,
        },
        { property: "og:title", content: `${title} — Sevii Colecionáveis` },
        {
          property: "og:description",
          content: `Catálogo da coleção ${title} com cartas em estoque.`,
        },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `Coleção ${title}`,
            url,
            inLanguage: "pt-BR",
          }),
        },
      ],
    };
  },
  component: CollectionPage,
});

function CollectionPage() {
  const { slug } = Route.useParams();
  const { cards, loading } = useCardsCatalog();
  const stats = useCardStats();
  const nav = useNavigate();
  const [active, setActive] = useState<Card | null>(null);

  const collectionName = useMemo(
    () => cards.find((c) => collectionSlug(c.collection) === slug)?.collection ?? null,
    [cards, slug],
  );

  const list = useMemo(() => {
    const filtered = cards.filter((c) => collectionSlug(c.collection) === slug);
    return [...filtered].sort((a, b) => {
      const va = stats.views.get(a.id) ?? 0;
      const vb = stats.views.get(b.id) ?? 0;
      if (vb !== va) return vb - va;
      const numA = parseInt(a.number) || 0;
      const numB = parseInt(b.number) || 0;
      return numA - numB;
    });
  }, [cards, slug, stats]);

  if (!loading && !collectionName) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Coleção não encontrada</h1>
          <button
            onClick={() => nav({ to: "/" })}
            className="mt-4 underline text-sm"
          >
            Voltar para o catálogo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoUrl} alt="Sevii Colecionáveis" className="h-12 w-auto sm:h-14" />
          </Link>
          <Link to="/" className="text-xs font-semibold uppercase tracking-widest hover:underline">
            ← Catálogo
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Coleção
          </p>
          <h1 className="mt-2 text-3xl font-bold">{collectionName ?? slug}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {list.length} {list.length === 1 ? "carta" : "cartas"} disponíveis
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((c) => (
              <CardItem key={c.id} card={c} onClick={() => setActive(c)} />
            ))}
          </div>
        )}
      </main>

      <CardModal card={active} onClose={() => setActive(null)} />
    </div>
  );
}
