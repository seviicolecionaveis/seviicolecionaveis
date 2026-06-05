import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useCardsCatalog } from "@/hooks/useCardsCatalog";
import { CardModal } from "@/components/catalog/CardModal";
import { cardSlug } from "@/lib/slug";
import { trackEvent } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { TEST_ADMIN_CARD_SLUG } from "@/lib/test-card";
import logoUrl from "@/assets/logo.png";

export const Route = createFileRoute("/carta/$slug")({
  loader: async ({ params }) => {
    try {
      const { getCardMetaBySlug } = await import("@/utils/cardMeta.functions");
      return await getCardMetaBySlug({ data: { slug: params.slug } });
    } catch {
      return null;
    }
  },
  head: ({ params, loaderData }) => {
    const pretty = loaderData
      ? loaderData.name
      : decodeURIComponent(params.slug ?? "")
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
    const url = `https://seviicolecionaveis.com.br/carta/${params.slug}`;
    const title = loaderData
      ? `${loaderData.name} — ${loaderData.collection} #${loaderData.number} | Sevii Colecionáveis`
      : `${pretty} — Sevii Colecionáveis`;
    const description = loaderData
      ? `Carta Pokémon ${loaderData.name} da coleção ${loaderData.collection} (#${loaderData.number}). Veja preço, condição e idiomas disponíveis na Sevii Colecionáveis.`
      : `Carta Pokémon ${pretty} — disponível na Sevii Colecionáveis com estoque em tempo real.`;
    const image = loaderData?.image ?? null;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "product" },
      { property: "og:url", content: url },
    ];
    if (image) {
      meta.push(
        { property: "og:image", content: image },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: image },
      );
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: loaderData?.name ?? pretty,
            description,
            url,
            ...(image ? { image } : {}),
            brand: { "@type": "Brand", name: "Pokémon" },
            ...(loaderData
              ? {
                  category: loaderData.collection,
                  sku: `${loaderData.collection}-${loaderData.number}`,
                }
              : {}),
          }),
        },
      ],
    };
  },
  component: CardDetailPage,
});

function CardDetailPage() {
  const { slug } = Route.useParams();
  const { cards, loading } = useCardsCatalog();
  const { isAdmin, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [closed, setClosed] = useState(false);

  const isTestCardRoute = slug === TEST_ADMIN_CARD_SLUG;
  const blockedTestCard = isTestCardRoute && !authLoading && !isAdmin;

  const card = useMemo(
    () => cards.find((c) => cardSlug(c.name, c.collection, c.number) === slug) ?? null,
    [cards, slug],
  );

  // When user closes modal, navigate home so URL stays clean
  useEffect(() => {
    if (closed) nav({ to: "/" });
  }, [closed, nav]);

  // GA4 view_item
  useEffect(() => {
    if (!card) return;
    const variants: any[] = (card as any).variants ?? [];
    const minPrice = variants.length
      ? Math.min(...variants.map((v: any) => v.price ?? Infinity).filter((n: number) => Number.isFinite(n)))
      : undefined;
    trackEvent("view_item", {
      currency: "BRL",
      value: minPrice,
      items: [{
        item_id: `${card.name}__${card.collection}__${card.number}`,
        item_name: card.name,
        item_category: card.collection,
        price: minPrice,
      }],
    });
  }, [card]);

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
        {blockedTestCard ? (
          <>
            <h1 className="text-2xl font-bold">Carta não encontrada</h1>
            <Link to="/" className="mt-4 inline-block text-sm underline">
              Voltar para o catálogo
            </Link>
          </>
        ) : loading || authLoading ? (
          <p className="text-sm text-muted-foreground">Carregando carta...</p>
        ) : card ? (
          <>
            <h1 className="text-2xl font-bold">{card.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {card.collection} · #{card.number}
            </p>
            {isTestCardRoute && isAdmin && (
              <p className="mt-3 inline-block rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Somente admin · cartão de teste
              </p>
            )}
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

      {!blockedTestCard && (
        <CardModal card={card} onClose={() => setClosed(true)} />
      )}
    </div>
  );
}
