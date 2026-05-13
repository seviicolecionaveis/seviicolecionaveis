import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useCardsCatalog } from "@/hooks/useCardsCatalog";
import { CardModal } from "@/components/catalog/CardModal";
import { cardSlug } from "@/lib/slug";
import logoUrl from "@/assets/logo.png";

export const Route = createFileRoute("/carta/$slug")({
  head: ({ params }) => {
    const pretty = decodeURIComponent(params.slug ?? "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      meta: [
        { title: `${pretty} — Sevii Colecionáveis` },
        {
          name: "description",
          content: `Carta Pokémon ${pretty} — disponível na Sevii Colecionáveis com estoque em tempo real.`,
        },
        { property: "og:title", content: `${pretty} — Sevii Colecionáveis` },
        {
          property: "og:description",
          content: `Veja preço, condição e idiomas disponíveis para ${pretty}.`,
        },
      ],
    };
  },
  component: CardDetailPage,
});

function CardDetailPage() {
  const { slug } = Route.useParams();
  const { cards, loading } = useCardsCatalog();
  const nav = useNavigate();
  const [closed, setClosed] = useState(false);

  const card = useMemo(
    () => cards.find((c) => cardSlug(c.name, c.collection, c.number) === slug) ?? null,
    [cards, slug],
  );

  // When user closes modal, navigate home so URL stays clean
  useEffect(() => {
    if (closed) nav({ to: "/" });
  }, [closed, nav]);

  return (
    <div className="min-h-screen text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoUrl} alt="Sevii Colecionáveis" className="h-12 w-auto sm:h-14" />
          </Link>
          <Link to="/" className="text-xs font-semibold uppercase tracking-widest hover:underline">
            ← Catálogo
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 text-center">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando carta...</p>
        ) : card ? (
          <>
            <h1 className="text-2xl font-bold">{card.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {card.collection} · #{card.number}
            </p>
            <p className="mt-6 text-xs text-muted-foreground">
              Carregando detalhes...
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Carta não encontrada</h1>
            <Link to="/" className="mt-4 inline-block text-sm underline">
              Voltar para o catálogo
            </Link>
          </>
        )}
      </main>

      <CardModal card={card} onClose={() => setClosed(true)} />
    </div>
  );
}
